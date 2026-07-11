# Guide — Mission 02: Linux Deep Core

This mission runs on one VM: **`lab-core1`**, a fresh clone of `tpl-ubuntu2404` on `LabSwitch` (`172.16.10.0/24`, domain `lab.local`). We'll give it static IP `172.16.10.31`. Every command block below states which machine it runs on — **Host** (Windows PowerShell) or **lab-core1** (bash).

## Phase 0 — Setup check

Confirm the template exists and clone a dedicated VM for this mission.

On **Host**:

```powershell
Get-VM tpl-ubuntu2404 | Select-Object Name, State
```

Expected output:

```
Name             State
----             -----
tpl-ubuntu2404   Off
```

Clone it:

```powershell
$vmName = "lab-core1"
$vmPath = "D:\HyperV\$vmName"
New-Item -ItemType Directory -Path $vmPath -Force
Copy-Item "D:\HyperV\tpl-ubuntu2404\Virtual Hard Disks\tpl-ubuntu2404.vhdx" "$vmPath\$vmName.vhdx"
New-VM -Name $vmName -MemoryStartupBytes 4GB -VHDPath "$vmPath\$vmName.vhdx" -SwitchName LabSwitch -Generation 2
Set-VMProcessor -VMName $vmName -Count 2
Set-VMFirmware -VMName $vmName -EnableSecureBoot Off
Start-VM -VMName $vmName
```

Expected output (last command produces none; verify with):

```powershell
Get-VM lab-core1 | Select-Object Name, State
```

```
Name         State
----         -----
lab-core1    Running
```

On **lab-core1**, regenerate identity per the Mission 01 clone checklist (machine-id, SSH host keys, hostname) and set the static address:

```bash
sudo truncate -s 0 /etc/machine-id
sudo rm -f /var/lib/dbus/machine-id
sudo systemd-machine-id-setup
sudo rm -f /etc/ssh/ssh_host_*
sudo ssh-keygen -A
sudo hostnamectl set-hostname lab-core1
```

Edit `/etc/netplan/50-cloud-init.yaml`:

```yaml
network:
  version: 2
  ethernets:
    eth0:
      addresses: [172.16.10.31/24]
      routes:
        - to: default
          via: 172.16.10.1
      nameservers:
        addresses: [172.16.10.1]
```

```bash
sudo netplan apply
ip -br a
```

Expected output:

```
lo               UNKNOWN        127.0.0.1/8
eth0             UP             172.16.10.31/24
```

Take the pre-mission snapshot on **Host**:

```powershell
Checkpoint-VM -Name lab-core1 -SnapshotName "pre-mission-02"
Get-VMSnapshot -VMName lab-core1 | Select-Object Name
```

Expected output:

```
Name
----
pre-mission-02
```

**Checkpoint:** `lab-core1` responds to `ssh lab-core1@172.16.10.31` from the host, and `pre-mission-02` snapshot exists.

## Phase 1 — systemd anatomy

Write the monitor script first. On **lab-core1**:

```bash
sudo tee /usr/local/bin/labmon.sh > /dev/null << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
DISK_USAGE="$(df -h --output=source,pcent,target -x tmpfs -x devtmpfs | tail -n +2)"

{
    echo "=== ${TIMESTAMP} ==="
    echo "${DISK_USAGE}"
} >> /var/log/labmon.log
EOF
sudo chmod 755 /usr/local/bin/labmon.sh
sudo touch /var/log/labmon.log
```

Now the full unit file, `/etc/systemd/system/labmon.service`:

```bash
sudo tee /etc/systemd/system/labmon.service > /dev/null << 'EOF'
[Unit]
Description=LabMon disk usage snapshot
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/labmon.sh
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
```

