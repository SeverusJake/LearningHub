## Mission 08 Guide — Observability

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## Starting point

You're picking up shiplog running on the cluster built in Mission 04, packaged as the Helm chart authored in Mission 05. If you did Mission 07, ArgoCD is reconciling it; if not, that's fine — everything in this mission works against a chart installed by hand too. Confirm you're starting from a known-good place:

```bash
kubectl get pods -n shiplog
```
Expected output: the shiplog app pods and the Postgres StatefulSet pod, all `Running`/`Ready`.

```bash
helm list -n shiplog
```
Expected output: a `shiplog` release in `deployed` status. This mission adds three new Helm releases alongside it (`kube-prometheus-stack`, `tempo`, `loki`) plus one new Deployment (the OTel Collector) and a chart upgrade to shiplog itself for instrumentation. Nothing from Mission 04/05 gets removed — you're adding a layer, not replacing one.

---

## Phase 1 — instrument shiplog with OpenTelemetry

Two kinds of instrumentation go into shiplog: **auto-instrumentation**, which wraps every FastAPI request and outbound Postgres call in a trace span with zero code changes, and **manual instrumentation**, which is the one custom span and one custom counter you write by hand for the business logic auto-instrumentation can't see into.

### Auto-instrumentation via `opentelemetry-instrument`

Add the OTel Python packages to shiplog's `requirements.txt`:

```
opentelemetry-distro
opentelemetry-exporter-otlp
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-psycopg2
```

`opentelemetry-distro` pulls in the SDK plus `opentelemetry-bootstrap`, which inspects your installed packages and installs the matching instrumentation library for each (FastAPI, psycopg2, requests, etc.) — run it once after `pip install -r requirements.txt` inside the image build:

```dockerfile
RUN pip install -r requirements.txt && opentelemetry-bootstrap -a install
```

Change shiplog's container entrypoint to wrap the app with `opentelemetry-instrument` — this is the whole trick: no import changes in `main.py`, the wrapper monkey-patches FastAPI and psycopg2 at process start:

```dockerfile
ENTRYPOINT ["opentelemetry-instrument", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Configure it entirely through environment variables in the Helm chart's `values.yaml` — no hardcoded endpoints in the image:

```yaml
otel:
  enabled: true
  exporterEndpoint: "http://otel-collector.observability.svc.cluster.local:4317"
  serviceName: shiplog
```

`templates/deployment.yaml`, add to the container's `env`:

```yaml
          env:
            {{- if .Values.otel.enabled }}
            - name: OTEL_SERVICE_NAME
              value: {{ .Values.otel.serviceName | quote }}
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: {{ .Values.otel.exporterEndpoint | quote }}
            - name: OTEL_EXPORTER_OTLP_PROTOCOL
              value: "grpc"
            - name: OTEL_TRACES_EXPORTER
              value: "otlp"
            - name: OTEL_METRICS_EXPORTER
              value: "otlp"
            - name: OTEL_LOGS_EXPORTER
              value: "none"
            - name: OTEL_PYTHON_LOG_CORRELATION
              value: "true"
            - name: OTEL_RESOURCE_ATTRIBUTES
              value: "deployment.environment={{ .Release.Namespace }}"
            {{- end }}
```
`OTEL_EXPORTER_OTLP_PROTOCOL: grpc` and port `4317` in the endpoint must agree — this exact mismatch is Break-fix Drill 1 below, so remember this pairing. `OTEL_PYTHON_LOG_CORRELATION` is what makes the SDK stamp `trace_id`/`span_id` onto the standard `logging` module's log records, which Phase 4's structured logging depends on. `OTEL_LOGS_EXPORTER: none` is deliberate — you're shipping logs via Loki/promtail (Phase 3), not OTLP logs, to keep this mission's log pipeline on the tool most learners will meet in production.

### One custom span

Auto-instrumentation gives you a span per HTTP request and per SQL call, but it has no idea what "look up a slug and record a hit" *means* as a unit of business logic. Wrap that in `main.py`:

```python
from opentelemetry import trace

tracer = trace.get_tracer("shiplog")

