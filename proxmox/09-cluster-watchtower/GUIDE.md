# Guide — Mission 09: Cluster Watchtower

This is not a script to paste blindly — this is a live company cluster. Read each phase, run the commands, and look at the actual output before moving on.

Conventions used throughout, carried forward from Missions 01, 03, 05, and 06, plus the ones this mission adds:

```
Resource pool                    : learning
VM ID range                      : 9000-9999
Dedicated bridge                  : vmbr-lab
Lab subnet                       : 10.10.100.0/24
PVE node management IPs           : 10.10.10.11 (pve1), 10.10.10.12 (pve2), 10.10.10.13 (pve3)
PVE API token                    : learn@pve!tf
PBS VM / datastore (Mission 05)   : pbs1, 10.10.100.5:8007, datastore learning-ds1
Tag on every object               : learning

New this mission:
LearningMonitorRole (PVE, read-only)  : Sys.Audit, Datastore.Audit — granted at / to learn@pve!tf, in ADDITION to its existing pool-scoped LearningRole grant
PBS monitor token                     : learn@pbs!monitor, role Audit, granted at /
prometheus-pve-exporter                : port 9221
PBS metrics bridge (json_exporter)     : port 7979
HA-status shim (pve_ha_resource_state) : port 9222, runs on one PVE node
Fresh monitoring VM (if you build one)  : VMID 9109, name mon1, 10.10.100.109
Grafana dashboard imported by ID        : 10347 ("Proxmox via Prometheus")
```

Every node is written as `pve1`, `pve2`, `pve3` below — substitute your cluster's real node names. Wherever a step runs "on the monitoring host," that's whichever machine ends up running Prometheus/Grafana/Alertmanager — Phase 3 walks you through deciding whether that's a new VM or an existing one.

**Read this once before Phase 1 — a deliberate, documented exception to Mission 01's pool boundary.** `learn@pve!tf` was scoped in Mission 01 to see and touch only the `learning` pool, and Mission 01's prove-it drill confirmed it's blind to everything else. A cluster monitoring tool's entire job is the opposite of that: it needs to see node health, storage usage, and HA state across the *whole* cluster, because that's what "cluster watchtower" means. Phase 1 grants this same token one narrow, read-only, cluster-wide addition — `Sys.Audit` and `Datastore.Audit` at `/` — and nothing else. It still cannot create, modify, start, stop, or migrate anything outside `learning`; it can only look. This is a conscious widening of scope, not scope creep, and it needs to be written down: add a line to your Mission 01 safety doc noting this grant, what it covers, and why, before you run the command in Phase 1. If you're not comfortable widening this token's scope even for read-only audit access, the alternative is a second, brand-new token (e.g. `learn@pve!monitor`) carrying only this grant — functionally equivalent, just a different token to track. Either is fine; pick one and write down which.

---

## Phase 1 — prometheus-pve-exporter

### Grant the audit scope

**[ANY-NODE]** — create the read-only, cluster-wide monitoring role and grant it to the existing token, at the root path (not the pool — this is the one grant in this mission's setup that deliberately isn't pool-scoped, per the note above):

```bash
pveum role add LearningMonitorRole -privs "Sys.Audit,Datastore.Audit"
pveum acl modify / --roles LearningMonitorRole --tokens 'learn@pve!tf'
```

Expected output: no output on success. Confirm:

```bash
pveum acl list | grep LearningMonitorRole
```

Expected output: a line showing `/`, `learn@pve!tf`, `LearningMonitorRole`. Note what this does and doesn't change: `VM.*` privileges are still granted only at `/pool/learning` from Mission 01, so this token still cannot see or touch any VM outside the pool — `Sys.Audit`/`Datastore.Audit` at `/` only grants read-only visibility into node and storage-level state, which is exactly the shape "monitor the whole cluster, touch none of it" needs.

### Install the exporter

**[MONITORING-HOST]** — service account, venv, install:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin pve-exporter
sudo mkdir -p /etc/pve-exporter /opt/pve-exporter
sudo python3 -m venv /opt/pve-exporter/venv
sudo /opt/pve-exporter/venv/bin/pip install prometheus-pve-exporter
```

Expected output: pip resolves and installs cleanly, ending `Successfully installed prometheus-pve-exporter-...`. Confirm the binary:

```bash
sudo /opt/pve-exporter/venv/bin/pve_exporter --version
```

Expected output: a version string.

**[MONITORING-HOST]** — config, `/etc/pve-exporter/pve.yml` (the token secret is the same UUID you saved back in Mission 01 when you ran `pveum user token add learn@pve tf --privsep 1`):

```yaml
default:
  user: learn@pve
  token_name: tf
  token_value: <token-secret-from-mission-01>
  verify_ssl: false