Load and run it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now labmon.service
systemctl status labmon.service
```

Expected output (the service is `Type=oneshot`, so it runs once and exits clean — `inactive (dead)` with `status=0/SUCCESS` is correct, not a failure):

```
● labmon.service - LabMon disk usage snapshot
     Loaded: loaded (/etc/systemd/system/labmon.service; enabled; vendor preset: enabled)
     Active: inactive (dead) since Sun 2026-07-12 10:00:01 UTC; 2s ago
    Process: 1842 ExecStart=/usr/local/bin/labmon.sh (code=exited, status=0/SUCCESS)
   Main PID: 1842 (code=exited, status=0/SUCCESS)
```

```bash
cat /var/log/labmon.log
```

```
=== 2026-07-12 10:00:01 ===
/dev/sda1        22%  /
```

Now the full timer file, `/etc/systemd/system/labmon.timer`:

```bash
sudo tee /etc/systemd/system/labmon.timer > /dev/null << 'EOF'
[Unit]
Description=Run labmon every 5 minutes

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now labmon.timer
```

**Checkpoint:**

```bash
systemctl list-timers labmon.timer
```

Expected output (times will differ):

```
NEXT                        LEFT     LAST                         PASSED   UNIT           ACTIVATES
Sun 2026-07-12 10:05:00 UTC  4min 2s  Sun 2026-07-12 10:00:01 UTC  4s ago   labmon.timer   labmon.service
```

## Phase 2 — journald

Filter logs for the unit:

```bash
journalctl -u labmon
```

Expected output: one block per run, each showing `Started LabMon disk usage snapshot.` and `Finished LabMon disk usage snapshot.`

Filter by priority and time window:

```bash
journalctl -u labmon -p err
journalctl -u labmon --since "10 min ago"
```

Expected output for `-p err`: empty (labmon has never errored). For `--since`: only entries from the last 10 minutes.

Enable persistent storage so logs survive reboot instead of living only in `/run`:

```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo sed -i 's/^#Storage=auto/Storage=persistent/' /etc/systemd/journald.conf
sudo systemctl restart systemd-journald
```

Reboot and confirm:

```bash
sudo reboot
```

After reconnecting:

```bash
journalctl --list-boots
```

Expected output: two or more rows, one per boot, oldest first:

```
 -1 3a1f2b... Sat 2026-07-11 09:00:00 UTC—Sat 2026-07-11 18:00:00 UTC
  0 7c9e4d... Sun 2026-07-12 10:10:00 UTC—Sun 2026-07-12 10:10:33 UTC