@app.get("/{slug}")
async def redirect(slug: str):
    with tracer.start_as_current_span("shiplog.redirect.lookup") as span:
        span.set_attribute("shiplog.slug", slug)
        link = await get_link_by_slug(slug)
        if link is None:
            span.set_attribute("shiplog.found", False)
            raise HTTPException(status_code=404, detail="slug not found")
        span.set_attribute("shiplog.found", True)
        await record_hit(slug)
        return RedirectResponse(link.target_url, status_code=307)
```
This span nests *inside* the auto-instrumented HTTP span (it's a child by virtue of running inside the same request context) and shows up in Tempo as a named block you wrote on purpose, with attributes you chose — versus the generic `GET /{slug}` span auto-instrumentation already gives you.

### One custom counter

```python
from opentelemetry import metrics

meter = metrics.get_meter("shiplog")
links_created_counter = meter.create_counter(
    "shiplog.links.created",
    description="Total number of short links created",
    unit="1",
)

@app.post("/links")
async def create_link(payload: LinkCreate):
    link = await insert_link(payload.target_url)
    links_created_counter.add(1, {"shiplog.has_custom_slug": bool(payload.slug)})
    return link
```
This is a business metric no auto-instrumentation would ever produce — "how many links get created, and how many of those use a custom slug" — and it rides the same OTLP metrics pipeline as the auto-instrumented HTTP duration histogram, out through the same exporter, into the same Collector.

**Checkpoint:**
```bash
helm upgrade shiplog ./chart -n shiplog --reuse-values --set otel.enabled=true
kubectl logs -n shiplog -l app.kubernetes.io/instance=shiplog --tail=20
```
Expected output: no crash from the OTel packages (a missing `opentelemetry-bootstrap -a install` step shows up here as `ModuleNotFoundError` for an instrumentation package). Traces won't have anywhere to land yet — that's Phase 2 — but the app should start cleanly with the new env vars present. Confirm with:
```bash
kubectl exec -n shiplog deploy/shiplog -- env | grep OTEL_EXPORTER_OTLP_ENDPOINT
```
Expected output: `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability.svc.cluster.local:4317` — the value is wired in even though nothing is listening on the other end until Phase 2.

---

## Phase 2 — the OTel Collector

The Collector sits between shiplog and every backend: shiplog only ever talks OTLP to one address, and the Collector fans that out to Tempo (traces) and Prometheus (metrics) — add a third backend later and shiplog's config never changes.

Create the namespace this whole mission lives in:

```bash
kubectl create namespace observability
```

`otel-collector-config.yaml` (as a ConfigMap):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: observability
data:
  config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      batch:
        timeout: 5s
        send_batch_size: 1024

    exporters:
      otlp/tempo:
        endpoint: tempo.observability.svc.cluster.local:4317
        tls:
          insecure: true
      prometheusremotewrite:
        endpoint: "http://prometheus-kube-prometheus-prometheus.observability.svc.cluster.local:9090/api/v1/write"

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch]
          exporters: [otlp/tempo]
        metrics:
          receivers: [otlp]
          processors: [batch]
          exporters: [prometheusremotewrite]
```
Two receivers (`grpc` on `4317`, `http` on `4318`) are both enabled deliberately — shiplog uses gRPC, but keeping the HTTP receiver open means any future service that only speaks OTLP/HTTP works without touching this config. `batch` exists so the Collector doesn't fire one network call per span — it groups up to 1024 spans or 5 seconds of spans, whichever comes first, into one export call, which is the difference between the Collector being a mild resource cost and a request-storm generator under load.

`otel-collector-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
        - name: otel-collector
          image: otel/opentelemetry-collector-contrib:0.105.0
          args: ["--config=/etc/otel/config.yaml"]
          ports:
            - containerPort: 4317
              name: otlp-grpc
            - containerPort: 4318
              name: otlp-http
          volumeMounts:
            - name: config
              mountPath: /etc/otel
      volumes:
        - name: config
          configMap:
            name: otel-collector-config
---
apiVersion: v1
kind: Service
metadata:
  name: otel-collector
  namespace: observability
spec:
  selector:
    app: otel-collector
  ports:
    - name: otlp-grpc
      port: 4317
      targetPort: 4317
    - name: otlp-http
      port: 4318
      targetPort: 4318
```
The `-contrib` image, not the core `opentelemetry-collector` image, is required here — `prometheusremotewrite` is a contrib-only exporter.

