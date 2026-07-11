# Mission 06 — All-Seeing Eye

**Track:** sysops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01 (Lab Forge). Mission 05 (Service Citadel) is optional — its Postfix box is reused as the SMTP relay for alert delivery, but you can point Alertmanager at any reachable mail relay if you skipped it.

## Goal

Build a full monitoring, logging, and alerting stack over the lab and prove it actually catches things breaking. By the end, every VM in the lab reports metrics and logs to one place, PromQL queries answer real capacity questions, Alertmanager emails you the moment a disk is about to fill or a service dies, Grafana gives you both a battle-tested community dashboard and one you built panel-by-panel yourself, and you have written runbooks you'd trust a teammate to follow at 3am.

## Skills gained

- Install and run Prometheus as a proper systemd service, configure static scrape targets, and read the `/targets` UI
- Write PromQL: `rate()` over counters, CPU utilization percentage, `predict_linear()` for capacity forecasting, and recording rules
- Configure Alertmanager routing and receivers, and hook it to a real SMTP relay for alert email
- Write Prometheus alerting rules with correct `for:` durations to avoid flapping
- Install Grafana, provision a datasource via YAML, import a community dashboard by ID, and build a dashboard from scratch
- Centralize logs with Loki + promtail and query them with LogQL, including an error-rate query
- Diagnose scrape-target and cardinality problems using Prometheus's own internal metrics
- Write and use incident runbooks under time pressure

## Deliverables

- [ ] Prometheus running on a dedicated monitoring VM, scraping every lab VM built so far
- [ ] Grafana running with one imported dashboard (node-exporter-full, ID 1860) and one self-built 4-panel dashboard, both rendering live data
- [ ] Alertmanager routing alerts to email through the Mission 05 Postfix relay (or an equivalent SMTP relay)
- [ ] `DiskWillFillIn4Hours` and `ServiceDown` alert rules live, both with correct `for:` durations
- [ ] Loki + promtail centralizing logs from every scraped VM, queryable with LogQL
- [ ] Two written runbooks (`DiskFull`, `ServiceDown`) that stand on their own — no tribal knowledge required
- [ ] All three break-fix drills solved and documented
- [ ] Prove-it drill completed: a real disk-fill alert reaches the inbox and is resolved from the runbook alone, inside 20 minutes

## Start

Open a Claude Code session in this folder and say: `start sysops/06`. Follow GUIDE.md.
