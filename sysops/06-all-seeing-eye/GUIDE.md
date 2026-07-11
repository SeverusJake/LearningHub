# Guide — Mission 06: All-Seeing Eye

New machine this mission adds to the lab (clone from `tpl-ubuntu2404` per the Mission 01 clone checklist):

```
lab-mon01.lab.local   172.16.10.40   Ubuntu 24.04   Prometheus + Alertmanager + Grafana + Loki
```

Scrape targets — every lab VM built in earlier missions. Use whichever of these actually exist in your lab; the guide assumes at minimum `lab-mon01` plus two or three targets:

```
lab-dns1.lab.local    172.16.10.11   (Mission 04)
lab-web01.lab.local   172.16.10.30   (Mission 05)
lab-mail01.lab.local  172.16.10.31   (Mission 05 — also the SMTP relay for alerts)
lab-ipa01.lab.local   172.16.10.32   Rocky 9   (Mission 05)
test01/02/03          172.16.10.21/.22/.23   (Mission 01)
```

Every command states its machine: **[lab-mon01]**, **[target VM]**, etc. All are guest bash unless noted. If you skipped Mission 05, swap `lab-mail01.lab.local:25` in Phase 4 for any SMTP relay you can reach (even a throwaway `msmtp`-to-file setup) — the alerting mechanics don't care where the mail actually lands.

---

## Phase 0 — Setup check

Clone `lab-mon01` now using the Mission 01 clone checklist (regenerate machine-id, SSH host keys, hostname, static IP `172.16.10.40`).

**[host or lab-mon01]** — confirm the gateway is reachable:

```bash
ping -c 2 172.16.10.1
```

Expected output: `2 packets transmitted, 2 received, 0% packet loss`.

