# Mission 08 — Observability

**Track:** devops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Missions 04, 05 (07 recommended)

## Goal

shiplog is running on a real cluster (Mission 04), packaged as a Helm chart across three environments (Mission 05), and — if you did Mission 07 — being promoted dev-to-prod by ArgoCD without a human touching `kubectl apply`. None of that tells you *why* a request was slow, *which* pod threw the 500, or *whether* you're about to breach your uptime promise to users. This mission closes that gap. You'll instrument shiplog to emit traces and custom metrics with OpenTelemetry, stand up a full observability stack (OTel Collector, kube-prometheus-stack, Tempo, Loki), wire Grafana so a log line jumps straight to the trace that produced it and the trace jumps straight to the metric spike it caused, build a RED dashboard from real histograms, define an SLO with multiwindow burn-rate alerts that page you before a promise is broken — and then prove all of it by hunting down two injected production bugs using nothing but Grafana.

## Skills gained

- Auto-instrumenting a Python service with `opentelemetry-instrument` (zero code changes) plus hand-written custom spans and counters where the auto-instrumentation isn't enough
- Designing an OTel Collector pipeline: OTLP receivers, batch processing, and dual export to a trace backend and a metrics backend
- Installing and trimming kube-prometheus-stack, Tempo (single-binary), and Loki+promtail for a learning-scale cluster without drowning it in resource requests
- Grafana datasource correlation: derived fields that turn a `trace_id` in a log line into a clickable Tempo link, and exemplars that turn a Prometheus histogram bucket into a link to the exact trace behind it
- Structured JSON application logging that carries `trace_id`/`span_id` on every line, which is what makes log↔trace correlation possible at all
- Building a RED (Rate, Errors, Duration) dashboard straight from a Prometheus histogram using `rate()`, `histogram_quantile()`, and label-based error filters
- Defining an SLO (99% availability, p95 latency < 300ms) and translating an error budget into fast-burn and slow-burn multiwindow alert rules with the burn-rate math worked out by hand
- Trace-driven debugging: finding a hidden latency regression and an intermittent error rate using only Grafana panels — no reading application code

## Deliverables

- [ ] shiplog emitting OpenTelemetry traces and metrics — auto-instrumented plus one hand-written custom span and one custom counter
- [ ] kube-prometheus-stack, Tempo, and Loki+promtail all running in-cluster, receiving data from the OTel Collector and from promtail respectively
- [ ] Grafana with logs, traces, and metrics cross-linked: a log line's `trace_id` opens the matching Tempo trace, and a latency-histogram exemplar opens the trace behind that specific data point
- [ ] A RED dashboard (rate, errors, duration) built from shiplog's request histogram, showing real traffic
- [ ] A 99% availability / p95<300ms SLO with two multiwindow burn-rate alert rules (fast-burn and slow-burn) firing correctly against synthetic bad traffic
- [ ] All three break-fix drills solved by diagnosis, not guesswork
- [ ] The prove-it: a shiplog variant with a hidden 400ms sleep on one code path and intermittent 500s on another, both root-caused from Grafana alone, written up with trace screenshots

## Start

Open a Claude Code session in this folder and say: `start devops/08`. Follow GUIDE.md.