**Don't `kubectl apply` this yet.** The exporters point at `tempo.observability` and `prometheus-kube-prometheus-prometheus.observability`, neither of which exists until Phase 3. Write the files now; apply them at the end of Phase 3 once both backends are live, otherwise the Collector's exporters will just log connection-refused errors on every batch flush.

**Checkpoint:** you can explain, in one sentence each, why `batch` sits between the receiver and the exporters, and why the Collector needs both a `traces` pipeline and a `metrics` pipeline instead of one pipeline doing both — that's the difference between "I copied a working config" and "I understand what each stage does."

---

## Phase 3 — the backends: kube-prometheus-stack, Tempo, Loki+promtail

Install order matters here: Prometheus needs to exist and have remote-write ingestion enabled *before* the Collector can push metrics into it, and Tempo needs to exist before the Collector can push traces into it. Install both backends first, then apply the Collector manifests from Phase 2.

### 1. kube-prometheus-stack (Prometheus + Alertmanager + Grafana)

`kube-prometheus-stack-values.yaml` — trimmed for a kind cluster, with remote-write ingestion turned on so the Collector has somewhere to push:

```yaml
prometheus:
  prometheusSpec:
    enableRemoteWriteReceiver: true
    retention: 6h
    resources:
      requests:
        cpu: 200m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
    storageSpec:
      volumeClaimTemplate:
        spec:
          accessModes: ["ReadWriteOnce"]
          resources:
            requests:
              storage: 5Gi

grafana:
  enabled: true
  adminPassword: "admin-change-me"
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

alertmanager:
  alertmanagerSpec:
    resources:
      requests:
        cpu: 50m
        memory: 64Mi

# kind doesn't expose these control-plane components for scraping
kubeControllerManager:
  enabled: false
kubeScheduler:
  enabled: false
kubeEtcd:
  enabled: false
```
`enableRemoteWriteReceiver: true` is the one setting this whole mission's metrics pipeline hinges on — it opens Prometheus's `/api/v1/write` endpoint for ingestion instead of Prometheus only ever scraping targets itself. Without it, the Collector's `prometheusremotewrite` exporter gets a `404`/connection-refused on every push.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n observability -f kube-prometheus-stack-values.yaml
```
Expected output: `STATUS: deployed`.

**Checkpoint:**
```bash
kubectl get pods -n observability -l "release=prometheus"
```
Expected output: `prometheus-kube-prometheus-prometheus-0`, `alertmanager-...-0`, and a `grafana` pod all `Running`/`1/1` or `2/2`.

### 2. Tempo (single-binary)

`tempo-values.yaml`:

```yaml
tempo:
  storage:
    trace:
      backend: local
      local:
        path: /var/tempo/traces
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318
persistence:
  enabled: true
  size: 5Gi
```
`backend: local` writes traces to a PVC instead of object storage — fine for a learning cluster, wrong for production (you'd point this at S3/GCS/MinIO there).

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update
helm install tempo grafana/tempo -n observability -f tempo-values.yaml
```
Expected output: `STATUS: deployed`, and a Service named `tempo` (the exact name the Collector config in Phase 2 already assumes).

**Checkpoint:**
```bash
kubectl get pods -n observability -l app.kubernetes.io/name=tempo
kubectl get svc -n observability tempo
```
Expected output: the Tempo pod `Running`/`Ready`, and a Service exposing ports `3100` (query) and `4317`/`4318` (OTLP ingest).

### 3. Loki + promtail

```bash
helm install loki grafana/loki-stack \
  -n observability \
  --set promtail.enabled=true \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=5Gi
```
`loki-stack` installs both charts together — Loki as the log store, promtail as the DaemonSet that tails every node's container logs and ships them in. This is deliberately the simplest path to a working Loki+promtail pair; production setups often split them for independent scaling, but for this mission's scope (one node pool, one namespace to watch) the combined chart is the right call.

Expected output: `STATUS: deployed`.

**Checkpoint:**
```bash
kubectl get pods -n observability -l app=loki
kubectl get pods -n observability -l app=loki-stack-promtail
```
Expected output: the Loki pod `Running`, and a promtail pod on every node (`kubectl get nodes` count should match) also `Running`.

### 4. Now apply the Collector