```

```bash
sudo chown -R pve-exporter:pve-exporter /etc/pve-exporter /opt/pve-exporter
sudo chmod 600 /etc/pve-exporter/pve.yml
```

**[MONITORING-HOST]** — systemd unit, `/etc/systemd/system/pve-exporter.service`:

```ini
[Unit]
Description=Prometheus exporter for Proxmox VE
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=pve-exporter
Group=pve-exporter
ExecStart=/opt/pve-exporter/venv/bin/pve_exporter --config.file=/etc/pve-exporter/pve.yml --web.listen-address=0.0.0.0:9221
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pve-exporter
sudo systemctl status pve-exporter --no-pager
```

Expected output: `Active: active (running)`.

**Checkpoint:** query it directly before wiring Prometheus to it — this proves the token and exporter work together, independent of any Prometheus config:

```bash
curl -s 'http://localhost:9221/pve?target=10.10.10.11' | grep pve_up
```

Expected output: a line like `pve_up{id="node/pve1"} 1.0`. If you get an empty response or an error body instead, don't move on — that's break-fix drill 1 below, not a typo to shrug off.

### Scrape config

This YAML gets added to whichever `prometheus.yml` Phase 3 decides on — write it down now, apply it once that decision is made:

```yaml
- job_name: pve
  metrics_path: /pve
  params:
    module: [default]
  scrape_interval: 15s
  scrape_timeout: 10s
  static_configs:
    - targets:
        - 10.10.10.11   # pve1
        - 10.10.10.12   # pve2
        - 10.10.10.13   # pve3
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: <monitoring-host-ip>:9221
```

Read the relabel block before treating it as boilerplate: Prometheus thinks it's scraping `10.10.10.11`, `.12`, `.13` directly, but the actual HTTP request always goes to the exporter's own address (`<monitoring-host-ip>:9221`) — the node IP gets smuggled in as a `target` query parameter instead, which is what lets one exporter process answer for every node while Prometheus still labels each result with the right `instance`. The 15s scrape interval (rather than a default 60s) is deliberate — it's half of what makes the sub-minute detection deliverable achievable later; `for:` durations on the alert side do the rest.

### HA-status bridge

`prometheus-pve-exporter` reports node, VM, and storage state well, but it doesn't surface `ha-manager`'s own resource state machine (`started`/`error`/`fence`/`recovery` — the same states Mission 06 Phase 3 introduced). `HAResourceError` in Phase 5 needs that state as a metric, so build a small, honest bridge for it rather than pretending the main exporter covers it.

**[one PVE node — pick any; call it out in your notes]** — venv and a ~30-line script:

```bash
sudo mkdir -p /opt/pve-ha-exporter
sudo python3 -m venv /opt/pve-ha-exporter/venv
sudo /opt/pve-ha-exporter/venv/bin/pip install prometheus_client
```

`/opt/pve-ha-exporter/pve_ha_exporter.py`:

```python
#!/usr/bin/env python3
import subprocess, json, time
from prometheus_client import start_http_server, Gauge

STATE = Gauge(
    "pve_ha_resource_state",
    "HA resource state (value is always 1; the current state is a label, not the value)",
    ["sid", "state"],
)

def poll():
    seen = set()
    try:
        out = subprocess.check_output(
            ["ha-manager", "status", "--output-format", "json"], text=True
        )
        for entry in json.loads(out):
            if entry.get("type") == "service":
                sid = entry["id"]
                state = entry.get("status", entry.get("state", "unknown"))
                STATE.labels(sid=sid, state=state).set(1)
                seen.add((sid, state))
    except Exception as e:
        print(f"pve-ha-exporter: poll failed: {e}")
    return seen

if __name__ == "__main__":
    start_http_server(9222)
    prev = set()
    while True:
        cur = poll()
        for sid, state in prev - cur:
            STATE.remove(sid, state)
        prev = cur
        time.sleep(15)
```

If your Proxmox version's `ha-manager` doesn't accept `--output-format json`, swap the `subprocess.check_output` line for `pvesh get /cluster/ha/status/current --output-format json` instead — same data, reached through the API layer rather than the CLI tool directly.

**[same node]** — systemd unit, `/etc/systemd/system/pve-ha-exporter.service`:

```ini
[Unit]
Description=HA-status bridge for ha-manager status
After=network-online.target pve-cluster.service

[Service]
Type=simple
ExecStart=/opt/pve-ha-exporter/venv/bin/python3 /opt/pve-ha-exporter/pve_ha_exporter.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pve-ha-exporter
curl -s http://localhost:9222/metrics | grep pve_ha_resource_state
```

Expected output: one `pve_ha_resource_state{sid="vm:...",state="started"} 1.0` line per HA-managed resource (skip this check if you haven't done Mission 06 yet — there's nothing for `ha-manager` to report, and that's fine for now).

**A single point of failure, called out on purpose:** `ha-manager status` reflects the whole cluster's state from any member node, so this only needs to run on one node — but if that specific node is the one that gets fenced, this metric goes stale at exactly the moment you'd want it most. That's a real, honest trade-off, not a bug you missed: Prometheus's own `up{job="pve_ha"}` for this target going to `0` is itself a useful signal in that scenario (it tells you "the HA state view just went blind," which is worth knowing even without knowing *why* HA state changed). For real resilience, run this same service on two nodes and scrape both as separate targets — left as an optional improvement, not required for this mission's deliverables.

Add its scrape job wherever Phase 3 lands the config:

```yaml
- job_name: pve_ha
  scrape_interval: 15s
  static_configs:
    - targets:
        - 10.10.10.11:9222   # whichever node runs the shim
```

**Checkpoint:** `curl -s 'http://localhost:9221/pve?target=10.10.10.11' | grep pve_up` returns `1.0` for every node in your cluster, one at a time; `pve-exporter.service` and `pve-ha-exporter.service` are both `active (running)`; and you've written the audit-scope exception into your Mission 01 safety doc, not just run the command.

---

## Phase 2 — PBS metrics

*Skip this phase if Mission 05 isn't done yet — there's no PBS datastore to point at. Come back once it is; `BackupTooOld` in Phase 5 depends on this phase's metric existing.*

PBS's REST API is the "built-in metrics endpoint" here — datastore usage and per-snapshot backup timestamps are both already exposed through it, authenticated the same way `curl` tested it back in Mission 05. There's no native Prometheus text-format endpoint on PBS itself, so bridge the JSON it already returns using `json_exporter` (`prometheus-community/json_exporter`) rather than inventing a bespoke scraper.

### PBS token

**[PBS, pbs1]** — a new token under the same `learn@pbs` user Mission 05 already created, scoped read-only this time (Mission 05's `pve-sync` token stays as-is; this is a separate token for a separate purpose, same one-token-one-job habit that track has used throughout):

```bash
proxmox-backup-manager user generate-token learn@pbs monitor
proxmox-backup-manager acl update / Audit --auth-id 'learn@pbs!monitor'
```

Expected output: `generate-token` prints a JSON block with a `"value"` field — the token secret, shown once, copy it now. `acl update` is silent on success. Confirm:

```bash
proxmox-backup-manager acl list | grep learn@pbs!monitor
```

Expected output: a line showing `/`, `learn@pbs!monitor`, `Audit`.

### json_exporter

**[MONITORING-HOST]** — install:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin json-exporter
cd /tmp
curl -LO https://github.com/prometheus-community/json_exporter/releases/download/v0.7.0/json_exporter-0.7.0.linux-amd64.tar.gz
tar xzf json_exporter-0.7.0.linux-amd64.tar.gz
sudo cp json_exporter-0.7.0.linux-amd64/json_exporter /usr/local/bin/
sudo mkdir -p /etc/json_exporter
sudo chown json-exporter:json-exporter /usr/local/bin/json_exporter
```

