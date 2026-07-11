# Guide — Mission 07: Doomsday Drill

Lab systems referenced this mission (all built in earlier missions, plus one new VM):

```
lab-dns1.lab.local     172.16.10.11   Ubuntu 24.04   bind9 authoritative DNS (Mission 04)
lab-web01.lab.local    172.16.10.30   Ubuntu 24.04   private CA + nginx reverse proxy (Mission 05)
lab-mail01.lab.local   172.16.10.31   Ubuntu 24.04   Postfix + Dovecot + OpenDKIM (Mission 05)
lab-ipa01.lab.local    172.16.10.32   Rocky 9        FreeIPA server (Mission 05)
lab-mon01.lab.local    172.16.10.40   Ubuntu 24.04   Prometheus + Alertmanager + Grafana + Loki (Mission 06)
lab-backup01.lab.local 172.16.10.41   Ubuntu 24.04   NEW this mission — dedicated restic/SFTP backup target
```

Every command states its machine: **[HOST]** = Windows PowerShell (admin), **[lab-xxx]** = bash inside that guest. Wherever you see `<REPO_PASSWORD>`, pick your own and use it consistently — don't reuse a real password.

---

## Phase 0 — Setup check

Confirm the systems this mission depends on are actually up before you design a policy around them.

**[HOST]** — confirm every source VM is running:

```powershell
Get-VM lab-dns1, lab-web01, lab-mail01, lab-ipa01, lab-mon01 | Select-Object Name, State
```

Expected output: all five rows show `State : Running`. Start any that are off before continuing.

**[HOST]** — confirm Mission 06's Alertmanager is reachable (needed for Phase 3 onward):

```powershell
Invoke-WebRequest -Uri "http://172.16.10.40:9093/-/healthy" -UseBasicParsing
```

Expected output: `StatusCode : 200`, content `Healthy`. If this fails, go finish Mission 06 first — the alert-integration phases of this mission assume a live Alertmanager.

**Checkpoint:** all five source VMs `Running`, Alertmanager returns `200 Healthy`. Do not continue to Phase 1 if either check fails.

---

## Phase 1 — Backup policy worksheet (before touching any tooling)

Every real backup program starts as a policy decision, not a `cron` line. Write this worksheet out — as a file on your workstation, or in this repo under `sysops/07-doomsday-drill/policy.md` — before Phase 2. You'll be graded against it in the destroy-and-restore drill later, so be honest about the numbers: an RTO you can't actually hit is worse than no RTO.

**RPO** (Recovery Point Objective) — how much data can you afford to lose, measured in time since the last good backup. A nightly backup at 02:00 gives you an RPO of up to 24h.

**RTO** (Recovery Time Objective) — how long you're allowed to be down before the system is restored and validated working again.

Fill in one row per system:

| System | Role | Data vs. Config | RPO | RTO | Justification |
|---|---|---|---|---|---|
| `lab-dns1` | Authoritative DNS | Config only (zone files) | 24h | 15 min | Every other lab system resolves through it; small dataset, fast restore, but blast radius if down is total |
| `lab-web01` | Private CA + nginx | Config + CA private key material | 24h | 30 min | CA key loss breaks every cert in the lab; nginx config is small but load-bearing |
| `lab-mail01` | Postfix/Dovecot mail | Config + user Maildir data | 24h | 45 min | Mailboxes are real data (mail people wrote); losing config also breaks DKIM signing |
| `lab-ipa01` | FreeIPA identity | Config + directory data (users, groups, Kerberos keys) | 24h | 60 min | Hardest to rebuild from scratch — re-enrolling every client after a bare reinstall costs far more than 60 min |
| `lab-mon01` | Prometheus/Grafana/Alertmanager | Config + dashboards (metrics history is disposable) | 24h | 30 min | Losing a day of metrics history is acceptable; losing alert routing config is not |

Adjust the numbers to your own judgment, but keep the same shape: every row needs a data-vs-config call, because that decision changes what you actually put in the `restic backup` command in Phase 2 — full data directories cost more repo space and restore time than config alone, and mail/IPA data can't be treated as disposable the way metrics history can.