```bash
kubectl apply -f otel-collector-config.yaml
kubectl apply -f otel-collector-deployment.yaml
```

**Checkpoint (full pipeline, end to end):**
```bash
kubectl logs -n observability -l app=otel-collector --tail=30
```
Expected output: no repeating `connection refused` or `context deadline exceeded` lines against `tempo` or the Prometheus remote-write URL. Generate a request and confirm a trace lands:
```bash
curl -s http://shiplog.local/healthz
kubectl port-forward -n observability svc/tempo 3100:3100 &
curl -s "http://localhost:3100/api/search?tags=service.name%3Dshiplog&limit=5" | head -c 500
```
Expected output: a JSON body containing at least one trace summary for `service.name=shiplog` — this is the first real proof traces are flowing from shiplog through the Collector into Tempo.

---

## Phase 4 — Grafana correlation

Right now you have three data stores (Prometheus, Tempo, Loki) that Grafana can each query in isolation. The point of this phase is making them jump *into each other*: a log line's `trace_id` should be one click from the full trace, and a latency spike on a histogram should be one click from the exact trace that caused it.

### Structured JSON logging with `trace_id`

Add a JSON log formatter to shiplog that pulls the active span's IDs out of OTel's context — this only works because Phase 1 set `OTEL_PYTHON_LOG_CORRELATION: "true"`, which stamps `otelTraceID`/`otelSpanID` onto every `LogRecord`:

```python
import logging
import json_log_formatter

class OtelJSONFormatter(json_log_formatter.JSONFormatter):
    def json_record(self, message, extra, record):
        extra["message"] = message
        extra["level"] = record.levelname
        extra["logger"] = record.name
        trace_id = getattr(record, "otelTraceID", None)
        span_id = getattr(record, "otelSpanID", None)
        if trace_id and trace_id != "0":
            extra["trace_id"] = trace_id
            extra["span_id"] = span_id
        return extra

handler = logging.StreamHandler()
handler.setFormatter(OtelJSONFormatter())
logging.basicConfig(handlers=[handler], level=logging.INFO)
```
Add `json-log-formatter` to `requirements.txt`. Every log line now comes out as one JSON object per line, e.g. `{"message": "link created", "level": "INFO", "trace_id": "4bf9...", "span_id": "00f0..."}` — that `trace_id` field is the string Loki's derived field regex below matches against.

### Grafana datasource provisioning with derived fields and exemplars

Configure this through `kube-prometheus-stack`'s `grafana.additionalDataSources` values (re-run `helm upgrade` on the `prometheus` release with this added to `kube-prometheus-stack-values.yaml`):

```yaml
grafana:
  additionalDataSources:
    - name: Tempo
      type: tempo
      access: proxy
      url: http://tempo.observability.svc.cluster.local:3100
      jsonData:
        tracesToLogsV2:
          datasourceUid: loki
          spanStartTimeShift: "-1m"
          spanEndTimeShift: "1m"
          filterByTraceID: true
          tags: ["trace_id"]
        serviceMap:
          datasourceUid: prometheus

    - name: Loki
      type: loki
      access: proxy
      url: http://loki.observability.svc.cluster.local:3100
      uid: loki
      jsonData:
        derivedFields:
          - datasourceUid: tempo
            matcherRegex: '"trace_id":"(\w+)"'
            name: TraceID
            url: "$${__value.raw}"
            urlDisplayLabel: "View Trace"

    - name: Prometheus-Exemplars
      type: prometheus
      access: proxy
      url: http://prometheus-kube-prometheus-prometheus.observability.svc.cluster.local:9090
      jsonData:
        exemplarTraceIdDestinations:
          - name: trace_id
            datasourceUid: tempo
```
Three links, three directions: **Loki → Tempo** via `derivedFields` (regex-extract `trace_id` out of the JSON log line, turn it into a clickable Tempo link); **Tempo → Loki** via `tracesToLogsV2` (jump from a trace to the logs emitted during its time window); **Prometheus → Tempo** via `exemplarTraceIdDestinations` (jump from a specific histogram data point to the trace exemplar attached to it). Exemplars only attach to a metric if the metric was recorded with one, which is why the next paragraph matters.