`/etc/json_exporter/config.yml` — two modules, one for datastore usage, one for per-snapshot backup timestamps (adjust JSONPath syntax slightly if your `json_exporter` version's dialect differs — the structure below matches the documented format):

```yaml
modules:
  pbs_datastore_usage:
    headers:
      Authorization: "PBSAPIToken=learn@pbs!monitor=<pbs-monitor-token-secret>"
    metrics:
      - name: pbs_datastore_total_bytes
        type: object
        path: "{.data[*]}"
        help: Total bytes on a PBS datastore
        labels:
          store: "{.store}"
        values:
          value: "{.total}"
      - name: pbs_datastore_used_bytes
        type: object
        path: "{.data[*]}"
        help: Used bytes on a PBS datastore
        labels:
          store: "{.store}"
        values:
          value: "{.used}"

  pbs_backup_snapshots:
    headers:
      Authorization: "PBSAPIToken=learn@pbs!monitor=<pbs-monitor-token-secret>"
    metrics:
      - name: pbs_backup_last_time_seconds
        type: object
        path: "{.data[*]}"
        help: backup-time epoch per snapshot entry (take max by backup_id in PromQL for "most recent")
        labels:
          backup_type: "{.backup-type}"
          backup_id: "{.backup-id}"
        values:
          value: "{.backup-time}"
```

**[MONITORING-HOST]** — systemd unit, `/etc/systemd/system/json-exporter.service`:

```ini
[Unit]
Description=json_exporter (PBS metrics bridge)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=json-exporter
Group=json-exporter
ExecStart=/usr/local/bin/json_exporter --config.file=/etc/json_exporter/config.yml --web.listen-address=:7979
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown json-exporter:json-exporter /etc/json_exporter/config.yml
sudo chmod 600 /etc/json_exporter/config.yml
sudo systemctl daemon-reload
sudo systemctl enable --now json-exporter
```

Expected output: `Active: active (running)`.

**Checkpoint** — test both modules manually before wiring Prometheus to them:

```bash
curl -s 'http://localhost:7979/probe?module=pbs_datastore_usage&target=https://10.10.100.5:8007/api2/json/status/datastore-usage'
curl -s 'http://localhost:7979/probe?module=pbs_backup_snapshots&target=https://10.10.100.5:8007/api2/json/admin/datastore/learning-ds1/snapshots'
```

Expected output: each returns Prometheus text-format metrics — `pbs_datastore_total_bytes{store="learning-ds1"} ...` from the first, `pbs_backup_last_time_seconds{backup_type="vm",backup_id="9101"} ...` (one line per snapshot) from the second. An empty body or an HTTP error here means the token/ACL didn't take — re-check `proxmox-backup-manager acl list` before touching the scrape config.

### Scrape config

```yaml
- job_name: pbs_datastore
  metrics_path: /probe
  params:
    module: [pbs_datastore_usage]
  static_configs:
    - targets:
        - https://10.10.100.5:8007/api2/json/status/datastore-usage
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: <monitoring-host-ip>:7979

- job_name: pbs_backups
  metrics_path: /probe
  params:
    module: [pbs_backup_snapshots]
  scrape_interval: 5m
  static_configs:
    - targets:
        - https://10.10.100.5:8007/api2/json/admin/datastore/learning-ds1/snapshots
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: <monitoring-host-ip>:7979
```

The snapshots job scrapes every 5 minutes rather than the default — a datastore with months of history returns a lot of rows, and backup age doesn't change fast enough to need 15-second freshness.

**Checkpoint:** both jobs will show as `UP` in `/targets` once Phase 3's Prometheus instance actually has this config loaded — hold that check until then. For now, confirm the two manual `curl` probes above both returned real data, not an error body.

---

## Phase 3 — Prometheus: reuse or fresh

Two legitimate paths here — pick based on what you actually have, not on which sounds more impressive:

| Situation | Correct choice |
|---|---|
| sysops/06 (All-Seeing Eye) is already built, **and** its lab network can route to `10.10.100.0/24` and to each PVE node's management IP (`10.10.10.0/24`) | Reuse `lab-mon01`'s existing Prometheus — add Phase 1 and Phase 2's scrape jobs to its `/etc/prometheus/prometheus.yml`, alongside whatever it already scrapes |
| sysops/06 isn't done, or its lab network is isolated/NATed away from the Proxmox cluster's networks | Stand up a fresh Prometheus VM inside the `learning` pool, via the Mission 03 `pve-vm` Terraform module |
| Both exist and are reachable, but you'd rather keep this mission's monitoring blast radius fully inside the `learning` pool, independent of the sysops lab | Stand up the fresh VM anyway — that's a legitimate reason even when reuse is technically possible |

### Option A — reuse sysops/06's Prometheus

**[lab-mon01]** — confirm reachability first, before editing anything:

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://10.10.100.5:8007
nc -zv 10.10.10.11 8006
```

Expected output: `200` from the first (PBS's web UI, proving the route to the Proxmox lab subnet exists), `Connection ... succeeded!` from the second (proving the route to a PVE node's management IP exists). If either fails, stop and use Option B instead — don't try to force routing between two lab networks that were never designed to talk to each other.

Append Phase 1's `pve` and `pve_ha` jobs and Phase 2's `pbs_datastore`/`pbs_backups` jobs (filling in `<monitoring-host-ip>` as `lab-mon01`'s own address) to `/etc/prometheus/prometheus.yml`'s `scrape_configs:` list, then:

```bash
promtool check config /etc/prometheus/prometheus.yml
curl -X POST http://localhost:9090/-/reload
```

Expected output: `promtool` prints `SUCCESS`; the reload returns nothing (HTTP 204).

### Option B — fresh Prometheus VM via the Mission 03 module

**[workstation, Terraform working dir from Mission 03]** — add an entry to the existing `fleet` module call:

```hcl
module "fleet" {
  source = "./modules/pve-vm"

  vms = {
    # ...whatever entries already exist from earlier missions...
    mon1 = {
      node_name = "pve1"
      vm_id     = 9109
      ip        = "10.10.100.109"
      tags      = ["learning", "monitoring"]
    }
  }
}
```

```bash
terraform apply
```

Expected output: `Plan: 1 to add` (more if this is your very first apply of the fleet module), ending `Apply complete!`. Confirm:

```bash
qm status 9109
```

Expected output: `status: running`.

**[mon1, 10.10.100.109]** — Prometheus install is identical to sysops/06 Phase 1 — service user, binary, minimal self-scrape config, systemd unit:

```bash
sudo useradd --no-create-home --shell /usr/sbin/nologin prometheus
sudo mkdir -p /etc/prometheus /etc/prometheus/rules /var/lib/prometheus
cd /tmp
curl -LO https://github.com/prometheus/prometheus/releases/download/v3.1.0/prometheus-3.1.0.linux-amd64.tar.gz
tar xzf prometheus-3.1.0.linux-amd64.tar.gz
cd prometheus-3.1.0.linux-amd64
sudo cp prometheus promtool /usr/local/bin/
sudo cp -r consoles console_libraries /etc/prometheus/
sudo chown -R prometheus:prometheus /etc/prometheus /var/lib/prometheus
```

`/etc/prometheus/prometheus.yml`:

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
  # Phase 1's pve and pve_ha jobs go here, <monitoring-host-ip> = 10.10.100.109
  # Phase 2's pbs_datastore and pbs_backups jobs go here, same host
```

`/etc/systemd/system/prometheus.service`:

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

```bash
sudo chown prometheus:prometheus /etc/prometheus/prometheus.yml
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus
```

Expected output: `Active: active (running)`. Also install `pve-exporter`, `pve-ha-exporter`, and `json-exporter` from Phase 1/2 directly on `mon1` if you didn't already stand them up elsewhere — `<monitoring-host-ip>` throughout this guide is `10.10.100.109` for this option.

**Checkpoint (either option):**

```bash
curl -s http://<monitoring-host-ip>:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
```

Expected output: `"health":"up"` for every target — `prometheus` (self), `pve` (one per node), `pve_ha`, `pbs_datastore`, and `pbs_backups` (the last two only if Mission 05 is done). Also open `http://<monitoring-host-ip>:9090/targets` in a browser and confirm the same visually. Do not continue to Phase 4 with any target showing `down` — check the relevant exporter's own `curl` checkpoint from Phase 1/2 first.

---

## Phase 4 — Grafana

**[MONITORING-HOST]** — install (identical to sysops/06 Phase 5 if you're reusing that box; run it fresh on `mon1` otherwise):

```bash
sudo apt-get install -y apt-transport-https software-properties-common wget gnupg
sudo mkdir -p /etc/apt/keyrings/
wget -q -O - https://apt.grafana.com/gpg.key | gpg --dearmor | sudo tee /etc/apt/keyrings/grafana.gpg > /dev/null
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install -y grafana
sudo systemctl enable --now grafana-server
```

Expected output: `Active: active (running)`. Skip this whole install block if you're reusing sysops/06's `lab-mon01` and Grafana is already running there — just add a Prometheus datasource pointed at your Proxmox-side Prometheus if it's a different instance than the one Grafana already talks to.

Provisioned datasource, `/etc/grafana/provisioning/datasources/prometheus-pve.yaml`:

```yaml
apiVersion: 1

datasources:
  - name: Proxmox Prometheus
    type: prometheus
    access: proxy
    url: http://<monitoring-host-ip>:9090
    isDefault: false
    editable: false
```

```bash
sudo systemctl restart grafana-server
```

Log into Grafana, **Connections → Data sources → Proxmox Prometheus → Save & test** — expected: green `Data source is working`.

### Import the community dashboard

1. **Dashboards → New → Import**
2. Enter `10347` in the "Import via grafana.com" field, click **Load**. This ID ("Proxmox via Prometheus") is the most widely used community dashboard built specifically for `prometheus-pve-exporter`'s metric names. If it's moved or been superseded by the time you're reading this, search grafana.com/dashboards for "proxmox prometheus-pve-exporter" and use whichever result matches your exporter's actual metric names — the import mechanic below is identical regardless of which ID you land on.
3. Set the datasource dropdown to **Proxmox Prometheus**, click **Import**.

Expected: a dashboard opens showing per-node CPU, memory, disk, and network panels. Pick a node from the dropdown and confirm the graphs aren't blank.

### Build your own 6-panel dashboard

**Dashboards → New → New Dashboard → Add visualization**, datasource **Proxmox Prometheus** for every panel below. Save it as **"Cluster Watchtower"**.

**Panel 1 — "Per-Node CPU %"** (Time series)
```promql
avg by (id) (pve_cpu_usage_ratio{id=~"node/.+"}) * 100
```
Legend: `{{id}}`. Unit: Percent (0-100).

**Panel 2 — "Per-Node Memory %"** (Time series)
```promql
(pve_memory_usage_bytes{id=~"node/.+"} / pve_memory_size_bytes{id=~"node/.+"}) * 100
```
Legend: `{{id}}`. Unit: Percent (0-100).

**Panel 3 — "Storage Usage %"** (Stat)
```promql
(pve_disk_usage_bytes{id=~"storage/.+"} / pve_disk_size_bytes{id=~"storage/.+"}) * 100
```
Thresholds: green below 70, yellow below 80, red at 80+ — matching the `StorageAbove80` alert threshold in Phase 5 on purpose, so the panel and the alert never disagree about what "too full" means.

**Panel 4 — "VM Count by Node"** (Bar gauge or Stat)
```promql
count by (node) (pve_guest_info{type="qemu"})
```
This counts every guest `prometheus-pve-exporter` can see, which — because of the audit scope from Phase 1 — means every VM cluster-wide, not just the `learning` pool. That's expected and correct for a *node capacity* panel; it's a different question from "what VMs does my token own."

**Panel 5 — "Backup Age (hours)"** (Table or Stat) — skip if Mission 05 isn't done:
```promql
(time() - max by (backup_id) (pbs_backup_last_time_seconds{backup_type="vm"})) / 3600
```
Thresholds: green below 24, yellow below 26, red at 26+ — again matching `BackupTooOld`'s threshold.

**Panel 6 — "HA Resource State"** (Table) — skip if Mission 06 isn't done:
```promql
pve_ha_resource_state
```
Query type: Instant, not range — same reasoning as sysops/06's "Firing Alerts" panel: you want the current state snapshot, not a time series. `sid` and `state` columns come from the metric's labels automatically; a row with `state="error"` is the thing this panel exists to catch at a glance.

**Checkpoint:** both dashboards render with the time range set to "Last 15 minutes" — no panel says "No data" (Panels 5/6 are expected to be genuinely empty, not erroring, if Missions 05/06 aren't done yet — empty is fine, broken is not). If a panel is blank when its prerequisite mission *is* done, check the query directly against `http://<monitoring-host-ip>:9090/graph` first — a query with no results in Prometheus will never render in Grafana either.

---

## Phase 5 — Alert rules

**Read this before you copy the file below.** `PVENodeDown`'s `for: 1m` is a debounce against a single missed scrape, not the moment of detection — Prometheus already knows a target went down within one `scrape_interval` (15s, per Phase 1), which is the "sub-minute detection" the README's deliverable is actually about. `for: 1m` is a separate, deliberate decision to wait a further 60 seconds of *sustained* failure before treating it as worth waking someone up over, exactly like `ServiceDown`'s `for: 2m` in sysops/06. The prove-it section's "under 60 seconds to the delivery channel" is measured from the alert's `firing` transition (visible with a timestamp in Prometheus's own `/alerts` page) to the message landing in the inbox or chat — not from the instant the node actually went down. Conflating those two clocks is the single most common way to misjudge whether this deliverable is actually met; keep them separate when you time the prove-it drill.

**[MONITORING-HOST]** — full rules file, `/etc/prometheus/rules/cluster_watchtower.rules.yml`, verbatim:

```yaml
groups:
  - name: cluster_watchtower_alerts
    rules:
      - alert: PVENodeDown
        expr: up{job="pve"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Proxmox node {{ $labels.instance }} is unreachable"
          description: "prometheus-pve-exporter has been unable to reach {{ $labels.instance }} for at least 1 minute. This does not by itself mean the node is fenced or down — confirm with pvecm status before assuming a hardware failure."

      - alert: StorageAbove80
        expr: (pve_disk_usage_bytes{id=~"storage/.+"} / pve_disk_size_bytes{id=~"storage/.+"}) * 100 > 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Storage {{ $labels.id }} is above 80% used"
          description: "{{ $labels.id }} has been over 80% utilized for at least 10 minutes."

      - alert: BackupTooOld
        expr: (time() - max by (backup_id) (pbs_backup_last_time_seconds{backup_type="vm"})) > 26 * 3600
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "VM {{ $labels.backup_id }} has no successful backup in over 26 hours"
          description: "The most recent PBS snapshot for VM {{ $labels.backup_id }} on learning-ds1 is more than 26 hours old. Nightly backups run at 02:00 per proxmox/05 Phase 3 — a single missed night should not trip this, but two in a row will."

      - alert: HAResourceError
        expr: pve_ha_resource_state{state="error"} == 1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "HA resource {{ $labels.sid }} is in error state"
          description: "ha-manager reports {{ $labels.sid }} in state 'error' for at least 2 minutes — the CRM has exhausted its automatic restart/relocate attempts and will not act on this resource again without a human acknowledgement."
```

```bash
sudo chown prometheus:prometheus /etc/prometheus/rules/cluster_watchtower.rules.yml
promtool check rules /etc/prometheus/rules/cluster_watchtower.rules.yml
curl -X POST http://localhost:9090/-/reload
```

Expected output: `promtool` prints `SUCCESS`.

**Checkpoint:**

```bash
curl -s http://localhost:9090/api/v1/rules | python3 -m json.tool | grep '"name"'
```

Expected output: all four alert names appear (`PVENodeDown`, `StorageAbove80`, `BackupTooOld`, `HAResourceError`), each currently in state `inactive` (nothing is broken yet — that's correct). If `BackupTooOld` or `HAResourceError` show a Prometheus rule *evaluation* error rather than just `inactive`, that means the underlying metric doesn't exist at all yet (Mission 05/06 not done) — that's expected and not a bug; it becomes a real problem only once you've completed that mission and the metric still doesn't show up.

---

## Phase 6 — Delivery: email or Telegram

Alertmanager needs installing regardless of which delivery channel you pick — do this once:

**[MONITORING-HOST]**

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

`/etc/systemd/system/alertmanager.service`:

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

Point Prometheus at it — append to `/etc/prometheus/prometheus.yml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ["localhost:9093"]
```

Both routing trees below share the same shape on purpose: a fast lane (`group_wait: 10s`) for `severity: critical` (`PVENodeDown`, `HAResourceError`), a normal lane (`group_wait: 30s`) for everything else (`StorageAbove80`, `BackupTooOld`). That split is what makes the sub-60-second prove-it achievable without also spamming you the instant any warning-level alert so much as blinks.

### Option A — email via company SMTP

`/etc/alertmanager/alertmanager.yml`:

```yaml
global:
  smtp_smarthost: 'smtp.company.local:587'
  smtp_from: 'pve-alerts@company.local'
  smtp_auth_username: 'pve-alerts@company.local'
  smtp_auth_password: '<smtp-relay-secret>'
  smtp_require_tls: true

route:
  receiver: default-email
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
  routes:
    - matchers:
        - severity="critical"
      receiver: critical-email
      group_wait: 10s
      group_interval: 1m
      repeat_interval: 1h

receivers:
  - name: default-email
    email_configs:
      - to: 'you@company.local'
        send_resolved: true
  - name: critical-email
    email_configs:
      - to: 'you@company.local'
        send_resolved: true
```

### Option B — Telegram bot

Create a bot via `@BotFather` in Telegram (`/newbot`, save the token it gives you), start a chat with it, then get your numeric chat ID (`https://api.telegram.org/bot<token>/getUpdates` after sending it any message shows `"chat":{"id": ...}`).

`/etc/alertmanager/alertmanager.yml`:

```yaml
route:
  receiver: default-telegram
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 3h
  routes:
    - matchers:
        - severity="critical"
      receiver: critical-telegram
      group_wait: 10s
      group_interval: 1m
      repeat_interval: 1h

receivers:
  - name: default-telegram
    telegram_configs:
      - bot_token: '<bot-token-from-botfather>'
        chat_id: <numeric-chat-id>
        parse_mode: 'HTML'
        send_resolved: true
  - name: critical-telegram
    telegram_configs:
      - bot_token: '<bot-token-from-botfather>'
        chat_id: <numeric-chat-id>
        parse_mode: 'HTML'
        send_resolved: true
```

Pick one option, not both — a single `alertmanager.yml` with one routing tree is the whole point.

```bash
sudo chown alertmanager:alertmanager /etc/alertmanager/alertmanager.yml
sudo systemctl daemon-reload
sudo systemctl enable --now alertmanager
curl -X POST http://localhost:9090/-/reload
```

Expected output: `Active: active (running)` for `alertmanager`; the Prometheus reload returns nothing (HTTP 204).

**Checkpoint:** fire a manual test alert on the critical route and confirm it lands fast:

```bash
amtool alert add alertname=TestCriticalAlert severity=critical instance=manual-test --alertmanager.url=http://localhost:9093
```

Expected output: within about 10-15 seconds (the critical route's `group_wait`), a message arrives — an email, or a Telegram message from your bot. If nothing arrives within a minute, this is break-fix drill 3 below, not something to keep restarting Alertmanager over.

---

## Phase 7 — Runbook stubs

Same template Mission sysops/06 used — the point of a runbook is that whoever's on call doesn't have to re-derive the reasoning from scratch:

```markdown
# Runbook: <ALERT_NAME>

**Severity:** <critical|warning>
**Trigger condition:** <exact PromQL expression from the alert rule>

## Symptom
What the on-call person actually sees.

## Diagnosis
Step-by-step commands to confirm what's really wrong, in order.

## Fix
Step-by-step commands to resolve it, in order.

## Verification
The exact query or command to run afterward, and what output means "fixed."

## Escalation
Who or what to contact if the fix steps don't resolve it within <N> minutes.
```

**`PVENodeDown`, filled in:**

```markdown
# Runbook: PVENodeDown

**Severity:** critical
**Trigger condition:** up{job="pve"} == 0 for 1m

## Symptom
Alert names the unreachable node's management IP as `instance`. The
"Per-Node CPU %"/"Per-Node Memory %" panels on Cluster Watchtower flatline
for that node.

## Diagnosis
1. From any surviving node: `pvecm status` — is the node still listed in
   the membership table? Is the cluster still `Quorate: Yes`?
2. `ping <node-ip>` and `curl -sk https://<node-ip>:8006` — is the node
   reachable at all, or just unreachable to the exporter specifically?
3. If the node responds to ping/HTTPS but the exporter still can't reach
   it: `systemctl status pveproxy` on that node — a stopped `pveproxy`
   explains an exporter-side outage with the node otherwise fine.

## Fix
1. If `pveproxy` died: `systemctl restart pveproxy` on the affected node.
2. If the node is genuinely down or unresponsive: this is now a Mission 06
   scenario, not a monitoring problem — follow the HA failure-drill
   reasoning (quorum math, fencing) rather than trying to "fix" the alert
   itself.
3. Do not restart the exporter or Prometheus as a first move — confirm
   which side (node vs. exporter vs. network path) actually failed before
   touching anything.

## Verification
`curl -s 'http://localhost:9090/api/v1/query?query=up{job="pve",instance="<node-ip>"}'`
returns value `1`. The alert shows resolved in Alertmanager's UI at :9093.

## Escalation
If the node doesn't rejoin within 15 minutes, or `pvecm status` shows the
surviving nodes no longer quorate, stop diagnosing alone and pull in
whoever else has cluster admin — a non-quorate cluster is a genuine
incident, not a solo fix.
```

**`StorageAbove80`, filled in:**

```markdown
# Runbook: StorageAbove80

**Severity:** warning
**Trigger condition:** (pve_disk_usage_bytes / pve_disk_size_bytes) * 100 > 80 for 10m

## Symptom
Alert names the storage `id` (e.g. `storage/local-lvm`). "Storage Usage %"
panel on Cluster Watchtower shows that storage in the red threshold band.

## Diagnosis
1. `pvesm status` on any node — confirm current usage matches what the
   alert reported.
2. Identify what's actually consuming space: for LVM/dir storage,
   `du -sh` against the storage's mount point per VM/CT disk image;
   for Ceph, `ceph df` for pool-level usage.
3. Check for orphaned data specifically: old ISO uploads, leftover
   snapshot chains, or a failed clone that left a partial disk behind.

## Fix
1. Remove anything genuinely disposable (old ISOs, orphaned disk images
   not attached to any current VM/CT — confirm with `qm list`/`pct list`
   before deleting anything).
2. If nothing is disposable: this is real growth, not an incident — file
   a follow-up to grow the storage, the same distinction sysops/06's
   DiskFull runbook draws.

## Verification
`pvesm status` shows usage back under 80%. The alert shows resolved in
Alertmanager's UI.

## Escalation
If usage keeps climbing after cleanup and no owner is identifiable for
what's consuming space, escalate before deleting anything you're not
fully sure is safe to remove.
```

**`BackupTooOld`, filled in:**

```markdown
# Runbook: BackupTooOld

**Severity:** warning
**Trigger condition:** (time() - max by (backup_id) (pbs_backup_last_time_seconds)) > 26h for 15m

## Symptom
Alert names the affected `backup_id` (VMID). "Backup Age (hours)" panel on
Cluster Watchtower shows that VM in the red threshold band.

## Diagnosis
1. On pbs1: `proxmox-backup-manager task list --limit 20` — did the
   scheduled `learning-nightly` job (Mission 05 Phase 3) actually run,
   and did it succeed or fail?
2. If it ran and failed: read the task's own log
   (`proxmox-backup-manager task log <upid>`) for the actual error —
   don't guess.
3. If it never ran at all: check the job's schedule is still enabled
   (`pvesh get /cluster/backup`) — a schedule can get silently disabled
   by an unrelated config change.
4. Confirm the VM itself is reachable and the guest agent is running —
   Mission 05 break-fix drill 1 covers exactly this failure mode.

## Fix
1. Run the backup job manually for the affected VM:
   `vzdump <vmid> --storage pbs-learning --mode snapshot`.
2. If it fails the same way manually, fix the underlying cause identified
   in Diagnosis (guest agent, storage space on PBS, network path to
   pbs1) before re-running, not instead of it.

## Verification
`pvesm list pbs-learning --content backup | grep <vmid>` shows a new
snapshot with today's timestamp. Re-run the PromQL expression directly
and confirm it's back under 26h. Alert shows resolved in Alertmanager.

## Escalation
If two consecutive scheduled runs fail for the same VM, escalate — a
VM with no working backup for 48+ hours is a real gap, not a monitoring
false positive.
```

**`HAResourceError`, filled in:**

```markdown
# Runbook: HAResourceError

**Severity:** critical
**Trigger condition:** pve_ha_resource_state{state="error"} == 1 for 2m

## Symptom
Alert names the affected `sid` (e.g. `vm:9301`). "HA Resource State" panel
on Cluster Watchtower shows that row with `state=error`.

## Diagnosis
1. `ha-manager status` — confirm the resource is really in `error`, not a
   transient `recovery` state that resolved between the metric's last
   scrape and now.
2. Confirm the VM's actual runtime state directly, don't assume:
   `qm status <vmid>` on whichever node it's currently assigned to (or
   `qm list | grep <vmid>` cluster-wide if you're not sure which node).
3. Read recent CRM decisions for this resource:
   `journalctl -u pve-ha-crm --since "-30min" | grep <sid>`.

## Fix
An `error` state means the CRM has deliberately stopped acting on this
resource on its own — per Mission 06 Phase 3, this is intentional, not a
bug, because guessing wrong here risks a duplicate-running-VM situation.
1. Confirm from step 2 above whether the VM is actually stopped or
   actually running somewhere.
2. Use `ha-manager set <sid> --state <started|disabled>` to give the CRM
   a clean state to reason from again, matching whichever runtime state
   you just confirmed — do not guess this from the alert alone.
3. Watch `ha-manager status` for the resource to leave `error` state
   within a minute or two of the `ha-manager set` command.

## Verification
`ha-manager status` shows the resource `started` (or deliberately
`disabled`, if that's what you set), not `error`. Alert shows resolved
in Alertmanager.

## Escalation
If the resource won't leave `error` state after one `ha-manager set`
attempt, stop and get a second person's eyes on it before trying again —
this is exactly the scenario Mission 06 Phase 6 warns can lead to two
copies of the same VM running if handled carelessly.
```

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools from the phases above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — the exporter returns 401

Setup: revoke the audit grant from Phase 1 (`pveum acl modify / --roles LearningMonitorRole --tokens 'learn@pve!tf' --delete`, or just remove the `LearningMonitorRole` line entirely), then hit the exporter directly:

```bash
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:9221/pve?target=10.10.10.11'
```

Expected symptom: `401`, and Prometheus's `/targets` page shows the `pve` job's targets in `DOWN` state with a "server returned HTTP status 401" error, even though the exporter service itself is `active (running)` and the PVE node it's targeting is completely healthy.

<details>
<summary>Hint</summary>

The exporter process being up and the *token* being able to authenticate are two different facts — a 401 here means the request reached Proxmox's API and was rejected, not that the exporter or the network path is broken. `pveum acl list` shows you exactly what's currently granted to `learn@pve!tf` and at what path; compare it against what Phase 1 actually set up. Consider, too, which specific privilege each metric needs — `Sys.Audit` covers node-level state, `Datastore.Audit` covers storage, and neither substitutes for the other if only one got revoked.

</details>

### Drill 2 — all targets show up, but node metrics are frozen

Setup: introduce artificial latency between the exporter host and one PVE node so the exporter's request to that node's API times out internally while it's still able to answer Prometheus's own scrape with an HTTP 200 (using previously cached values, or an incomplete response it doesn't treat as a hard failure):

```bash
# on the exporter host, throttle traffic to one node's management IP
sudo tc qdisc add dev eth0 root netem delay 3000ms
```

(Reverse with `sudo tc qdisc del dev eth0 root netem` when you're done — don't leave this running, it affects all traffic on that interface, not just the one you're testing against.)

Expected symptom: Prometheus's `/targets` page keeps showing the `pve` job's target for that node as `UP` — the scrape itself succeeds — but the actual metric *values* for that node (CPU, memory, uptime) stop changing between scrapes, visible as a flat, unchanging line in Grafana even while other nodes' panels keep moving.

<details>
<summary>Hint</summary>

`up == 1` only proves the exporter answered Prometheus's HTTP request — it says nothing about whether the exporter's own upstream call to the Proxmox API inside that request actually succeeded fresh, or returned something stale. Compare `scrape_duration_seconds` for this target against the others in Prometheus's own metrics (`http://<host>:9090/graph`, query `scrape_duration_seconds{job="pve"}`) — a target silently struggling internally often shows a duration close to the exporter's own request timeout, not a fast normal response. Check both ends: whether `prometheus-pve-exporter` (or the version you installed) exposes any configurable request timeout, and separately whether the `pve` job's own `scrape_timeout` in `prometheus.yml` (Phase 1 set 10s) is generous enough for a request that has to round-trip Prometheus → exporter → Proxmox API → back, twice over if there's any retry behavior involved.

</details>

### Drill 3 — an alert fires in Prometheus but no message arrives

Setup: introduce a routing mismatch on purpose — change one alert rule's `severity` label (e.g. edit `HAResourceError`'s `labels.severity` from `critical` to `Critical`, capitalized) and reload, or fire a manual test alert with a label the routing tree's matchers don't actually expect:

```bash
amtool alert add alertname=DrillTestAlert team=platform --alertmanager.url=http://localhost:9093
```

Expected symptom: Prometheus's `/alerts` page shows the alert `firing` with a real timestamp; Alertmanager's own UI at `:9093` shows it was received. No email or Telegram message ever arrives, and nothing in either UI screams "error" — it just silently doesn't reach a receiver that actually delivers anything.

<details>
<summary>Hint</summary>

`amtool config routes test` (with the alert's actual label set passed as arguments) tells you exactly which receiver Alertmanager's routing tree resolves a given set of labels to — run it with the labels this drill's alert actually carries, and compare the receiver it names against the receiver you expected and against what that receiver is actually configured to do. Matchers are exact-string, case-sensitive comparisons, not fuzzy matching — a label value that looks "close enough" to a human eye is not the same string to Alertmanager's routing tree. Also check whether the route that catches this alert is the top-level default route rather than your intended child route — silently falling through to a route you forgot even has a receiver attached is a different failure than a receiver that's misconfigured.

</details>

---

## Prove-it: sub-60-second delivery, timestamped

**Part 1 — required.** Take one node's exporter target down gracefully — not the real node, just its monitoring path:

```bash
# on the target PVE node
sudo systemctl stop pveproxy
```

Note the wall-clock time. Watch Prometheus's `/alerts` page for `PVENodeDown` to transition from nothing → `pending` → `firing` (this takes at least the `for: 1m` duration once the scrape genuinely starts failing) and note the exact `firing` timestamp shown in the UI. Then watch your delivery channel (inbox or Telegram) for the message and note its arrival timestamp.

```bash
# restore it once you've captured what you need
sudo systemctl start pveproxy
```

**Measure the gap between the `firing` timestamp and the message-arrival timestamp — that gap is what must be under 60 seconds**, not the gap from `systemctl stop` to message arrival (that larger number includes the deliberate `for: 1m` debounce from Phase 5, which is supposed to take about a minute on its own). Take a screenshot showing both timestamps side by side — Prometheus's `/alerts` page (or Alertmanager's `/#/alerts` UI, which also shows a `startsAt` timestamp) next to your email client or Telegram chat.

**Part 2 — only if Mission 06 is done, and only in an agreed maintenance window.** Repeat the same measurement against a real node failure, reusing Mission 06 Phase 5's fencing drill in full — every one of that drill's six safety preconditions still applies here, this mission doesn't relax any of them. Time the same gap: `firing` timestamp to message-arrival timestamp. This proves the alert path holds up against an actual hard node reset, not just a stopped service standing in for one.

**Checkpoint:** a screenshot exists showing the `firing` timestamp and the delivery-channel arrival timestamp for Part 1, with a gap under 60 seconds. If Mission 06 is done, a second screenshot exists for Part 2's real-node drill, measured the same way.

---

## Done when

- [ ] `LearningMonitorRole` (`Sys.Audit,Datastore.Audit` at `/`) is granted to `learn@pve!tf`, and this exception to the Mission 01 pool boundary is written into your safety doc
- [ ] `prometheus-pve-exporter` and the HA-status shim are both running and return real data via direct `curl` checks against every node
- [ ] (If Mission 05 is done) the PBS `learn@pbs!monitor` token exists, and both `json_exporter` modules return real data via direct `curl` checks
- [ ] Prometheus (reused or fresh, per your own documented decision) shows every configured target `UP`
- [ ] Both the imported community dashboard (ID 10347 or equivalent) and the self-built "Cluster Watchtower" 6-panel dashboard render live data
- [ ] All four alert rules (`PVENodeDown`, `StorageAbove80`, `BackupTooOld`, `HAResourceError`) load cleanly (`promtool check rules` passes) and show in Prometheus's `/rules`
- [ ] Alertmanager is running with one delivery channel (email or Telegram) configured, and a manual test alert on the critical route reached that channel
- [ ] All four runbooks are written and would make sense to someone who wasn't in this session
- [ ] All three break-fix drills reproduced, diagnosed from the symptom, and fixed before opening the hints
- [ ] Prove-it complete: Part 1's screenshot shows a firing-to-delivery gap under 60 seconds; Part 2's real-node screenshot exists if Mission 06 is done