```

**Checkpoint:** `ls /var/log/journal/` shows a machine-id-named directory containing `.journal` files, and `journalctl --list-boots` lists more than one boot.

## Phase 3 — targets & dependencies

Three directives control ordering and pulling-in of units:

- **`After=`** — only ordering. This unit starts after the listed unit, but doesn't force it to start.
- **`Requires=`** — hard dependency. If the listed unit fails or stops, this unit is stopped too.
- **`Wants=`** — soft dependency. The listed unit is started alongside this one, but its failure doesn't affect this unit.

`labmon.service` uses `Wants=network-online.target` + `After=network-online.target`: try to have networking up first, but don't hard-fail the whole unit if it isn't.

Read the dependency tree:

```bash
systemctl list-dependencies labmon.timer
```

Expected output:

```
labmon.timer
● ├─sysinit.target
● └─timers.target
```

```bash
systemctl list-dependencies multi-user.target | head -20
```

Expected output: a tree including `labmon.service`, `sshd.service`, `systemd-journald.service`, and other multi-user-level units, each prefixed with a tree-branch character.

**Checkpoint:** `systemctl list-dependencies labmon.timer` and `systemctl list-dependencies multi-user.target` both run without error and `labmon.service`/`labmon.timer` appear where expected.

## Phase 4 — cgroups v2

Install the stress tool:

```bash
sudo apt update
sudo apt install -y stress-ng
```

Expected output: normal apt install log ending in `Setting up stress-ng ...`.

Run it inside a memory-capped transient scope:

```bash
sudo systemd-run --scope -p MemoryMax=100M stress-ng --vm 1 --vm-bytes 250M --timeout 30s
```

Expected output: the scope starts, then stress-ng's worker is killed before the 30s timeout:

```
Running scope as unit: run-u1234.scope
stress-ng: info:  [1855] setting to a 30 second run per stress instance
stress-ng: info:  [1855] dispatching hogs: 1 vm
Killed
```

Watch it live in another SSH session while the above runs:

```bash
systemd-cgtop
```

Expected output: a live-updating table; the `run-u1234.scope` row shows memory climbing toward `100.0M` right before it disappears.

Confirm the OOM kill landed in the journal:

```bash
journalctl -k --since "5 min ago" | grep -i "killed process"
```

Expected output:

```
Jul 12 10:20:14 lab-core1 kernel: Memory cgroup out of memory: Killed process 1856 (stress-ng-vm) total-vm:...
```

**Checkpoint:** the `journalctl -k` command above returns a matching "Killed process" line.

## Phase 5 — users/sudo

Create the group and user:

```bash
sudo groupadd ops
sudo useradd -m -g ops -s /bin/bash ops
sudo passwd ops
```

Expected output: `passwd: password updated successfully`.

Write the sudoers drop-in, `/etc/sudoers.d/ops`, granting the `ops` group exactly four commands — no blanket root access:

```bash
sudo tee /etc/sudoers.d/ops > /dev/null << 'EOF'
# Grants the ops group operational access to labmon only — no general root.
%ops ALL=(root) NOPASSWD: /usr/bin/systemctl status labmon.service, \
                          /usr/bin/systemctl restart labmon.service, \
                          /usr/bin/journalctl -u labmon.service, \
                          /usr/bin/apt update
EOF
sudo chmod 440 /etc/sudoers.d/ops
```

Validate the syntax before it can ever be loaded:

```bash
sudo visudo -cf /etc/sudoers.d/ops
```

Expected output:

```
/etc/sudoers.d/ops: parsed OK
```

**Checkpoint:**

```bash
sudo -l -U ops
```

Expected output:

```
User ops may run the following commands on lab-core1:
    (root) NOPASSWD: /usr/bin/systemctl status labmon.service, /usr/bin/systemctl restart labmon.service, /usr/bin/journalctl -u labmon.service, /usr/bin/apt update