**Enable exemplars end to end.** The OTel Python SDK attaches exemplars to histogram data points automatically when a sample is recorded inside an active span — nothing extra needed in shiplog's code, since Phase 1's FastAPI auto-instrumentation already runs the HTTP duration histogram inside the request span. The part that's easy to miss is Prometheus's side: exemplar storage is feature-gated.

```yaml
prometheus:
  prometheusSpec:
    enableFeatures:
      - exemplar-storage
```
Add this to `kube-prometheus-stack-values.yaml` alongside `enableRemoteWriteReceiver` and `helm upgrade`. Skipping this flag is exactly Break-fix Drill 2 below — exemplars can be recorded and shipped correctly and still never show up in Grafana if Prometheus itself isn't configured to store them.

**Checkpoint:**
```bash
curl -s http://shiplog.local/links -X POST -H "Content-Type: application/json" -d '{"target_url":"https://example.com"}'
```
In Grafana: open **Explore**, pick the **Loki** datasource, query `{app="shiplog"}`, find the log line for that request, and confirm a **"View Trace"** link appears next to its `trace_id` field. Click it — it should land on the exact Tempo trace for that request, containing both the auto-instrumented HTTP span and your Phase 1 custom span nested inside it.

---

## Phase 5 — the RED dashboard

RED — **R**ate, **E**rrors, **D**uration — is the standard shape for a request-driven service's dashboard, and all three panels come out of the one histogram FastAPI's auto-instrumentation already emits: `http_server_duration_milliseconds_bucket` (confirm the exact metric name for your instrumentation library version first — query Prometheus's `/graph` for `http_server_duration` and read back whatever suffix your version produced before copying these queries verbatim).

**Rate** — requests per second, by route:
```promql
sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[5m])) by (http_route)
```

**Errors** — error ratio (5xx over total), by route:
```promql
sum(rate(http_server_duration_milliseconds_count{job="shiplog", http_status_code=~"5.."}[5m])) by (http_route)
/
sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[5m])) by (http_route)
```

**Duration** — p50/p95/p99 latency, by route:
```promql
histogram_quantile(0.50, sum(rate(http_server_duration_milliseconds_bucket{job="shiplog"}[5m])) by (le, http_route))
histogram_quantile(0.95, sum(rate(http_server_duration_milliseconds_bucket{job="shiplog"}[5m])) by (le, http_route))
histogram_quantile(0.99, sum(rate(http_server_duration_milliseconds_bucket{job="shiplog"}[5m])) by (le, http_route))
```
Build all four as panels in one Grafana dashboard (Rate, Errors, p50, p95/p99 duration together on one time-series panel). Generate mixed traffic to make it meaningful:
```bash
for i in $(seq 1 50); do curl -s -o /dev/null http://shiplog.local/healthz; curl -s -o /dev/null http://shiplog.local/does-not-exist; done
```

**Checkpoint:** the Rate panel shows nonzero requests/sec split by `http_route`, the Errors panel shows a visible nonzero ratio for `/does-not-exist` (a 404 counts here only if you scoped `http_status_code=~"5.."` — confirm you can tell a 4xx client-error spike apart from a 5xx server-error spike on this dashboard, since RED's "Errors" is conventionally server errors, not all non-2xx), and the Duration panel's p95 line sits close to what you'd expect for `/healthz` (low, single-digit milliseconds) versus a slower route.

---

## Phase 6 — SLO and multiwindow burn-rate alerts

**The SLO:** 99% of shiplog requests succeed (non-5xx) over a rolling 30-day window, and 95% of requests complete in under 300ms. 99% availability means a **1% error budget** — you're allowed 1% of requests to fail across 30 days before you've broken the promise to users. Burn-rate alerting isn't "alert when the error rate is high" — it's "alert when you're consuming that 30-day budget fast enough that you'll run out before the window resets."

**The math.** Burn rate is how many times faster than the error budget's "sustainable" rate you're currently burning it:

```
burn_rate = (error_ratio_over_window) / (1 - SLO_target)
```

A burn rate of `1` means you're spending the budget at exactly the rate that empties it in exactly 30 days. A burn rate of `14.4` sustained for one hour empties **2%** of a 30-day budget in that single hour (`14.4 × 1h / (30 × 24h) ≈ 2%`) — fast enough that if it kept going you'd blow the entire month's budget in about 2 hours, which is why that threshold pages immediately. A burn rate of `6` sustained for six hours empties **5%** of the budget (`6 × 6h / (30 × 24h) ≈ 5%`) — real, but slow enough to be a ticket, not a page.

Each rule below is **multiwindow**: it requires the burn rate to be high over *both* a long window (confirms it's not a blip) *and* a short window (confirms it's still happening right now, not something that already recovered) before firing.

`PrometheusRule` (Prometheus Operator picks this CRD up automatically since it's labeled to match kube-prometheus-stack's rule selector):

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: shiplog-slo-burn-rate
  namespace: observability
  labels:
    release: prometheus
spec:
  groups:
    - name: shiplog-slo
      rules:
        - alert: ShipLogErrorBudgetFastBurn
          expr: |
            (
              sum(rate(http_server_duration_milliseconds_count{job="shiplog", http_status_code=~"5.."}[1h]))
              /
              sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[1h]))
            ) > (14.4 * 0.01)
            and
            (
              sum(rate(http_server_duration_milliseconds_count{job="shiplog", http_status_code=~"5.."}[5m]))
              /
              sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[5m]))
            ) > (14.4 * 0.01)
          for: 2m
          labels:
            severity: page
          annotations:
            summary: "shiplog is burning its error budget 14.4x too fast (page)"
            description: "Over both the last 1h and last 5m, shiplog's error ratio exceeds 14.4x the sustainable rate for a 99% SLO. At this rate the 30-day budget empties in about 2 hours."

        - alert: ShipLogErrorBudgetSlowBurn
          expr: |
            (
              sum(rate(http_server_duration_milliseconds_count{job="shiplog", http_status_code=~"5.."}[6h]))
              /
              sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[6h]))
            ) > (6 * 0.01)
            and
            (
              sum(rate(http_server_duration_milliseconds_count{job="shiplog", http_status_code=~"5.."}[30m]))
              /
              sum(rate(http_server_duration_milliseconds_count{job="shiplog"}[30m]))
            ) > (6 * 0.01)
          for: 15m
          labels:
            severity: ticket
          annotations:
            summary: "shiplog is burning its error budget 6x too fast (ticket)"
            description: "Over both the last 6h and last 30m, shiplog's error ratio exceeds 6x the sustainable rate for a 99% SLO. At this rate the 30-day budget empties in about 5 days."