**Checkpoint:** you have a filled-in table (five systems, five RPO/RTO pairs, five justifications) and you can explain out loud why `lab-ipa01` gets the longest RTO. Do not start Phase 2 without this — the excludes you write in Phase 2 are a direct translation of this table.

---

## Phase 2 — restic: repository, SFTP target, first backup

### Build the backup VM

**[HOST]** — clone `lab-backup01` from the Ubuntu template per the Mission 01 clone checklist (regenerate machine-id, SSH host keys, hostname, static IP `172.16.10.41`):

```powershell
Copy-Item "D:\HyperV\tpl-ubuntu2404\tpl-ubuntu2404.vhdx" "D:\HyperV\lab-backup01\lab-backup01.vhdx"
New-VM -Name "lab-backup01" -Generation 2 -MemoryStartupBytes 2GB -VHDPath "D:\HyperV\lab-backup01\lab-backup01.vhdx" -SwitchName "LabSwitch"
Set-VMFirmware -VMName "lab-backup01" -EnableSecureBoot Off
Start-VM -Name "lab-backup01"
```

Expected output: `Get-VM lab-backup01` shows `State : Running`.

**[lab-dns1]** — add the forward record, bump the SOA serial, reload:

```bash
echo "lab-backup01  IN A    172.16.10.41" | sudo tee -a /etc/bind/zones/db.lab.local
sudo named-checkzone lab.local /etc/bind/zones/db.lab.local
sudo rndc reload lab.local
```

Expected: `named-checkzone` prints `OK`; `rndc reload` prints `zone lab.local/IN: reloaded`.

### SFTP-only backup target

**[lab-backup01]** — create a dedicated, restricted user for restic's SFTP access and the repo storage directory:

```bash
sudo useradd -m -s /usr/sbin/nologin resticsftp
sudo mkdir -p /srv/restic-repos/{lab-dns1,lab-web01,lab-mail01,lab-ipa01,lab-mon01}
sudo chown -R resticsftp:resticsftp /srv/restic-repos
sudo mkdir -p /home/resticsftp/.ssh
sudo chmod 700 /home/resticsftp/.ssh
sudo chown resticsftp:resticsftp /home/resticsftp/.ssh
```

**[lab-backup01]** — lock the account to SFTP-only in `/etc/ssh/sshd_config` (append):

```
Match User resticsftp
    ForceCommand internal-sftp
    ChrootDirectory /srv/restic-repos
    PasswordAuthentication no
    X11Forwarding no
    AllowTcpForwarding no
```

```bash
sudo systemctl restart ssh
```

Expected: `systemctl restart ssh` returns with no error; `sudo systemctl status ssh --no-pager` shows `active (running)`.

**[each of lab-dns1, lab-web01, lab-mail01, lab-ipa01, lab-mon01]** — generate a dedicated backup SSH key as root (no passphrase, so unattended backups can run) and push it to `lab-backup01`:

```bash
sudo ssh-keygen -t ed25519 -f /root/.ssh/id_restic -N "" -C "$(hostname)-restic"
sudo cat /root/.ssh/id_restic.pub
```

Copy each printed key into `lab-backup01`'s authorized_keys for `resticsftp` (one line per host):

**[lab-backup01]**:

```bash
sudo tee -a /home/resticsftp/.ssh/authorized_keys <<< "<paste each host's public key, one per line>"
sudo chmod 600 /home/resticsftp/.ssh/authorized_keys
sudo chown resticsftp:resticsftp /home/resticsftp/.ssh/authorized_keys
```

Confirm the DNS record from any source host, then test SFTP-only login (should refuse a shell but accept SFTP):

**[lab-web01]**:

```bash
sudo ssh -i /root/.ssh/id_restic -o BatchMode=yes resticsftp@lab-backup01.lab.local echo hi
```

