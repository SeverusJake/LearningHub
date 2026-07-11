# Mission 05 Guide — K8s Advanced

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## Starting point

You're picking up shiplog exactly where Mission 04 left it: raw manifests (`Deployment`, `Service`, `Ingress`, a plain `Secret`) applied by hand with `kubectl apply -f` against a multi-node `kind` cluster, with ingress-nginx and network policies already in place. Everything in this mission replaces "raw manifests applied by hand" with "one chart, three environments, self-scaling, stateful-database-backed." Confirm you're starting from a known-good place:

```bash
kubectl get all -n shiplog
```
Expected output: the Mission 04 Deployment, Service, and Pods all `Running`/`Ready`, in the `shiplog` namespace (create it now with `kubectl create ns shiplog` if Mission 04 used `default`).

```bash
helm version
```
Expected output: `version.BuildInfo{Version:"v3...`. If this fails, install Helm before continuing — this entire mission assumes it's already on your PATH.

---

## Phase 1 — `helm create`, then strip it down to a real chart

`helm create` gives you a scaffold with far more than shiplog needs (a HorizontalPodAutoscaler stub, a ServiceAccount, NOTES.txt, test pods you don't want yet). The skill here isn't running the generator — it's knowing what to delete and what to rewrite so every template maps to something shiplog actually needs.

Generate the scaffold, then gut it:

```bash
helm create chart
cd chart
rm -f templates/hpa.yaml templates/serviceaccount.yaml templates/tests/test-connection.yaml
rm -rf templates/tests
```
Expected output: `chart/` now contains `Chart.yaml`, `values.yaml`, `templates/_helpers.tpl`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/ingress.yaml`, `templates/NOTES.txt`, and `charts/` (empty, for future subcharts). You'll rewrite every one of the remaining templates below — `helm create`'s versions assume a generic nginx image and won't work for shiplog as-is.

`Chart.yaml`:

```yaml
apiVersion: v2
name: shiplog
description: Helm chart for shiplog — the URL shortener the devops track is built on
type: application
version: 0.1.0
appVersion: "1.0.0"
```

`templates/_helpers.tpl` — naming helpers every other template calls into, so a rename never means touching five files:

```yaml
{{- define "shiplog.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "shiplog.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "shiplog.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "shiplog.labels" -}}
app.kubernetes.io/name: {{ include "shiplog.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "shiplog.selectorLabels" -}}
app.kubernetes.io/name: {{ include "shiplog.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
```
`shiplog.labels` goes on every object's `metadata.labels` (full identity, safe to change). `shiplog.selectorLabels` is the subset that goes on `Deployment.spec.selector` and `Service.spec.selector` — that subset is immutable once a Deployment exists, so it deliberately excludes the version label that changes every release.

`templates/deployment.yaml` — the actual application:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "shiplog.fullname" . }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "shiplog.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "shiplog.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: shiplog
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
          envFrom:
            - secretRef:
                name: {{ include "shiplog.fullname" . }}-secret
          readinessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
```

`templates/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "shiplog.fullname" . }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "shiplog.selectorLabels" . | nindent 4 }}
```

`templates/ingress.yaml`:

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "shiplog.fullname" . }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  tls:
    - hosts:
        - {{ .Values.ingress.host }}
      secretName: {{ include "shiplog.fullname" . }}-tls
  rules:
    - host: {{ .Values.ingress.host }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "shiplog.fullname" . }}
                port:
                  number: {{ .Values.service.port }}
{{- end }}
```

`templates/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "shiplog.fullname" . }}-secret
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
type: Opaque
stringData:
  DATABASE_URL: "postgresql://shiplog:{{ .Values.postgres.password }}@{{ .Release.Name }}-postgres.{{ .Release.Namespace }}.svc.cluster.local:5432/shiplog"
  LOG_LEVEL: {{ .Values.logLevel | default "info" | quote }}
```

`values.yaml` — every knob the templates above read, with sane defaults:

```yaml
replicaCount: 2

image:
  repository: ghcr.io/you/shiplog
  tag: "latest"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80
  targetPort: 8000

ingress:
  enabled: true
  className: nginx
  host: shiplog.local
  annotations:
    cert-manager.io/cluster-issuer: selfsigned-issuer

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

postgres:
  password: "changeme-in-real-values"

logLevel: info
```

Lint before you ever try to install — catches template typos and missing values before Kubernetes sees them:

```bash
helm lint .
```
Expected output: `1 chart(s) linted, 0 chart(s) failed.`

Install it:

```bash
helm install shiplog . -n shiplog --create-namespace
```
Expected output: `STATUS: deployed`, a `NOTES.txt` render, and a revision `1`.

**Checkpoint:**
```bash
helm status shiplog -n shiplog
kubectl get pods -n shiplog -l app.kubernetes.io/instance=shiplog
```
Expected output: `STATUS: deployed`; pods `Running` and `1/1 Ready`. If pods `CrashLoopBackOff` on the Secret's `DATABASE_URL`, that's expected — you haven't deployed Postgres yet (Phase 5). For now, confirm the chart itself renders and applies correctly; you'll wire the database in later.

---

## Phase 2 — chart best practices: `required` values and a config-checksum roll

Two problems with the chart as it stands: nothing stops someone from installing with `postgres.password` still set to the placeholder, and nothing forces pods to restart when the Secret's contents change — Kubernetes doesn't restart running pods just because a Secret they reference was updated.

**Guard the value that must never be left as a placeholder.** Edit `templates/secret.yaml`'s password line:

```yaml
  DATABASE_URL: "postgresql://shiplog:{{ required "postgres.password must be set — no default is safe here" .Values.postgres.password }}@{{ .Release.Name }}-postgres.{{ .Release.Namespace }}.svc.cluster.local:5432/shiplog"
```

And drop the placeholder default from `values.yaml` entirely — leaving `postgres.password:` with no value forces every environment's values file to supply its own:

```yaml
postgres:
  password: ""
```

Verify the guard actually fires:

```bash
helm template . --set postgres.password=""
```
Expected output: `Error: execution error at (shiplog/templates/secret.yaml:9:18): postgres.password must be set — no default is safe here`. That error at install time is the whole point — it's cheaper than debugging a `CrashLoopBackOff` caused by a blank connection string.

**Add the checksum annotation.** Add this to `templates/deployment.yaml`'s pod template, under `metadata.annotations` (create that block if it doesn't exist yet):

```yaml
  template:
    metadata:
      annotations:
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
      labels:
        {{- include "shiplog.selectorLabels" . | nindent 8 }}
```

This renders the Secret template to a string, hashes it, and stamps the hash onto the pod template as an annotation. The pod template is part of the Deployment spec — when the hash changes, the Deployment's pod template changes, and Kubernetes rolls new pods, even though nothing else about the Deployment changed.

**Checkpoint:**
```bash
helm upgrade shiplog . -n shiplog --set postgres.password=first-pass
kubectl get pods -n shiplog -o jsonpath='{.items[0].metadata.annotations.checksum/secret}'
helm upgrade shiplog . -n shiplog --set postgres.password=second-pass
kubectl rollout status deployment/shiplog -n shiplog
```
Expected output: the second `helm upgrade` triggers a real rollout (`Waiting for deployment "shiplog" rollout to finish...` then `successfully rolled out`) even though you changed nothing in `deployment.yaml` itself — only the Secret's content changed, and the checksum annotation is what turned that into a pod restart.

---

## Phase 3 — `helm template` diff-driven development, and a `helm test` hook

**Diff before you deploy.** Never `helm upgrade` blind — render both the current release's manifests and your pending change, and read the diff:

```bash
helm get manifest shiplog -n shiplog > /tmp/before.yaml
helm template shiplog . -n shiplog -f values.yaml --set replicaCount=4 > /tmp/after.yaml
diff /tmp/before.yaml /tmp/after.yaml
```
Expected output: a unified diff showing only `replicas: 2` → `replicas: 4` changing — if anything else shows up unexpectedly (an image tag you didn't mean to bump, a label reshuffled), that's your signal to stop before you `upgrade`, not after.

**Add a `helm test` hook.** This is a Job that runs only when you ask for it (`helm test`), proving the release actually serves traffic — not just that pods exist.

`templates/tests/test-connection.yaml`:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: {{ include "shiplog.fullname" . }}-test-connection
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec:
  containers:
    - name: curl
      image: curlimages/curl:8.9.1
      command:
        - sh
        - -c
        - |
          curl -sf --max-time 5 http://{{ include "shiplog.fullname" . }}:{{ .Values.service.port }}/healthz
  restartPolicy: Never
```
`helm.sh/hook: test` marks this as test-only — it never deploys with `helm install`/`upgrade`. `hook-delete-policy` cleans up the previous test pod before creating a new one, so re-running `helm test` doesn't pile up dead pods.

**Checkpoint:**
```bash
helm test shiplog -n shiplog
```
Expected output: `Phase: Succeeded` — the curl inside the hook pod reached `/healthz` over the in-cluster Service and got a 2xx. If shiplog's pods aren't healthy yet (Phase 5 dependency), expect `Phase: Failed`; re-run once Postgres is wired up.

---

## Phase 4 — three values files: dev, staging, prod

One chart, three environments. Differences: replica count, resource sizing, and the ingress host. Everything else (templates, labels, probes) stays identical — that sameness is the entire argument for Helm over copy-pasted manifests.

`values-dev.yaml`:

```yaml
replicaCount: 1

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi

ingress:
  host: shiplog.dev.local

postgres:
  password: "dev-only-password"
```

`values-staging.yaml`:

```yaml
replicaCount: 2

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi

ingress:
  host: shiplog.staging.local

postgres:
  password: "staging-password-still-not-prod-secret"
```

`values-prod.yaml`:

```yaml
replicaCount: 3

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi

ingress:
  host: shiplog.prod.local

postgres:
  password: "REPLACE_WITH_A_REAL_SECRET_MANAGER_VALUE"
```

Deploy all three into separate namespaces on the same kind cluster, so you can compare them side by side:

```bash
helm install shiplog-dev . -n shiplog-dev --create-namespace -f values-dev.yaml
helm install shiplog-staging . -n shiplog-staging --create-namespace -f values-staging.yaml
helm install shiplog-prod . -n shiplog-prod --create-namespace -f values-prod.yaml
```

**Checkpoint:**
```bash
for ns in shiplog-dev shiplog-staging shiplog-prod; do
  echo "=== $ns ==="
  kubectl get deploy -n $ns -o jsonpath='{.items[0].spec.replicas}{"\n"}'
done
```
Expected output: `1`, `2`, `3` — three real environments, one chart, zero duplicated templates.

---

## Phase 5 — Postgres as a real StatefulSet (two paths)

shiplog needs a database that survives pod restarts with the same data and the same stable network identity. A plain Deployment can't guarantee either. Two legitimate ways to get there — build both far enough to compare, then pick one to carry forward.

### Path A — hand-authored StatefulSet

`postgres-statefulset.yaml` (apply standalone with `kubectl apply -f`, or fold into the chart under `templates/postgres/` once you've picked this path):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-init
  namespace: shiplog
type: Opaque
stringData:
  POSTGRES_USER: shiplog
  POSTGRES_PASSWORD: first-pass
  POSTGRES_DB: shiplog
---
apiVersion: v1
kind: Service
metadata:
  name: shiplog-postgres
  namespace: shiplog
spec:
  clusterIP: None
  selector:
    app: shiplog-postgres
  ports:
    - port: 5432
      name: postgres
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: shiplog-postgres
  namespace: shiplog
spec:
  serviceName: shiplog-postgres
  replicas: 1
  selector:
    matchLabels:
      app: shiplog-postgres
  template:
    metadata:
      labels:
        app: shiplog-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
              name: postgres
          envFrom:
            - secretRef:
                name: postgres-init
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
              subPath: pgdata
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "shiplog"]
            initialDelaySeconds: 5
            periodSeconds: 10
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi
```
`clusterIP: None` makes the Service headless — instead of load-balancing, it gives each pod a stable DNS name (`shiplog-postgres-0.shiplog-postgres.shiplog.svc.cluster.local`), which matters the moment you scale to a primary/replica topology. `volumeClaimTemplates` gives each replica its own PersistentVolumeClaim that's created once and reused on every pod restart or rescheduling — that's the actual durability guarantee a bare Deployment can't make. `subPath: pgdata` avoids Postgres complaining about `lost+found` in the volume root.

```bash
kubectl apply -f postgres-statefulset.yaml
kubectl rollout status statefulset/shiplog-postgres -n shiplog
```
Expected output: `statefulset rolling update complete 1 pods`.

### Path B — the Bitnami chart as a dependency

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

Add it as a chart dependency, `Chart.yaml`:
```yaml
dependencies:
  - name: postgresql
    version: "16.x.x"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

```bash
helm dependency update .
```
Expected output: `charts/postgresql-16.x.x.tgz` downloaded into `chart/charts/`.

Configure it in `values.yaml`:
```yaml
postgresql:
  enabled: true
  auth:
    username: shiplog
    password: "REPLACE_ME"
    database: shiplog
  primary:
    persistence:
      size: 1Gi
```

### Tradeoff

| | Path A — hand-authored | Path B — Bitnami chart |
|---|---|---|
| Control | Full — every field is yours to read and change | Wrapped behind the chart's own values schema |
| Learning value | High — you write the StatefulSet, headless Service, and PVC yourself | Low for k8s internals, high for "how to consume a subchart" |
| Maintenance | You own upgrades, CVE patches, replication topology | Bitnami maintains it; upgrades are a version bump |
| Time to production-grade HA | Slow — replication, backups, failover are all extra work you'd write yourself | Fast — replica counts and backup hooks are already built in |
| Right for | Learning, small internal tools, cases needing a nonstandard topology | Real production systems where a maintained, battle-tested chart beats bespoke code |

**Pick Path A to proceed with this guide** — the goal of this mission is understanding what a StatefulSet actually does, not consuming someone else's abstraction over it. Wire the app's Secret to point at it (`shiplog-postgres.shiplog.svc.cluster.local`, matching `templates/secret.yaml` from Phase 1), and re-run `helm upgrade`.

**Checkpoint:**
```bash
kubectl exec -n shiplog shiplog-postgres-0 -- psql -U shiplog -d shiplog -c "CREATE TABLE proof(id serial primary key, note text); INSERT INTO proof(note) VALUES ('data survives'); SELECT * FROM proof;"
kubectl delete pod shiplog-postgres-0 -n shiplog
kubectl wait --for=condition=Ready pod/shiplog-postgres-0 -n shiplog --timeout=60s
kubectl exec -n shiplog shiplog-postgres-0 -- psql -U shiplog -d shiplog -c "SELECT * FROM proof;"
```
Expected output: the row you inserted (`1 | data survives`) is still there after the pod was deleted and recreated — proof the PVC, not the pod, is what's holding your data.

---

## Phase 6 — metrics-server, HPA v2, and k6 to force a real scale-out

### metrics-server on kind

kind's nodes use self-signed kubelet certificates that `metrics-server` rejects by default (`x509: cannot validate certificate`). Install it, then patch around that:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```
Expected output: `deployment.apps/metrics-server patched`.

**Checkpoint:**
```bash
kubectl top nodes
kubectl top pods -n shiplog
```
Expected output: real CPU/memory numbers, not `error: metrics not available yet` (give it up to a minute after the patch before this works).

### HPA v2 on CPU

`templates/hpa.yaml`:

```yaml
{{- if .Values.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "shiplog.fullname" . }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "shiplog.fullname" . }}
  minReplicas: {{ .Values.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.autoscaling.targetCPUUtilizationPercentage }}
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
{{- end }}
```

Add to `values.yaml`:
```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 8
  targetCPUUtilizationPercentage: 50
```
The HPA computes target replicas against `resources.requests.cpu`, not `limits` — that's the field the `averageUtilization` percentage is measured against. This matters directly in the break-fix drills below.

```bash
helm upgrade shiplog . -n shiplog --reuse-values --set autoscaling.enabled=true
kubectl get hpa -n shiplog
```
Expected output: an HPA listing `TARGETS: <something>%/50%`, `MINPODS: 2`, `MAXPODS: 8`.

### k6 load test

`load-test.js`:

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  scenarios: {
    ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  http.get('http://shiplog.local/healthz');
  sleep(0.1);
}
```

Run it against the ingress host you set in `values.yaml` (add `<kind-node-ip> shiplog.local` to `/etc/hosts` first if you haven't since Mission 04):

```bash
k6 run load-test.js
```

In a second terminal, watch the HPA react live:

```bash
kubectl get hpa -n shiplog -w
```

**Checkpoint:** during the k6 run's plateau (the 50-VU, 2-minute stage), `TARGETS` climbs past `50%` and `REPLICAS` increases beyond `minReplicas`; once k6 finishes and the load stops, `REPLICAS` scales back down after the `stabilizationWindowSeconds: 60` cooldown. Watching it happen live — not reading about it — is the checkpoint.

---

## Phase 7 — PodDisruptionBudget and what it blocks during a drain

A PDB doesn't prevent disruption outright — it only blocks *voluntary* disruptions (drains, `kubectl delete node`, cluster-autoscaler scale-down) from taking more pods than the budget allows. It does nothing against involuntary disruption (a node crashing outright).

`templates/pdb.yaml`:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "shiplog.fullname" . }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
spec:
  minAvailable: {{ .Values.pdb.minAvailable }}
  selector:
    matchLabels:
      {{- include "shiplog.selectorLabels" . | nindent 6 }}
```

Add to `values.yaml`:
```yaml
pdb:
  minAvailable: 1
```

```bash
helm upgrade shiplog . -n shiplog --reuse-values
```

**Demo the drain.** Pick a node running a shiplog pod and drain it:

```bash
kubectl get pods -n shiplog -o wide
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
```
Expected output: if evicting the pod on that node would violate `minAvailable`, the drain stalls on that pod specifically with `error when evicting pod ... Cannot evict pod as it would violate the pod's disruption budget.` and retries until either capacity frees up elsewhere or you give up. If `replicaCount`/HPA already has enough healthy replicas on other nodes to satisfy `minAvailable`, the drain proceeds and Kubernetes reschedules the evicted pod onto a remaining node.

Uncordon when you're done so the node rejoins scheduling:
```bash
kubectl uncordon <node-name>
```

**Checkpoint:** you can state, from what you just watched, exactly which pod eviction the PDB blocked (or would have blocked at a lower replica count) and why — not just that the drain command finished.

---

## Phase 8 — kustomize overlays for the same three environments

Rebuild dev/staging/prod with kustomize instead of Helm values files, using the Mission 04 raw manifests as the base — this is the comparison you need real experience with, not just an opinion.

```
kustomize/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── overlays/
    ├── dev/kustomization.yaml
    ├── staging/kustomization.yaml
    └── prod/kustomization.yaml
```

`base/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml
```

`overlays/prod/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: shiplog-prod
resources:
  - ../../base
replicas:
  - name: shiplog
    count: 3
patches:
  - target:
      kind: Ingress
      name: shiplog
    patch: |-
      - op: replace
        path: /spec/rules/0/host
        value: shiplog.prod.local
```

```bash
kustomize build overlays/prod
kubectl apply -k overlays/prod
```
Expected output: `kustomize build` prints fully-rendered manifests with `namespace: shiplog-prod`, `replicas: 3`, and the patched host — no templating language involved, just a base plus strategic-merge/JSON patches per environment.

**Written comparison — helm vs. kustomize:**

Reach for **Helm** when: you're distributing a chart to other people/teams who don't share your manifests (a real package with a version and a values contract); you need conditional logic (`{{- if }}`), loops over lists, or computed values (the checksum annotation in Phase 2 has no kustomize equivalent); you want `helm rollback` to a previous release atomically; or you're consuming someone else's chart as a dependency (Phase 5's Path B).

Reach for **kustomize** when: you own the full set of manifests yourself and just need environment-specific patches (replica counts, a host, a resource limit) without introducing a templating language and its whitespace/escaping footguns; you want plain YAML in, plain YAML out, with `kubectl apply -k` needing no extra tooling install (kustomize ships inside `kubectl` since 1.14); or the audience reading the manifests later benefits more from readable YAML+patches than from Go template syntax mixed into YAML.

**Checkpoint:** `kustomize build` for all three overlays renders correctly, and you can state — from experience building both, not from a blog post — one concrete case where each tool would have made the other harder.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — `helm upgrade` stuck pending

<details>
<summary>Setup</summary>

Start a `helm upgrade` and kill the Helm CLI mid-flight (Ctrl+C right after it starts, before it reports done), or run two `helm upgrade shiplog . -n shiplog` commands back to back in separate terminals so one starts while the other is still applying. Now try a normal `helm upgrade` again.
</details>

Expected symptom: `Error: UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress`.

<details>
<summary>Hint</summary>
`helm history shiplog -n shiplog` and `helm list -n shiplog` will show you the release stuck in `pending-upgrade` (or `pending-install`). Helm tracks release state as a Secret in the release's namespace — look at what `helm rollback` and `helm history` actually operate on, and consider what "clearing" a stuck operation really means for that stored state versus just retrying the same command harder.
</details>

### Drill 2 — HPA at max replicas but latency is worse

<details>
<summary>Setup</summary>

Set `resources.requests.cpu` very low (e.g. `10m`) while leaving `resources.limits.cpu` unchanged or generous, then re-run the k6 load test from Phase 6.
</details>

Expected symptom: the HPA scales to `maxReplicas` (its utilization math against the tiny `requests.cpu` says it's "over target" almost immediately) but response latency under load gets *worse*, not better, and `kubectl top pods` shows CPU usage nowhere near the `limits` ceiling.

<details>
<summary>Hint</summary>
The HPA's percentage is `usage / requests`, not `usage / limits`. A `requests` value that's too small relative to what the container actually needs at rest means the HPA fires on phantom pressure while real per-pod throughput is throttled by something else entirely — check what `limits.cpu` combined with the container's actual runtime concurrency model does to a single pod's ability to serve requests, independent of how many replicas exist.
</details>

### Drill 3 — StatefulSet pod stuck `Terminating` with its PVC

<details>
<summary>Setup</summary>

`kubectl delete pod shiplog-postgres-0 -n shiplog --grace-period=30`, then immediately in another terminal try to scale the StatefulSet to 0 and back, or delete the PVC while the pod is still mid-termination.
</details>

Expected symptom: the pod hangs in `Terminating` far longer than its `grace-period`, and/or the PVC shows `Terminating` too but never actually disappears while a pod still references it.

<details>
<summary>Hint</summary>
`kubectl get pod shiplog-postgres-0 -n shiplog -o yaml` under `status` and `metadata.finalizers`, plus `kubectl describe pvc` for events, will show you exactly what's blocking removal. Finalizers exist precisely to stop this kind of premature cleanup — the question is which finalizer is present, what condition it's waiting on, and whether force-removing it is actually safe here or just papering over a pod that's genuinely still doing something (check `kubectl logs --previous` before you decide).
</details>

---

## Prove-it: one command, fresh cluster, fully working HTTPS app

Tear down or spin up a brand-new `kind` cluster, install nothing manually except the cluster itself and the shared prerequisites (ingress-nginx, cert-manager or your self-signed issuer, metrics-server), then run exactly:

```bash
helm install shiplog ./chart -f values-prod.yaml
```

Expected end state, with **zero manual edits after that command**: `helm status` reports `deployed`; every pod (app + Postgres StatefulSet) is `Running`/`Ready`; `curl -k https://shiplog.local/healthz` returns a healthy response through the ingress over TLS; `helm test shiplog` passes; the HPA and PDB both show up in `kubectl get hpa,pdb -n shiplog`.

<details>
<summary>Hint</summary>
If this requires you to remember a manual step ("oh right, I have to kubectl apply the postgres secret first" or "I need to patch metrics-server again"), that step belongs inside the chart or a documented one-time cluster bootstrap script, not in your memory. Re-read Phase 1's `required` guard and Phase 5's Secret wiring — the test is whether someone who has never seen this chart before could run that one line and get a working app.
</details>

---

## Done when

- [ ] `chart/` is an authored Helm chart (not an untouched `helm create` scaffold) with working Deployment, Service, Ingress, and Secret templates
- [ ] `helm install` and `helm upgrade` both work cleanly, and a bad `postgres.password` is rejected by a `required` guard before it ever reaches the cluster
- [ ] A config-checksum annotation forces a real pod rollout when the Secret's contents change, proven with two `helm upgrade` calls
- [ ] `helm test shiplog` passes against a live release
- [ ] dev/staging/prod deployed from the same chart with three different values files, differing replica counts confirmed live
- [ ] Postgres runs as a StatefulSet with a headless Service and `volumeClaimTemplates`; data survives a pod delete-and-recreate cycle; the Bitnami-chart tradeoff is written down, not just considered
- [ ] `metrics-server` reports real numbers on this kind cluster; an HPA v2 manifest scales shiplog up under k6-generated load and back down after
- [ ] A PDB is in place and you've watched, live, exactly what it blocks (or would block) during a `kubectl drain`
- [ ] The same three environments rebuilt with kustomize overlays, and a written helm-vs-kustomize comparison grounded in having built both
- [ ] All three break-fix drills solved by diagnosis
- [ ] Prove-it: `helm install shiplog ./chart -f values-prod.yaml` on a fresh cluster produces a fully working HTTPS app in one command, no manual edits