```
`for: 2m` / `for: 15m` add a small confirmation delay on top of the window math itself, so a single scrape-interval blip doesn't page you — the windows in the `expr` are already doing the real filtering.

```bash
kubectl apply -f shiplog-slo-burn-rate.yaml
```

**Force the fast-burn alert to prove it fires.** Point traffic at a route that reliably 500s (Phase 7 gives you one on purpose, but for this checkpoint any route you can make throw will do — even a malformed `POST /links` body works if shiplog validates and 500s instead of 400s on it):
```bash
for i in $(seq 1 200); do curl -s -o /dev/null http://shiplog.local/links -X POST -d 'not-json'; done
```

**Checkpoint:**
```bash
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090 &
```
Open `http://localhost:9090/alerts` — expected output: `ShipLogErrorBudgetFastBurn` transitions `inactive` → `pending` → `firing` within a few minutes of sustained bad traffic. Confirm you can explain, without looking back at this guide, why the *fast*-burn rule uses `1h`/`5m` windows while the *slow*-burn rule uses `6h`/`30m` — the answer is the tradeoff between "catch it fast" and "don't page on noise," not an arbitrary pair of numbers.

---

## Phase 7 — trace-driven debugging drill (and the prove-it)

This phase is also the mission's prove-it, so read the acceptance bar before you start: **you must name both root causes from Grafana panels alone — no reading shiplog's source or diff.**

**Setup.** Ask your Claude Code session to build and deploy a `shiplog-buggy` variant, image tag only, without showing you the diff: one code path gets a hidden ~400ms `sleep` injected before it returns, and a second, different code path gets an intermittent failure injected (roughly 1-in-5 to 1-in-10 requests raising an unhandled exception that surfaces as a 500). Have it deploy this variant into its own namespace (`shiplog-buggy`) sharing the same OTel Collector, Tempo, Loki, and Prometheus as the rest of this mission, so it shows up in the same Grafana instance under a different `service.name`.