```

## Phase 6 — process forensics

**strace a failing command** — see exactly which syscall fails and why:

```bash
strace -f ls /nonexistent 2>&1 | tail -5
```

Expected output:

```
statx(AT_FDCWD, "/nonexistent", AT_STATX_SYNC_AS_STAT|AT_SYMLINK_NOFOLLOW, STATX_ALL, {...}) = -1 ENOENT (No such file or directory)
ls: cannot access '/nonexistent': No such file or directory
+++ exited with 2 +++
```

**lsof on a deleted-but-open file** — a classic "why isn't my disk space back" case:

```bash
echo "hold me open" > /tmp/ghost.log
tail -f /tmp/ghost.log &
rm /tmp/ghost.log
lsof | grep ghost.log
```

Expected output:

```
tail      1901          root    3r      REG    8,1        13  131099 /tmp/ghost.log (deleted)
```

```bash
kill %1
```

**A tour of `/proc/<pid>`** — replace `1901` with a live PID:

```bash
cat /proc/1901/status | head -5
ls -l /proc/1901/fd
cat /proc/1901/cmdline | tr '\0' ' '; echo
head -5 /proc/1901/maps
```

Expected output: `status` shows `Name:`, `State:`, `Pid:` lines; `fd` lists open file descriptors as symlinks (some pointing at `(deleted)` targets); `cmdline` prints the exact argv; `maps` shows the process's memory regions.

**Signals table** — the four every sysadmin must know cold:

| Signal | Number | Meaning | Catchable? |
|--------|--------|---------|------------|
| `SIGTERM` | 15 | Polite request to terminate; process may clean up first | Yes |
| `SIGKILL` | 9 | Immediate termination by the kernel; no cleanup | No |
| `SIGHUP` | 1 | Terminal hangup; daemons often treat this as "reload config" | Yes |
| `SIGSTOP` | 19 | Pause the process immediately | No |

## Break-fix drills

For each drill, ask Claude in this session to run the sabotage command on `lab-core1`. Then diagnose and fix it yourself before opening the Hints. Snapshot back to `pre-mission-02` if a drill goes sideways beyond recovery.

**Drill 1 — Corrupted fstab entry.** Symptom: after the next reboot, `lab-core1` drops to an emergency shell instead of reaching a login prompt, and the console shows a message about a filesystem failing to mount. Recover the boot and fix the entry.

**Drill 2 — Masked service.** Symptom: `systemctl start labmon.service` (or another service Claude picks) fails with `Failed to start labmon.service: Unit labmon.service not found.` — even though the unit file is still on disk. Diagnose why systemd claims it doesn't exist and restore it.

**Drill 3 — Sudoers syntax error.** Symptom: any `sudo` command on `lab-core1`, run by any user including you, fails with a parse error and refuses to run anything at all. Recover sudo access via the Hyper-V console (root shell or single-user/recovery boot) and fix the broken file.

**Drill 4 — Fork bomb.** Symptom: `lab-core1` becomes unresponsive over SSH as process count explodes. First contain the runaway processes using a cgroup limit, then apply a permanent limit so this can't happen again unbounded.

## Prove-it

Ask Claude to hand you a `lab-core1` snapshot where `labmon.service` fails on boot for a reason you have not seen in this guide. Investigate using the tools from Phases 1, 2, and 6 (`systemctl status`, `journalctl`, `strace`, `/proc`, file permissions, path issues, etc.). Produce a short written root-cause statement and the exact fix. Acceptance: `systemctl status labmon.service` shows `active` or a clean `oneshot` success on the next timer fire, and your write-up correctly names the underlying cause — not just "restarted it and it worked."

## Hints

<details>
<summary>Hints for drills and challenges (open only when stuck)</summary>

- **Drill 1:** the emergency shell tells you which mount failed in its first few lines — `journalctl -xb` also shows it. `/etc/fstab` supports comments; you don't have to guess the right UUID from memory, `blkid` will tell you.
- **Drill 2:** `mask` and a plain disabled/missing unit look identical in casual `systemctl start` output — check `systemctl status` and look at where the unit file symlinks to.
- **Drill 3:** normal `sudo` is dead, but you own the VM — Hyper-V's console (Connect on the VM in Hyper-V Manager) doesn't go through sudo. Boot options or a root TTY get you a working shell to fix the file directly.
- **Drill 4:** `systemd-run` isn't just for launching things nicely — it can also wrap an existing runaway with a scope after the fact via `systemctl` cgroup controls; for prevention look at limiting the process count, not just memory.
- **Prove-it:** don't jump to `systemctl restart` first — read the failure with `systemctl status` and `journalctl -u labmon -b` before touching anything, and check the script and log file's permissions and existence.

</details>

## Done when

- [ ] `labmon.service` and `labmon.timer` are enabled, and `systemctl list-timers` shows the timer firing every 5 minutes
- [ ] `/var/log/labmon.log` contains multiple timestamped entries
- [ ] Persistent journald storage is configured and `journalctl --list-boots` shows history across a reboot
- [ ] A `systemd-run` scope with `MemoryMax=100M` produced a visible OOM kill in `journalctl -k`
- [ ] `ops` user and group exist, `/etc/sudoers.d/ops` passes `visudo -cf` and grants only the four intended commands
- [ ] All four break-fix drills solved without restoring the pre-drill snapshot (or, if restored, redone cleanly)
- [ ] Prove-It root-cause write-up completed and `labmon.service` running cleanly afterward