**[lab-mon01]** — confirm passwordless SSH to at least two target VMs (you'll need this in Phase 2 and Phase 6 to push installers):

```bash
ssh labadmin@172.16.10.21 hostname
ssh labadmin@172.16.10.30 hostname
```

Expected output: each command prints the target's hostname with no password prompt.

**[lab-mon01]** — if Mission 05 is in place, confirm the mail relay is reachable on port 25:

```bash
nc -zv 172.16.10.31 25
```

Expected output: `Connection to 172.16.10.31 25 port [tcp/smtp] succeeded!`

If you have Mission 04 DNS, add `lab-mon01 IN A 172.16.10.40` to the `lab.local` zone on `lab-dns1`, bump the serial, and `rndc reload lab.local` the same way earlier missions did. If you don't, add `/etc/hosts` entries for the hostnames you'll reference on `lab-mon01` and any target VM you SSH from.

**Checkpoint:** gateway pings clean, SSH works passwordless to at least two target VMs, and (if Mission 05 exists) the mail relay accepts a TCP connection on 25. Do not continue to Phase 1 if SSH still prompts for a password — fix key auth first, every later phase pushes files over SSH.

---

## Phase 1 — Prometheus install

**[lab-mon01]** — create the service user and directories:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin prometheus
sudo mkdir -p /etc/prometheus /etc/prometheus/rules /var/lib/prometheus
```

**[lab-mon01]** — download and install the binary:

```bash
cd /tmp
curl -LO https://github.com/prometheus/prometheus/releases/download/v3.1.0/prometheus-3.1.0.linux-amd64.tar.gz
tar xzf prometheus-3.1.0.linux-amd64.tar.gz
cd prometheus-3.1.0.linux-amd64
sudo cp prometheus promtool /usr/local/bin/
sudo cp -r consoles console_libraries /etc/prometheus/
sudo chown -R prometheus:prometheus /etc/prometheus /var/lib/prometheus
sudo chown prometheus:prometheus /usr/local/bin/prometheus /usr/local/bin/promtool
```

Verify the binary:

```bash
prometheus --version
```

Expected output: `prometheus, version 3.1.0 ...` (build info follows).

**[lab-mon01]** — `/etc/prometheus/prometheus.yml`, a minimal self-scraping config to start:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.rules.yml

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
```

```bash
sudo chown prometheus:prometheus /etc/prometheus/prometheus.yml
```

**[lab-mon01]** — full systemd unit, `/etc/systemd/system/prometheus.service`:

```ini
[Unit]
Description=Prometheus Monitoring
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus \
  --web.console.templates=/etc/prometheus/consoles \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.listen-address=0.0.0.0:9090 \
  --web.enable-lifecycle
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`--web.enable-lifecycle` is what lets you `curl -X POST http://localhost:9090/-/reload` later instead of restarting the whole process every time you edit the config.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus
sudo systemctl status prometheus --no-pager
```

Expected output: `Active: active (running)`.

**Checkpoint:** targets UP.

```bash
curl -s http://localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
```

Expected output: `"health":"up"`. Also open `http://172.16.10.40:9090/targets` in a browser — the `prometheus` job shows one target in state `UP`. Do not continue to Phase 2 if this shows `down` — check `journalctl -u prometheus -n 50` for a config parse error first.

---

## Phase 2 — node_exporter on every VM

**[lab-mon01]** — write the one-line install script, `/root/install-node-exporter.sh`, that you'll push to every target:

```bash
#!/bin/bash
set -euo pipefail
VERSION=1.8.2
id node_exporter &>/dev/null || sudo useradd --no-create-home --shell /usr/sbin/nologin node_exporter
cd /tmp
curl -LO "https://github.com/prometheus/node_exporter/releases/download/v${VERSION}/node_exporter-${VERSION}.linux-amd64.tar.gz"
tar xzf "node_exporter-${VERSION}.linux-amd64.tar.gz"
sudo cp "node_exporter-${VERSION}.linux-amd64/node_exporter" /usr/local/bin/
sudo chown node_exporter:node_exporter /usr/local/bin/node_exporter
sudo tee /etc/systemd/system/node_exporter.service >/dev/null <<'EOF'
[Unit]
Description=Prometheus Node Exporter
Wants=network-online.target
After=network-online.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
echo "node_exporter installed and running on $(hostname)"
```

```bash
chmod +x /root/install-node-exporter.sh
```

**[lab-mon01]** — push and run it on every target VM (adjust the IP list to match what actually exists in your lab; Rocky hosts need `curl`/`tar` present, which they are by default):

```bash
for h in 172.16.10.21 172.16.10.30 172.16.10.31 172.16.10.32; do
  echo "== $h =="
  scp /root/install-node-exporter.sh labadmin@${h}:/tmp/
  ssh labadmin@${h} "chmod +x /tmp/install-node-exporter.sh && sudo /tmp/install-node-exporter.sh"
done
```

Expected output: each host ends with `node_exporter installed and running on <hostname>`.

**[lab-mon01]** — add the `node` job to `/etc/prometheus/prometheus.yml` (append under `scrape_configs`, don't replace the `prometheus` job):

```yaml
  - job_name: node
    static_configs:
      - targets:
          - "172.16.10.21:9100"
          - "172.16.10.30:9100"
          - "172.16.10.31:9100"
          - "172.16.10.32:9100"
        labels:
          env: lab
```

Validate and reload without restarting:

```bash
promtool check config /etc/prometheus/prometheus.yml
curl -X POST http://localhost:9090/-/reload
```

Expected output: `promtool` prints `SUCCESS`; the reload call returns nothing (HTTP 204 — silence is success).

**Checkpoint:** node metrics scraped.

```bash
curl -s 'http://localhost:9090/api/v1/query?query=up%7Bjob%3D%22node%22%7D' | python3 -m json.tool
```

Expected output: one result object per target, each with `"value": [<timestamp>, "1"]`. A `"0"` means Prometheus can reach the box but not port 9100 — check `systemctl status node_exporter` on that host before moving on.

---

## Phase 3 — PromQL: rates, percentages, and prediction

Open `http://172.16.10.40:9090/graph` for all of these, or use the `api/v1/query` endpoint like above.

**Per-core idle rate** (raw building block):

```promql
rate(node_cpu_seconds_total{mode="idle"}[5m])
```

**CPU utilization percentage**, averaged per instance — this is the number you actually care about:

```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

**Disk-fill prediction** — extrapolate the last hour of free-space trend 4 hours forward; a negative result means the filesystem is projected to hit zero before then:

```promql
predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600) < 0
```

**[lab-mon01]** — turn the two most useful expressions into a recording rule so dashboards and alerts query a precomputed, cheap metric instead of re-running the raw expression every time. Full file, `/etc/prometheus/rules/node_recording.rules.yml`:

```yaml
groups:
  - name: node_recording_rules
    interval: 30s
    rules:
      - record: instance:node_cpu_utilisation:rate5m
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

      - record: instance:node_filesystem_avail_bytes:predict4h
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600)
```

`rule_files` already points at `/etc/prometheus/rules/*.rules.yml` from Phase 1, so this file is picked up automatically.

```bash
sudo chown prometheus:prometheus /etc/prometheus/rules/node_recording.rules.yml
promtool check rules /etc/prometheus/rules/node_recording.rules.yml
curl -X POST http://localhost:9090/-/reload
```

Expected output: `promtool` prints `SUCCESS`.

**Checkpoint:**

```bash
curl -s 'http://localhost:9090/api/v1/query?query=instance:node_cpu_utilisation:rate5m' | python3 -m json.tool
```

Expected output: one result per scraped instance with a numeric CPU percentage value. Do not continue to Phase 4 if this is empty — recording rules need at least one `evaluation_interval` to have passed since reload; wait 30s and retry before assuming it's broken.

---

## Phase 4 — Alertmanager

**[lab-mon01]** — create the service user and install the binary:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin alertmanager
sudo mkdir -p /etc/alertmanager /var/lib/alertmanager
cd /tmp
curl -LO https://github.com/prometheus/alertmanager/releases/download/v0.27.0/alertmanager-0.27.0.linux-amd64.tar.gz
tar xzf alertmanager-0.27.0.linux-amd64.tar.gz
cd alertmanager-0.27.0.linux-amd64
sudo cp alertmanager amtool /usr/local/bin/
sudo chown alertmanager:alertmanager /usr/local/bin/alertmanager /usr/local/bin/amtool /var/lib/alertmanager
```

**[lab-mon01]** — full route/receiver config, `/etc/alertmanager/alertmanager.yml`, routing to the Mission 05 Postfix relay:

```yaml
global:
  smtp_smarthost: 'lab-mail01.lab.local:25'
  smtp_from: 'alertmanager@lab.local'
  smtp_require_tls: false

route:
  receiver: lab-email
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h

receivers:
  - name: lab-email
    email_configs:
      - to: 'alice@lab.local'
        send_resolved: true
```

`group_wait` is why a test alert takes ~30 seconds to actually land — Alertmanager waits briefly to batch related alerts into one email instead of spamming one per firing rule. `send_resolved: true` gets you a second email when the condition clears, which matters for the prove-it drill later.

```bash
sudo chown alertmanager:alertmanager /etc/alertmanager/alertmanager.yml
```

**[lab-mon01]** — systemd unit, `/etc/systemd/system/alertmanager.service`:

```ini
[Unit]
Description=Prometheus Alertmanager
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=alertmanager
Group=alertmanager
ExecStart=/usr/local/bin/alertmanager \
  --config.file=/etc/alertmanager/alertmanager.yml \
  --storage.path=/var/lib/alertmanager \
  --web.listen-address=0.0.0.0:9093
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now alertmanager
sudo systemctl status alertmanager --no-pager
```

Expected output: `Active: active (running)`.

**[lab-mon01]** — point Prometheus at Alertmanager and add the alert rules. Append to `/etc/prometheus/prometheus.yml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["localhost:9093"]
```

Full alert rules file, `/etc/prometheus/rules/alerts.rules.yml`:

```yaml
groups:
  - name: lab_alerts
    rules:
      - alert: DiskWillFillIn4Hours
        expr: predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600) < 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "{{ $labels.instance }} disk will fill within 4 hours"
          description: "Root filesystem on {{ $labels.instance }} is projected to run out of space in under 4 hours, based on the last hour's fill rate."

      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "{{ $labels.job }} target {{ $labels.instance }} is down"
          description: "Prometheus has been unable to scrape {{ $labels.instance }} (job {{ $labels.job }}) for at least 2 minutes."
```

The `for:` durations matter more than they look — `ServiceDown` waits 2 minutes so a single missed scrape doesn't page anyone, and `DiskWillFillIn4Hours` waits 10 minutes so one noisy write burst doesn't trigger a false prediction. Phase break-fix drill 2 shows you exactly what happens if you skip this.

```bash
sudo chown prometheus:prometheus /etc/prometheus/rules/alerts.rules.yml
promtool check rules /etc/prometheus/rules/alerts.rules.yml
curl -X POST http://localhost:9090/-/reload
```

Expected output: `SUCCESS` from `promtool`.

**Checkpoint:** test alert reaches inbox.

```bash
amtool alert add alertname=TestAlert severity=warning instance=manual-test --alertmanager.url=http://localhost:9093
```

Wait about 30 seconds (`group_wait`), then check the mailbox on `lab-mail01`:

```bash
ssh labadmin@172.16.10.31 "sudo ls -t /home/alice/Maildir/new/ | head -1"
```

Expected output: a filename (a long dotted timestamp string) with a modification time in the last minute. Do not continue to Phase 5 if nothing new appears — check `sudo mailq` on `lab-mail01` and `journalctl -u alertmanager -n 50` on `lab-mon01` for the SMTP rejection reason before assuming it's a config typo.

---

## Phase 5 — Grafana

**[lab-mon01]** — add the Grafana apt repo and install:

```bash
sudo apt-get install -y apt-transport-https software-properties-common wget gnupg
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install -y grafana
sudo systemctl enable --now grafana-server
sudo systemctl status grafana-server --no-pager
```

Expected output: `Active: active (running)`.

**[lab-mon01]** — provision the Prometheus datasource instead of clicking it in manually, `/etc/grafana/provisioning/datasources/prometheus.yaml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: false
```

```bash
sudo systemctl restart grafana-server
```

Log into `http://172.16.10.40:3000` (default `admin`/`admin`, it'll force a password change on first login). Go to **Connections → Data sources → Prometheus** and click **Save & test** — expected: green `Data source is working`.

**[Grafana UI]** — import the community node-exporter dashboard by ID:

1. **Dashboards → New → Import**
2. Enter `1860` in the "Import via grafana.com" field, click **Load**
3. On the next screen, set the **Prometheus** dropdown to the datasource you just provisioned
4. Click **Import**

Expected: a dashboard titled "Node Exporter Full" opens showing CPU, memory, disk, and network panels for every scraped host — pick any host from the dropdown at the top and confirm the graphs are not blank.

**[Grafana UI]** — now build your own 4-panel dashboard, **Dashboards → New → New Dashboard → Add visualization**, datasource Prometheus for every panel:

**Panel 1 — "CPU Utilization %"** (Time series)
- Query: `instance:node_cpu_utilisation:rate5m`
- Legend: `{{instance}}`
- Unit: Percent (0-100)

**Panel 2 — "Memory Used %"** (Time series)
- Query: `100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))`
- Legend: `{{instance}}`
- Unit: Percent (0-100)

**Panel 3 — "Root Disk Free %"** (Stat)
- Query: `100 * (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})`
- Thresholds: red below 10, yellow below 25, green above
- This is a Stat panel, not a time series — you want the current number per host, not a graph

**Panel 4 — "Firing Alerts"** (Table)
- Query: `ALERTS{alertstate="firing"}`
- Query type: Instant (not range) — table panels showing alert state want the current snapshot, not a time series
- Instance/alertname/severity columns come from the metric's labels automatically

Save the dashboard as **"Lab Overview"**.

**Checkpoint:** dashboards render. Open both "Node Exporter Full" and "Lab Overview", set the time range to "Last 15 minutes", and confirm every panel shows a live line, bar, or number — no panel says "No data". If a panel is blank, check the query against `http://172.16.10.40:9090/graph` directly first; a query that returns nothing in Prometheus will never render in Grafana either.

---

## Phase 6 — Loki + promtail: centralized logs

**[lab-mon01]** — create the service user and directories, install Loki:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin loki
sudo mkdir -p /etc/loki /var/lib/loki
cd /tmp
curl -LO https://github.com/grafana/loki/releases/download/v3.1.1/loki-linux-amd64.zip
sudo apt-get install -y unzip
unzip loki-linux-amd64.zip
sudo mv loki-linux-amd64 /usr/local/bin/loki
sudo chmod +x /usr/local/bin/loki
sudo chown -R loki:loki /etc/loki /var/lib/loki
```

**[lab-mon01]** — full Loki config, `/etc/loki/loki-config.yaml` (single-binary mode, local filesystem storage — plenty for a lab):

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  path_prefix: /var/lib/loki
  storage:
    filesystem:
      chunks_directory: /var/lib/loki/chunks
      rules_directory: /var/lib/loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

limits_config:
  retention_period: 168h
```

```bash
sudo chown loki:loki /etc/loki/loki-config.yaml
```

**[lab-mon01]** — systemd unit, `/etc/systemd/system/loki.service`:

```ini
[Unit]
Description=Loki Log Aggregation
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=loki
Group=loki
ExecStart=/usr/local/bin/loki -config.file=/etc/loki/loki-config.yaml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now loki
sudo systemctl status loki --no-pager
```

Expected output: `Active: active (running)`.

**[lab-mon01]** — write the promtail installer once, then push it to every target VM, same pattern as node_exporter. `/root/install-promtail.sh`:

```bash
#!/bin/bash
set -euo pipefail
VERSION=3.1.1
sudo mkdir -p /etc/promtail /var/lib/promtail
cd /tmp
curl -LO "https://github.com/grafana/loki/releases/download/v${VERSION}/promtail-linux-amd64.zip"
sudo apt-get install -y unzip || sudo dnf install -y unzip
unzip -o promtail-linux-amd64.zip
sudo mv promtail-linux-amd64 /usr/local/bin/promtail
sudo chmod +x /usr/local/bin/promtail

sudo tee /etc/promtail/promtail-config.yaml >/dev/null <<'CFG'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /var/lib/promtail/positions.yaml

clients:
  - url: http://172.16.10.40:3100/loki/api/v1/push

scrape_configs:
  - job_name: journal
    journal:
      max_age: 12h
      labels:
        job: systemd-journal
    relabel_configs:
      - source_labels: ['__journal__systemd_unit']
        target_label: unit
      - source_labels: ['__journal__hostname']
        target_label: host
CFG

sudo tee /etc/systemd/system/promtail.service >/dev/null <<'EOF'
[Unit]
Description=Promtail Log Shipper
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/promtail -config.file=/etc/promtail/promtail-config.yaml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now promtail
echo "promtail installed and shipping logs from $(hostname)"
```

```bash
chmod +x /root/install-promtail.sh
for h in 172.16.10.21 172.16.10.30 172.16.10.31 172.16.10.32; do
  echo "== $h =="
  scp /root/install-promtail.sh labadmin@${h}:/tmp/
  ssh labadmin@${h} "chmod +x /tmp/install-promtail.sh && sudo /tmp/install-promtail.sh"
done
```

Expected output: each host ends with `promtail installed and shipping logs from <hostname>`.

**[lab-mon01]** — LogQL: all journal lines from any host, most recent first (also add a Loki datasource in Grafana the same way you added Prometheus if you want to run these from Explore instead of the CLI):

```logql
{job="systemd-journal"}
```

Scoped to one host:

```logql
{job="systemd-journal", host="lab-mail01"}
```

**Error-rate query** — lines per second containing "error", per host, over a 5-minute window:

```logql
sum(rate({job="systemd-journal"} |= "error" [5m])) by (host)
```

Install a Loki CLI on `lab-mon01` for a quick command-line checkpoint:

```bash
curl -LO https://github.com/grafana/loki/releases/download/v3.1.1/logcli-linux-amd64.zip
unzip -o logcli-linux-amd64.zip
sudo mv logcli-linux-amd64 /usr/local/bin/logcli
```

**Checkpoint:** logs queryable.

```bash
logcli --addr=http://localhost:3100 query '{job="systemd-journal"}' --limit=5
```

Expected output: the 5 most recent journal lines across all shipping hosts, each prefixed with a timestamp and the source labels. Do not continue to Phase 7 if this returns nothing — check `systemctl status promtail` on a target VM and `journalctl -u loki -n 50` on `lab-mon01` for a push rejection.

---

## Phase 7 — Runbooks

A runbook exists so that whoever is on call — including future you, at 3am, half-asleep — doesn't have to reconstruct the reasoning from scratch. Template:

```markdown
# Runbook: <ALERT_NAME>

**Severity:** <critical|warning>
**Trigger condition:** <exact PromQL expression from the alert rule>

## Symptom
What the on-call person actually sees: the alert email subject/body, which
Grafana panel goes red, what a user might report.

## Diagnosis
Step-by-step commands to confirm what's really wrong, in the order to run
them, with what "bad" output looks like for each.

## Fix
Step-by-step commands to resolve it, in order.

## Verification
The exact query or command to run afterward, and what output means "fixed."

## Escalation
Who or what to contact if the fix steps don't resolve it within <N> minutes.
```

**`DiskFull` runbook**, filled in:

```markdown
# Runbook: DiskWillFillIn4Hours

**Severity:** warning
**Trigger condition:** predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600) < 0

## Symptom
Email from alertmanager@lab.local, subject line mentions "DiskWillFillIn4Hours",
body names the affected instance. Grafana "Lab Overview" Panel 3 (Root Disk
Free %) shows the same host trending toward red.

## Diagnosis
1. SSH to the named instance.
2. `df -h /` — confirm current usage and how much is actually left.
3. `du -sh /var/log /var/lib /home/* 2>/dev/null | sort -rh | head -10` —
   find what's actually growing. Don't guess; the biggest consumer is
   rarely what you expect.
4. `sudo journalctl --disk-usage` — journald logs are a common silent
   offender.

## Fix
1. If it's log growth: `sudo journalctl --vacuum-time=2d` and/or
   `sudo find /var/log -name "*.log.*" -mtime +7 -delete`.
2. If it's a specific runaway file (e.g. a test artifact, a core dump,
   a stuck download): remove it directly once you've confirmed it's
   safe to delete.
3. If it's genuine organic growth: this is a capacity problem, not an
   incident — file a follow-up to grow the disk, don't just delete
   real data to buy time.

## Verification
`df -h /` shows usage back under 80%. Re-run the prediction query directly:
`predict_linear(node_filesystem_avail_bytes{mountpoint="/"}[1h], 4*3600)`
should be positive (or the alert should already show `resolved` in
Alertmanager's UI at :9093).

## Escalation
If usage is still climbing after the fix within 15 minutes, or you can't
identify what's consuming space, escalate to whoever owns the workload
running on that host before deleting anything you're not sure about.
```

**`ServiceDown` runbook**, filled in:

```markdown
# Runbook: ServiceDown

**Severity:** critical
**Trigger condition:** up == 0 for 2m

## Symptom
Email from alertmanager@lab.local, subject line mentions "ServiceDown",
body names the job and instance. The "Firing Alerts" panel on "Lab
Overview" shows the row. The host's panels on "Node Exporter Full" stop
updating (flatline, not zero — the exporter itself isn't answering).

## Diagnosis
1. From lab-mon01: `curl -v http://<instance>:9100/metrics` (or the
   relevant exporter port) — does it connect at all?
2. If connection refused: SSH to the instance,
   `systemctl status node_exporter` (or the down service's unit).
3. If SSH itself fails: this is a host-down problem, not a
   service-down problem — check the VM's state in Hyper-V Manager
   before anything else.
4. If SSH works but the unit is dead: `journalctl -u node_exporter -n 50`
   for the crash reason.

## Fix
1. `sudo systemctl restart node_exporter` (or the affected unit).
2. If it immediately dies again, read the journal output from the
   diagnosis step — a config error or port conflict won't fix itself
   on retry.
3. If the host itself is down: start it from Hyper-V Manager, then
   confirm the target service comes up on boot
   (`systemctl is-enabled node_exporter` should say `enabled`).

## Verification
`curl -s 'http://localhost:9090/api/v1/query?query=up{instance="<instance>:9100"}'`
on lab-mon01 returns value `1`. The Alertmanager UI at :9093 shows the
alert moved to resolved, and (if send_resolved fired) a resolution email
arrives.

## Escalation
If the unit won't stay up after two restart attempts, or the host won't
boot, escalate before spending more than 15 minutes guessing — capture
the journal output first, it's the evidence whoever picks this up next
will need.
```

---

## Break-fix drills

Diagnose from the symptom before opening the hints. State what you observe, form a hypothesis, test it, then fix.

**Drill 1 — Scrape target silently dropped by a bad relabel config**

Ask Claude, in this session, to add a `relabel_configs` block under the `node` job in `prometheus.yml` that uses a `drop` action with a regex matching one specific target's address, then reload Prometheus.

Symptom: `/targets` shows fewer targets than expected for the `node` job, with no error anywhere — Prometheus doesn't consider a relabel-dropped target a failure, it just never shows up. Diagnose why a target that scrapes fine manually (`curl http://<ip>:9100/metrics`) never appears in Prometheus's target list.

**Drill 2 — Alert flapping from a missing `for:` duration**

Ask Claude to edit `ServiceDown` in `alerts.rules.yml` to remove the `for: 2m` line entirely (so it fires the instant `up == 0` is true on any single scrape), reload, then briefly stop `node_exporter` on one target for under a minute and restart it.

Symptom: you get an alert email, then almost immediately a resolved email, then it fires again on the next transient blip — alert state flaps in Alertmanager's UI. Diagnose what `for:` actually does to the alert state machine and why removing it changes behavior.

**Drill 3 — Cardinality explosion from a label on a per-request metric**

Ask Claude to add a small script or cron job on one target VM that appends a fake metric with a high-cardinality label to a Prometheus textfile-collector directory (e.g. a label like `request_id` set to a new random value every few seconds), and confirm node_exporter's textfile collector is enabled and pointed at that directory.

Symptom: Prometheus memory usage on `lab-mon01` climbs steadily and query performance degrades, with no code change to anything you configured earlier. Diagnose using Prometheus's own internal metrics — `prometheus_tsdb_head_series` and `prometheus_tsdb_symbol_table_size_bytes` on `http://localhost:9090/graph` — to find which metric or label is responsible before touching anything.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `promtool check config` will not catch this — a `drop` relabel is valid config, just aggressive. Compare the full target list Prometheus's service discovery found (before relabeling) against what actually appears at `/targets`.
- Drill 2: read the Prometheus alerting docs' state machine — `pending` vs `firing`. A rule with no `for:` skips the `pending` state entirely; that's the whole difference.
- Drill 3: query `topk(10, count by (__name__)(prometheus_tsdb_head_series))`-style breakdowns aren't built in, but `count(count by (__name__)({__name__=~".+"}))` and comparing metric-by-metric series counts will point at the offender fast — it's the one whose series count is climbing every scrape instead of staying flat.

</details>

---

## Prove-it: disk-fill alert, resolved from the runbook alone, in 20 minutes

Pick a random target VM (have Claude roll one from your target list if you want it truly blind). Start a timer, then:

1. **[chosen VM]** — fill the disk fast enough to trip the prediction window realistically:

```bash
fallocate -l 5G /tmp/bigfile-$(date +%s)
df -h /
```

Repeat with additional files if 5G doesn't move the needle enough on that VM's disk size — the goal is a fill rate steep enough that `predict_linear` over the last hour projects zero free space within 4 hours.

2. Wait for the `DiskWillFillIn4Hours` alert to reach `alice@lab.local`'s Maildir on `lab-mail01` (allow for the rule's `for: 10m` plus `group_wait: 30s`).

3. The moment the email lands, open **only the `DiskFull` runbook you wrote in Phase 7** — no re-reading this guide, no re-deriving the diagnosis from scratch. Follow it step by step: identify the growth (`du -sh` per the runbook), remove the fallocated file(s), verify with `df -h /` and the resolved state in Alertmanager's UI.

4. Stop the timer once Alertmanager shows the alert resolved (and, if `send_resolved` is working, the resolution email arrives).

**Target:** under 20 minutes from email received to alert resolved. If the runbook was missing a step you needed, that's a real finding — go back and fix the runbook, not just the disk.

---

## Done when

- [ ] Prometheus runs as a systemd service on `lab-mon01` and scrapes itself plus every target VM (`up == 1` for all)
- [ ] Recording rules file loads cleanly (`promtool check rules` passes) and `instance:node_cpu_utilisation:rate5m` returns live data
- [ ] Alertmanager is running, routes through the lab SMTP relay, and a manually-fired test alert reaches the inbox
- [ ] `DiskWillFillIn4Hours` and `ServiceDown` alert rules are live with correct `for:` durations
- [ ] Grafana is running, the Prometheus datasource is provisioned (not clicked in by hand), and both the imported node-exporter-full dashboard and the self-built "Lab Overview" 4-panel dashboard render live data with no blank panels
- [ ] Loki and promtail are running; `logcli query '{job="systemd-journal"}'` returns real log lines from more than one host
- [ ] The error-rate LogQL query returns a result (even if `0`) for every shipping host
- [ ] Both `DiskFull` and `ServiceDown` runbooks are written and would make sense to someone who wasn't in this session
- [ ] All three break-fix drills reproduced, diagnosed, and fixed
- [ ] The prove-it drill completed inside 20 minutes, using only the written runbook, with the resolved state confirmed in Alertmanager