Generate mixed, sustained traffic against every endpoint of the buggy variant so both symptoms have a chance to appear:
```bash
for i in $(seq 1 200); do
  curl -s -o /dev/null -w "%{http_code} " http://shiplog-buggy.local/healthz
  curl -s -o /dev/null -w "%{http_code} " http://shiplog-buggy.local/links -X POST -H "Content-Type: application/json" -d '{"target_url":"https://example.com"}'
  curl -s -o /dev/null -w "%{http_code} " http://shiplog-buggy.local/some-existing-slug
  curl -s -o /dev/null -w "%{http_code} " http://shiplog-buggy.local/stats/some-existing-slug
done
```

**Find the latency regression.** In Grafana, build (or reuse Phase 5's) Duration panel scoped to `service_name="shiplog-buggy"`. One route's p95 should stand out clearly from the rest. Open **Explore → Tempo**, search for traces on that route filtered to `duration > 300ms`, and open one. The trace waterfall shows you exactly which named span consumed the ~400ms — you don't need the source line, the span name and its position in the waterfall (which operation, called from where) is the diagnosis.

**Find the intermittent 500.** Build (or reuse) the Errors panel scoped to `service_name="shiplog-buggy"`. A different route should show a nonzero, non-constant error ratio — visibly spiky, not a flat line, which is what "intermittent" looks like on a rate graph. Search Tempo for traces on that route filtered to `status=error`, open several, and compare their span waterfalls against a successful trace on the same route. The point where the error trace's waterfall stops matching the successful one's shape is where the failure happens.

**Write the diagnosis.** Produce a short write-up (`diagnosis.md`, in this mission folder) naming: which route has the injected latency and roughly how much of its duration is unexplained by normal work; which route has the intermittent failures and roughly what fraction of requests fail; and a screenshot (or exported panel image) of each: the Duration panel showing the latency outlier, the slow trace's waterfall, the Errors panel showing the spiky error rate, and one failed trace's waterfall.

**Checkpoint / prove-it:** both root causes are named correctly, backed by the four screenshots above, and you did it without your Claude Code session showing you the injected diff or you opening `main.py` to look for it. If you get stuck, ask for one hint at a time (which endpoint category, not which line) rather than the diff — the entire value of this phase evaporates the moment you read the code instead of the traces.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — traces never arrive in Tempo

<details>
<summary>Setup</summary>

Change shiplog's `OTEL_EXPORTER_OTLP_ENDPOINT` to use the Collector's `4318` port (the HTTP receiver) while leaving `OTEL_EXPORTER_OTLP_PROTOCOL` set to `grpc`, or the reverse — protocol `http/protobuf` pointed at port `4317`. Redeploy and generate traffic.
</summary>
</details>

Expected symptom: shiplog's own logs show no OTel export errors at all (the SDK often fails quietly or logs at a level you're not watching), Tempo's search API returns zero traces for `service.name=shiplog`, and the Collector's logs show connection resets or protocol-decode errors on the OTLP receiver, not on the exporters.

<details>
<summary>Hint</summary>
Check the Collector's own logs (`kubectl logs -n observability -l app=otel-collector`) for the receiver side, not the exporter side — the failure here is between shiplog and the Collector, not between the Collector and Tempo. `OTEL_EXPORTER_OTLP_PROTOCOL` and the port number in `OTEL_EXPORTER_OTLP_ENDPOINT` are two independent settings that both have to agree with which receiver block (`grpc` vs `http`) is actually listening on that port in the Collector's config — one being right doesn't save you if the other is wrong.
</details>

### Drill 2 — exemplars recorded but never show up as clickable dots in Grafana

<details>
<summary>Setup</summary>

Remove (or comment out) `enableFeatures: [exemplar-storage]` from `kube-prometheus-stack-values.yaml` and `helm upgrade` the `prometheus` release, leaving everything else — the OTel SDK, the Collector, the Grafana datasource's `exemplarTraceIdDestinations` config — untouched.
</summary>
</details>

Expected symptom: the Prometheus panel in Grafana renders the histogram fine, but no small diamond markers (exemplars) appear on it, and querying Prometheus's HTTP API for exemplars directly (`/api/v1/query_exemplars`) returns an empty result even though you can see in the Collector's logs that data points are still being pushed.