Expected output: `This service allows sftp connections only.` (the connection is refused for a shell — that's correct, it proves `ForceCommand internal-sftp` is active) followed by the SSH session closing. Note `-o BatchMode=yes` — this is not optional; without it, a key rejection prompts for a password and *hangs* instead of failing fast. Remember this for Phase 3.

### First repository and backup

**[lab-web01]** — initialize a restic repository over SFTP, using the dedicated key:

```bash
export RESTIC_REPOSITORY="sftp:resticsftp@lab-backup01.lab.local:/srv/restic-repos/lab-web01"
export RESTIC_PASSWORD="<REPO_PASSWORD>"
sudo -E restic init -o sftp.command="ssh -i /root/.ssh/id_restic -o BatchMode=yes resticsftp@lab-backup01.lab.local -s sftp"
```

Expected output: `created restic repository xxxxxxxxxx at sftp:resticsftp@lab-backup01.lab.local:/srv/restic-repos/lab-web01`.

Now move the secrets into the env-file pattern instead of shell exports — this is what every script and systemd unit in this mission will source. **[lab-web01]** — `/etc/restic/lab-web01.env`:

```bash
RESTIC_REPOSITORY=sftp:resticsftp@lab-backup01.lab.local:/srv/restic-repos/lab-web01
RESTIC_PASSWORD=<REPO_PASSWORD>
RESTIC_SFTP_COMMAND=ssh -i /root/.ssh/id_restic -o BatchMode=yes resticsftp@lab-backup01.lab.local -s sftp
```

```bash
sudo chmod 600 /etc/restic/lab-web01.env
sudo chown root:root /etc/restic/lab-web01.env
```

**[lab-web01]** — run a real backup by hand, translating Phase 1's data-vs-config call into excludes (config plus the CA material, minus logs and caches):

```bash
set -a; source /etc/restic/lab-web01.env; set +a
sudo -E restic backup /etc /var/www \
  -o sftp.command="$RESTIC_SFTP_COMMAND" \
  --exclude=/etc/ssl/lab-ca/csr \
  --exclude-caches \
  --tag lab-web01
```

Expected output ends with a summary block: `Files: N new, 0 changed, 0 unmodified` and `snapshot xxxxxxxx saved`.

**[lab-web01]** — verify:

```bash
sudo -E restic snapshots -o sftp.command="$RESTIC_SFTP_COMMAND"
sudo -E restic check -o sftp.command="$RESTIC_SFTP_COMMAND"
```

Expected: `snapshots` lists one row with today's date and the `lab-web01` tag; `check` ends with `no errors were found`.

Repeat repo init + first backup for the other four hosts, adjusting paths per Phase 1's worksheet:

- `lab-dns1`: `/etc/bind`
- `lab-mail01`: `/etc/postfix /etc/dovecot /etc/opendkim /home/*/Maildir`
- `lab-ipa01`: `/etc/ipa /etc/sssd /var/lib/ipa /var/lib/dirsrv --exclude=/var/lib/dirsrv/*/log`
- `lab-mon01`: `/etc/prometheus /etc/alertmanager /etc/grafana /var/lib/grafana /etc/loki`

**Checkpoint:** `restic snapshots` on all five repos shows at least one snapshot each, and `restic check` reports `no errors were found` on all five. Do not continue to Phase 3 until every repo passes `check` — an unverified repo is not a backup.

---

## Phase 3 — Nightly systemd timer + alert integration

### The backup wrapper script

**[each source VM]** — `/usr/local/bin/lab-backup.sh` (identical script, per-host behavior comes entirely from the env file):

```bash
#!/bin/bash
set -euo pipefail
ENV_FILE="/etc/restic/$(hostname).env"
set -a; source "$ENV_FILE"; set +a

HOSTNAME_TAG="$(hostname)"
METRIC_FILE="/var/lib/node_exporter/textfile_collector/lab_backup.prom"
METRIC_TMP="$(mktemp)"

# Optional pre-backup hook (e.g. mariadb-dump) — run if present for this host
if [ -x "/usr/local/bin/pre-backup-hooks/${HOSTNAME_TAG}.sh" ]; then
  /usr/local/bin/pre-backup-hooks/"${HOSTNAME_TAG}".sh
fi

if restic backup $RESTIC_BACKUP_PATHS \
     -o sftp.command="$RESTIC_SFTP_COMMAND" \
     --exclude-caches --tag "$HOSTNAME_TAG"; then
  echo "lab_backup_success{host=\"$HOSTNAME_TAG\"} 1" > "$METRIC_TMP"
  echo "lab_backup_last_success_timestamp{host=\"$HOSTNAME_TAG\"} $(date +%s)" >> "$METRIC_TMP"
  mv "$METRIC_TMP" "$METRIC_FILE"
else
  echo "lab_backup_success{host=\"$HOSTNAME_TAG\"} 0" > "$METRIC_TMP"
  mv "$METRIC_TMP" "$METRIC_FILE"
  curl -s -XPOST http://172.16.10.40:9093/api/v2/alerts -H "Content-Type: application/json" -d "[{
    \"labels\": {\"alertname\": \"BackupFailed\", \"instance\": \"$HOSTNAME_TAG\", \"severity\": \"critical\"},
    \"annotations\": {\"summary\": \"restic backup failed on $HOSTNAME_TAG\"}
  }]"
  exit 1
fi
```

```bash
sudo mkdir -p /var/lib/node_exporter/textfile_collector /usr/local/bin/pre-backup-hooks
sudo chmod +x /usr/local/bin/lab-backup.sh
```

Add `RESTIC_BACKUP_PATHS="/etc /var/www"` (or the equivalent per-host path list from Phase 2) to each host's `/etc/restic/<hostname>.env`.

This script does two things worth noticing: it writes a Prometheus textfile metric on *every* run (success or failure), which gives you the staleness signal from Mission 06's node_exporter scrape; and it only reaches the `curl` failure-alert line if the script gets that far — if `ssh`/`restic` hangs instead of failing cleanly, neither the failure alert nor the success metric update happens. Keep that in mind for the break-fix drills.

### systemd unit + timer

**[each source VM]** — `/etc/systemd/system/lab-backup.service`:

```ini
[Unit]
Description=Nightly restic backup
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/lab-backup.sh
```

`/etc/systemd/system/lab-backup.timer`:

```ini
[Unit]
Description=Nightly restic backup schedule

[Timer]
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=600
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lab-backup.timer
```

Expected output: no error; the `enable --now` line creates the symlink and starts the timer.

**[lab-mon01]** — add the `lab_backup` alert rules to your Prometheus rules file (from Mission 06), e.g. `/etc/prometheus/rules/backups.yml`:

```yaml
groups:
  - name: backups
    rules:
      - alert: BackupStale
        expr: time() - lab_backup_last_success_timestamp > 100000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "No successful backup on {{ $labels.host }} in over 27h"
      - alert: BackupJobFailing
        expr: lab_backup_success == 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Last backup run on {{ $labels.host }} exited non-zero"
```

```bash
sudo promtool check rules /etc/prometheus/rules/backups.yml
sudo systemctl reload prometheus
```

Expected: `promtool check rules` prints `SUCCESS: 2 rules found`.

**Checkpoint:**

```bash
systemctl list-timers lab-backup.timer --no-pager
```

Expected: a row showing `lab-backup.timer` with `NEXT` set to the coming 02:00 (plus up to 10 min jitter from `RandomizedDelaySec`) and `LEFT` counting down. Trigger one manually to prove the whole chain works end-to-end without waiting for 2am:

```bash
sudo systemctl start lab-backup.service
systemctl status lab-backup.service --no-pager
cat /var/lib/node_exporter/textfile_collector/lab_backup.prom
```

Expected: `status` shows `Deactivated successfully`; the `.prom` file shows `lab_backup_success{host="..."} 1` with a current timestamp. Do not continue to Phase 4 until at least one manual run succeeds on every host.

---

## Phase 4 — Prune policy

Backups that are never pruned grow forever and eventually fill the backup VM's disk — and a full disk on `lab-backup01` fails every host's backup at once. Prune on a schedule, and be deliberate about the retention shape.

**[each source VM]** — run forget+prune by hand once to see the effect, then fold it into the nightly script:

```bash
set -a; source /etc/restic/$(hostname).env; set +a
sudo -E restic forget -o sftp.command="$RESTIC_SFTP_COMMAND" \
  --keep-daily 7 --keep-weekly 4 --prune
```

Expected output: a table under `Applying Policy` showing which snapshots are `keep` vs. removed, followed by prune progress ending in `done`.

Add the same `forget --prune` line to the end of `lab-backup.sh`'s success branch (after the metric write), so pruning happens automatically after every successful nightly backup.

**Reasoning, plain:**

- `--keep-daily 7` — one snapshot per day for the last week. This matches the 24h RPO from Phase 1: if you need to recover from "something broke gradually and nobody noticed for a few days," you have a full week of daily granularity to step back through.
- `--keep-weekly 4` — one snapshot per week for the last month, once the daily ones age out. This covers "we need last month's config" without paying full daily-resolution storage cost for data that old — you're very unlikely to need hour-by-hour or even day-by-day granularity from three weeks ago.
- Together, the repo holds roughly 7 + 4 = 11 snapshots steady-state per host instead of growing unbounded, and the oldest data you can reach is about a month back. If your business actually needs longer retention (compliance, audits), you'd add `--keep-monthly` — for a home lab, a month of history is enough to recover from "I broke this slowly and didn't notice."

**Checkpoint:**

```bash
sudo -E restic snapshots -o sftp.command="$RESTIC_SFTP_COMMAND"
```

Expected: no more than 11 snapshots listed per host, and the oldest one is no older than roughly a month even after repeated daily runs accumulate.

---

## Phase 5 — Restore drills

Do these three in order — each is a bigger blast radius than the last, and the smaller ones catch mistakes before you make them at full scale.

### Single file, as-of N days ago

**[lab-web01]** — list snapshots with timestamps, pick one a few days old (or the oldest you have), and restore just one file from it into a scratch directory (never restore over the live path directly — you might be restoring a mistake):

```bash
set -a; source /etc/restic/lab-web01.env; set +a
sudo -E restic snapshots -o sftp.command="$RESTIC_SFTP_COMMAND"
sudo -E restic restore <SNAPSHOT_ID> --target /tmp/restore-test \
  -o sftp.command="$RESTIC_SFTP_COMMAND" \
  --include /etc/nginx/nginx.conf
```

Expected output: `restoring <snapshot> to /tmp/restore-test`, then the command returns. Confirm:

```bash
diff /tmp/restore-test/etc/nginx/nginx.conf /etc/nginx/nginx.conf
```

Expected: no output if nothing has changed since that snapshot, or a real diff if it has — either way, you now have a working single-file restore procedure.

### Full directory

**[lab-web01]** — restore the entire `/etc/nginx` tree from a snapshot into scratch space:

```bash
sudo -E restic restore <SNAPSHOT_ID> --target /tmp/restore-full \
  -o sftp.command="$RESTIC_SFTP_COMMAND" \
  --include /etc/nginx
```

Expected: the same `restoring ... to /tmp/restore-full` message, and `/tmp/restore-full/etc/nginx/` contains the full directory tree (`sites-available`, `sites-enabled`, `nginx.conf`, etc.).

### Full-system rebuild

This is the real test: pretend `lab-web01` is gone and rebuild it from nothing but a template and a restic repo.

**[HOST]** — clone a fresh VM from `tpl-ubuntu2404` (do **not** reuse the old `lab-web01` disk), run the full Mission 01 clone identity checklist, give it a scratch IP (e.g. `172.16.10.99`) so it doesn't collide with the real `lab-web01` while you test:

```powershell
Copy-Item "D:\HyperV\tpl-ubuntu2404\tpl-ubuntu2404.vhdx" "D:\HyperV\lab-web01-rebuild-test\lab-web01-rebuild-test.vhdx"
New-VM -Name "lab-web01-rebuild-test" -Generation 2 -MemoryStartupBytes 2GB -VHDPath "D:\HyperV\lab-web01-rebuild-test\lab-web01-rebuild-test.vhdx" -SwitchName "LabSwitch"
Set-VMFirmware -VMName "lab-web01-rebuild-test" -EnableSecureBoot Off
Start-VM -Name "lab-web01-rebuild-test"
```

**[new VM]** — install restic, nginx, and openssl; regenerate the `/root/.ssh/id_restic` key on the new machine and add its public key to `lab-backup01`'s authorized_keys (a fresh machine has a fresh key — this is not the same key the destroyed machine had):

```bash
sudo apt update && sudo apt install -y restic nginx
sudo ssh-keygen -t ed25519 -f /root/.ssh/id_restic -N "" -C "rebuild-test-restic"
```

Restore config and data from the real `lab-web01` repo (reuse the same `/etc/restic/lab-web01.env` password and repo path — the repo doesn't care which machine reads from it, only that the SSH key is authorized):

```bash
sudo mkdir -p /etc/restic
sudo tee /etc/restic/lab-web01.env <<'EOF'
RESTIC_REPOSITORY=sftp:resticsftp@lab-backup01.lab.local:/srv/restic-repos/lab-web01
RESTIC_PASSWORD=<REPO_PASSWORD>
RESTIC_SFTP_COMMAND=ssh -i /root/.ssh/id_restic -o BatchMode=yes resticsftp@lab-backup01.lab.local -s sftp
EOF
sudo chmod 600 /etc/restic/lab-web01.env
set -a; source /etc/restic/lab-web01.env; set +a
sudo -E restic restore latest --target / -o sftp.command="$RESTIC_SFTP_COMMAND" --include /etc
```

Expected: `restoring <snapshot> to /` completes without error, and `/etc/nginx/sites-available/app.lab.local` now exists on the rebuild-test VM.

**Service validation** — prove the restored config actually runs, not just that the files exist:

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl status nginx --no-pager
curl -k https://localhost/ -o /dev/null -w "%{http_code}\n"
```

Expected: `nginx -t` reports `syntax is ok` / `test is successful`; `systemctl status` shows `active (running)`; `curl` prints `200` (or `301` if you hit the plain-HTTP vhost — either proves the restored config is live).

**[HOST]** — tear down the scratch rebuild VM once you're satisfied, it was only a drill:

```powershell
Stop-VM -Name "lab-web01-rebuild-test" -TurnOff
Remove-VM -Name "lab-web01-rebuild-test" -Confirm:$false
Remove-Item "D:\HyperV\lab-web01-rebuild-test" -Recurse -Force
```

**Checkpoint:** all three restores worked — single file diffed cleanly, full directory restored intact, and a from-scratch VM served `https://` traffic using only the template and the restic repo, with no manual copying from the original machine. Do not continue to Phase 6 until the full-system rebuild produces a genuinely working nginx, not just files on disk.

---

## Phase 6 — Database-aware backups

Backing up a live database's files directly (its datadir while `mariadbd` is running) risks restoring a torn, inconsistent snapshot — the files under a running database change between the moment restic reads file 1 and file N. The fix is a pre-backup hook that dumps a consistent logical export first, and restic backs up the dump file instead of the live datadir.

**[lab-web01]** — install MariaDB and create a small sample app database (standing in for "the internal app has real data now"):

```bash
sudo apt update && sudo apt install -y mariadb-server
sudo mysql -e "CREATE DATABASE appdb;"
sudo mysql -e "CREATE TABLE appdb.widgets (id INT PRIMARY KEY, name VARCHAR(50));"
sudo mysql -e "INSERT INTO appdb.widgets VALUES (1, 'first-widget');"
```

Expected: all three commands return with no output (MySQL CLI is silent on success for DDL/DML with no rows requested back).

**[lab-web01]** — the pre-backup hook, `/usr/local/bin/pre-backup-hooks/lab-web01.sh` (matches the hook path `lab-backup.sh` already looks for):

```bash
#!/bin/bash
set -euo pipefail
DUMP_DIR=/var/backups/mariadb-dumps
mkdir -p "$DUMP_DIR"
mariadb-dump --all-databases --single-transaction \
  > "$DUMP_DIR/all-databases-$(date +%F).sql"
# Keep only the last 3 days of local dumps — restic's own retention handles
# long-term history, this is just a rolling buffer for the hook to hand off.
find "$DUMP_DIR" -name '*.sql' -mtime +3 -delete
```

```bash
sudo chmod +x /usr/local/bin/pre-backup-hooks/lab-web01.sh
```

`--single-transaction` is what makes this consistent instead of torn: it opens one transaction (InnoDB) and reads a consistent snapshot of every table without locking the whole server, so writes happening during the dump don't produce a half-old-half-new export.

Add `/var/backups/mariadb-dumps` to `lab-web01`'s `RESTIC_BACKUP_PATHS` in `/etc/restic/lab-web01.env` so the dump — not the live datadir — is what gets backed up:

```bash
RESTIC_BACKUP_PATHS="/etc /var/www /var/backups/mariadb-dumps"
```

**Checkpoint:**

```bash
sudo systemctl start lab-backup.service
set -a; source /etc/restic/lab-web01.env; set +a
sudo -E restic snapshots -o sftp.command="$RESTIC_SFTP_COMMAND" --tag lab-web01 --last
sudo -E restic ls latest -o sftp.command="$RESTIC_SFTP_COMMAND" | grep mariadb-dumps
```

Expected: the latest snapshot's file listing includes `/var/backups/mariadb-dumps/all-databases-<today>.sql`. Do not consider database backups working until you can see the dump file inside a snapshot, not just on local disk.

---

## The central drill: Destroy-and-restore

This is the mission. Everything above was preparation.

In this live Claude Code session, ask Claude to pick one of your five source VMs at random and destroy its disk without telling you in advance which one or when — something equivalent to:

```powershell
Stop-VM -Name "<chosen-vm>" -TurnOff -Confirm:$false
Remove-Item "D:\HyperV\<chosen-vm>\<chosen-vm>.vhdx" -Force
```

The instant that command runs, your clock starts. Your job: restore the destroyed system to a genuinely working state within the RTO you wrote for it in Phase 1 — not "files exist," but the same bar as Phase 5's full-system rebuild: the service actually runs and answers requests. Use the same rebuild procedure you proved in Phase 5, against the real destroyed VM's name and IP this time, not a scratch clone. Time yourself with a real clock, not a guess after the fact.

When the service is validated working again, fill out this postmortem immediately, while the details are fresh:

```markdown
## Postmortem: lab-doomsday-drill

**System destroyed:** <hostname>
**Time of destruction:** <timestamp>
**Time service validated working:** <timestamp>
**Elapsed:** <duration>
**RTO from Phase 1:** <duration>
**Met RTO?** yes / no — by how much?

**Restore steps actually taken** (in order, with any deviation from the Phase 5 procedure):
1. ...
2. ...

**What went faster than expected:**

**What went slower than expected:**

**What would you change about the backup policy (Phase 1) or the restore procedure (Phase 5) based on this run?**

**Data loss, if any (gap between last snapshot and time of destruction):**
```

**Checkpoint:** the destroyed system is back up, its actual service (nginx, Postfix+Dovecot, FreeIPA, or the monitoring stack, whichever was chosen) is validated functioning — not just restored files — and the postmortem above is filled out with real timestamps, not estimates.

---

## Prove-it: exact restore with proof

**[lab-web01]** — identify the snapshot 3 backups before the current one and restore `/etc/nginx` from it into scratch space:

```bash
set -a; source /etc/restic/lab-web01.env; set +a
sudo -E restic snapshots -o sftp.command="$RESTIC_SFTP_COMMAND" --tag lab-web01
```

Count back 3 entries from the most recent (index `-4` if you're zero-counting from the latest as `-1`), then:

```bash
sudo -E restic restore <SNAPSHOT_ID_3_BACK> --target /tmp/nginx-3back \
  -o sftp.command="$RESTIC_SFTP_COMMAND" \
  --include /etc/nginx
```

Prove it's exact with a recursive diff against the live config:

```bash
diff -r /tmp/nginx-3back/etc/nginx /etc/nginx
```

Expected: either no output (config hasn't changed in 3 backup cycles) or a precise, explainable diff (e.g. a cert renewal touched a file, or you edited a vhost since). Either result is fine — what matters is you can point at exactly what changed and why, not just that a diff command ran.

**Checkpoint:** you can name the snapshot ID you restored from and show its restore timestamp is 3 snapshots older than `latest`, and the `diff -r` output is fully explained line by line.

---

## Break-fix drills

Diagnose from the symptom before opening the hints. State what you observe, form a hypothesis, test it, then fix.

**Drill 1 — Backup job fails silently (SFTP key expired)**

Ask Claude, in this session, to revoke or corrupt one host's backup key on `lab-backup01` — e.g. remove that host's line from `resticsftp`'s `authorized_keys`, or replace it with a garbage key — without telling you which host.

Symptom: no `BackupFailed` alert ever fires in Alertmanager, even a day later. The backup simply stops happening for that host, and nothing tells you directly. Diagnose using the tools this mission built: `systemctl list-timers`, `journalctl -u lab-backup.service`, the `lab_backup.prom` textfile metric's timestamp, and the `BackupStale` alert rule from Phase 3 — before touching the SSH key.

**Drill 2 — Restore runs but the service won't start**

Ask Claude to perform a restore of one destroyed-and-rebuilt VM's config, but into the wrong location — e.g. `restic restore ... --target /opt/wrong-restore` instead of `--target /`, or restoring `/etc/nginx` under a relative path from the wrong working directory.

Symptom: `restic restore` reports success, files clearly landed somewhere on disk, but the service (nginx, Postfix, whichever you're rebuilding) fails to start, or starts and immediately errors about a missing file it expects at an absolute path. Diagnose by comparing where the files actually landed against where the service's config or unit file expects them, before re-running the restore.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `restic` calls made with `-o sftp.command="ssh -i ... -o BatchMode=yes ..."` fail fast on a bad key (immediate `Permission denied`) rather than hanging — but check whether `BatchMode=yes` is actually present in the env file being sourced; without it, a rejected key prompts for a password that never arrives, the process hangs until something kills it, and the script's own failure-alert `curl` line is never reached. `journalctl -u lab-backup.service` shows how the unit actually exited (timeout vs. clean non-zero exit).
- Drill 2: `restic restore <snapshot> --target X --include /etc/nginx` recreates the *full path* `X/etc/nginx/...`, not `X/...` — a very common mistake is expecting the restored tree to land directly under `--target`. Compare `find <target> -type f` against what `nginx -t` or the systemd unit's `ExecStart`/`ConfigFile` actually references.

</details>

---

## Done when

- [ ] Phase 1 backup policy worksheet is filled in for all five lab systems with RPO, RTO, and a data-vs-config call for each
- [ ] All five source VMs have an initialized restic repo on `lab-backup01` over SFTP, using the env-file password pattern
- [ ] `restic snapshots` and `restic check` both succeed on all five repos
- [ ] `lab-backup.timer` is `active` on all five source VMs and a manual `systemctl start lab-backup.service` run succeeds end-to-end
- [ ] Backup success writes a Prometheus textfile metric; backup failure posts to Alertmanager; `BackupStale` and `BackupJobFailing` alert rules are loaded (`promtool check rules` passes)
- [ ] `restic forget --keep-daily 7 --keep-weekly 4 --prune` runs automatically after every successful backup, and you can explain the retention reasoning without notes
- [ ] Single-file, full-directory, and full-system-rebuild restores have all been performed and validated (service actually running, not just files present)
- [ ] The `mariadb-dump` pre-backup hook produces a dump file that appears inside a restic snapshot, and `--single-transaction` is used
- [ ] Destroy-and-restore drill completed: a real VM was destroyed without warning, restored within its written RTO (or the miss is documented and explained), and the postmortem template is filled out with real timestamps
- [ ] `/etc/nginx` restored from 3 snapshots back and proven identical (or explainably different) via `diff -r`
- [ ] Both break-fix drills reproduced, diagnosed from symptom, and fixed