<details>
<summary>Hint</summary>
Exemplars require support at three independent layers, and this drill breaks exactly one of them on purpose: the SDK has to record them (Phase 1/4, untouched here), the remote-write payload has to carry them (untouched here), and Prometheus's storage engine has to be configured to keep them at all — that third one is feature-gated separately from `enableRemoteWriteReceiver` and is off by default. Check what `enableFeatures` actually controls versus what remote-write ingestion controls, and don't assume "metrics are arriving" means "every piece of metadata attached to them is being kept."
</details>

### Drill 3 — Loki silently stops ingesting shiplog's logs under load

<details>
<summary>Setup</summary>

Edit promtail's scrape config (via the `loki-stack` chart's `promtail.config.snippets.pipelineStages`, or a custom `ConfigMap` if you split promtail out) to add a pipeline stage that promotes a genuinely high-cardinality field to a Loki **label** rather than leaving it as parsed log content — the `trace_id` field from Phase 4's JSON logs is the obvious, realistic candidate:

```yaml
pipelineStages:
  - json:
      expressions:
        trace_id: trace_id
  - labels:
      trace_id:
```
Generate a burst of traffic (a few hundred requests) so a few hundred distinct `trace_id` values get created.
</summary>
</details>

Expected symptom: after a short burst of traffic, new log lines from shiplog stop appearing in Grafana's Loki Explore view entirely, promtail's own logs show `entry too far behind` or ingestion-rejection errors, and Loki's own logs (or `/metrics`) show a stream/series-limit or cardinality-related rejection — despite the pods themselves still running and still writing logs to stdout.

<details>
<summary>Hint</summary>
Every unique combination of Loki labels creates a new **stream**, and every stream is a separate append-only chunk Loki has to track and index. A label that takes on a new value on every single request (like a `trace_id`, or a timestamp, or a request ID) turns "one log stream per pod" into "thousands of one-line streams," which is precisely the kind of cardinality blowup Loki's index is not built to absorb — this is different from a metrics-cardinality problem but the underlying shape (unbounded label values) is the same failure mode. Compare what belongs as a Loki **label** (bounded, low-cardinality: `app`, `namespace`, `pod` is borderline-acceptable, `level`) against what belongs as **parsed log content you filter on with LogQL instead** (`trace_id`, request IDs, user IDs) — and reconsider where in the pipeline the `trace_id` extraction in this drill's snippet should actually stop.
</details>

---

## Done when

- [ ] shiplog is auto-instrumented (`opentelemetry-instrument`) and emits traces for every request without any manual span code for the HTTP layer itself
- [ ] One hand-written custom span (`shiplog.redirect.lookup`) and one hand-written custom counter (`shiplog.links.created`) both appear in Tempo/Prometheus respectively
- [ ] The OTel Collector is running with a config you can explain stage-by-stage (receivers, batch, dual exporters) and it's the *only* thing shiplog's OTLP config points at
- [ ] kube-prometheus-stack, Tempo (single-binary), and Loki+promtail are all running in the `observability` namespace, installed in an order that respects each backend's dependency on the previous one
- [ ] Grafana's Loki datasource has a working derived field that turns a `trace_id` in a log line into a live link to the matching Tempo trace, confirmed by clicking it
- [ ] Exemplars are enabled end to end (SDK → Collector → Prometheus's `exemplar-storage` feature) and visible as clickable points on a histogram panel
- [ ] A RED dashboard exists with real Rate/Errors/Duration panels built from shiplog's request histogram, populated with real generated traffic
- [ ] A 99%-availability / p95<300ms SLO is written down, and both the fast-burn and slow-burn `PrometheusRule` alerts are installed and have been proven to fire (watched transition to `firing` in the Prometheus UI) against synthetic bad traffic
- [ ] All three break-fix drills solved by diagnosis, with the actual root cause named before the fix was applied
- [ ] Prove-it: both the hidden ~400ms latency regression and the intermittent 500s in the `shiplog-buggy` variant are correctly root-caused using only Grafana panels (Duration/Errors dashboards plus Tempo trace waterfalls) — no source code read — written up in `diagnosis.md` with the four required screenshots
