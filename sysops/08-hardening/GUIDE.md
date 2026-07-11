# Guide — Mission 08: Hardening

This mission runs on one primary VM: **`lab-hard1`**, a fresh clone of `tpl-ubuntu2404` on `LabSwitch` (`172.16.10.0/24`, domain `lab.local`), static IP `172.16.10.40`. Phase 6 (fail2ban) also needs a second machine to attack from — any other running lab guest works; this guide calls it **`[attacker]`** and assumes it's reachable at `172.16.10.41` (a throwaway clone is fine — it doesn't need a static identity beyond an IP).

Every command block states its machine: **[lab-hard1]** or **[attacker]**, both guest bash, or **[HOST]** for Hyper-V PowerShell. Wherever you see `<LABADMIN_KEY>` substitute your own SSH keypair — reuse the one from Mission 01 if you still have it.

> **Read this before you touch SSH or PAM:** Phases 2 and 3 change how you authenticate to this VM. Every risky step below has an explicit **test-before-disconnect** instruction — a second, independent login you must prove works *before* you close or restart the session you're currently in. If you skip that check and get disconnected, the recovery path is the Hyper-V console (Phase 0 snapshot, or the break-fix drill later in this guide) — not panic. Slow down at those steps.

---

## Phase 0 — Setup check and snapshot

Hardening is the one mission in this track where a single wrong line can lock you out entirely. The rule for this whole mission: **never make an authentication or account-lockout change without a snapshot you can roll back to.**

**[HOST]** — clone `lab-hard1` from your Mission 01 template, following the Mission 01 clone checklist (regenerate machine-id, SSH host keys, hostname, static IP):

```powershell
Get-VM lab-hard1 | Select-Object Name, State
```

Expected output: `lab-hard1` / `Running`. If it doesn't exist yet, clone it now — Ubuntu, `172.16.10.40`.

**[lab-hard1]** — confirm you can reach it and confirm the tools this mission needs are installable:

```bash
sudo apt update
```

Expected output: package lists refresh with no errors (a stale mirror error means fix your network before continuing — nothing here is graded on speed).

**[HOST]** — take the pre-mission snapshot. This is not optional:

```powershell
Checkpoint-VM -Name lab-hard1 -SnapshotName "pre-mission-08"
Get-VMSnapshot -VMName lab-hard1 | Select-Object Name
```

Expected output: `pre-mission-08` listed. This is your undo button for the entire mission — if a later phase locks you out and you can't recover any other way, restore this snapshot from the Hyper-V console and start that phase over.

**Checkpoint:** `lab-hard1` is running, reachable over SSH with your current (password-or-key, doesn't matter yet) login, and `pre-mission-08` exists as a snapshot. Do not proceed to Phase 1 without the snapshot.

---

## Phase 1 — Baseline: Lynis audit

You can't prove you improved anything without a number to improve from.

**[lab-hard1]** — install Lynis from its own repo (the Ubuntu package repo version lags badly):

```bash
sudo apt install -y wget gnupg apt-transport-https
wget -qO - https://packages.cisofy.com/keys/cisofy-software-public.key | sudo gpg --dearmor -o /usr/share/keyrings/cisofy-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cisofy-archive-keyring.gpg] https://packages.cisofy.com/community/lynis/deb/ stable main" | sudo tee /etc/apt/sources.list.d/cisofy-lynis.list
sudo apt update && sudo apt install -y lynis
```

Expected output: `lynis` installs with no dependency errors. Confirm the version:

```bash
lynis show version
```

Expected: a version string, e.g. `3.1.x`.

**[lab-hard1]** — run the baseline audit and save it before you touch anything else:

```bash
sudo mkdir -p ~/hardening-baseline
sudo lynis audit system --no-colors | sudo tee ~/hardening-baseline/lynis-before.txt
```

Expected output: several minutes of scrolling test output ending in a `Lynis security scan details` summary with a **Hardening index** line, e.g. `Hardening index : 62 [############        ]`. Note this number down — it's the score you must raise by 15+ points in Phase 9.

**[lab-hard1]** — pull just the suggestions out for easy reading:

```bash
sudo grep -A1 "Suggestion" /var/log/lynis-report.dat | head -60
```

Expected output: a list of `suggestion[]=` lines, each naming a specific test ID and fix (e.g. `SSH-7408`, `AUTH-9262`, `KRNL-6000`). Pick the top 10-15 — you'll be closing most of them over the next several phases without this guide having to name every one explicitly.

**Checkpoint:** `~/hardening-baseline/lynis-before.txt` exists with a recorded Hardening index score, and you have a short list of the top findings written down somewhere you'll reference later.

---

## Phase 2 — SSH lockdown

This is the highest-stakes phase in the mission. Read the whole phase before running anything.

**[lab-hard1]** — create the group that will gate SSH access, and put your admin user in it:

```bash
sudo groupadd ssh-users
sudo usermod -aG ssh-users labadmin
groups labadmin
```

Expected output: `labadmin : labadmin sudo ssh-users` (order may vary, `ssh-users` must appear).

**[lab-hard1]** — make sure your public key is authorized before you disable passwords (if it already is from Mission 01, confirm it, don't skip the check):

```bash
cat ~/.ssh/authorized_keys
```

Expected output: your public key, one line, `ssh-ed25519 AAAA...` or `ssh-rsa AAAA...`. If this is empty, `ssh-copy-id labadmin@172.16.10.40` from your host **now**, before continuing — key-only auth with no authorized key is a guaranteed lockout.

**[lab-hard1]** — edit `/etc/ssh/sshd_config`. Find and set each of these (they usually exist commented-out; uncomment and change the value rather than adding duplicates):

```
PubkeyAuthentication yes
PasswordAuthentication no
PermitRootLogin no
AllowGroups ssh-users
```

Validate the syntax before applying anything:

```bash
sudo sshd -t
```

Expected output: nothing (silence means the config is syntactically valid). If it prints an error, fix it before continuing — do not reload a config that fails this check.

**Apply the change without dropping your current connection:**

```bash
sudo systemctl reload ssh
```

`reload` (not `restart`) re-reads the config for *new* connections but does not kill the session you're already in. That's exactly why this order matters.

> **STOP — test-before-disconnect. Do this now, in this exact order, before you close anything:**
>
> 1. **Keep your current terminal open.** Do not close it, do not run `exit`, do not reboot the VM.
> 2. Open a **second, brand-new** terminal or SSH session and log in fresh:
>    ```bash
>    ssh labadmin@172.16.10.40
>    ```
>    Expected: you land in a shell with no password prompt — key-based login succeeded.
> 3. From that same second session (or a third), prove password auth is actually refused:
>    ```bash
>    ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password labadmin@172.16.10.40
>    ```
>    Expected: `Permission denied (publickey)` — no password prompt appears at all, because the server refuses to even offer password auth.
> 4. **Only after both of those succeed**, it is safe to close your original terminal.
>
> If step 2 fails — you cannot get a new key-based session in — do **not** close your original terminal. Go back, re-check `authorized_keys` ownership/permissions (`~/.ssh` must be `700`, `authorized_keys` must be `600`, both owned by `labadmin`) and `sshd -t` output, and re-reload only after `sshd -t` is clean.

**Checkpoint:** a brand-new SSH session authenticates with your key with zero password prompt, and an explicit password-auth attempt is refused with `Permission denied (publickey)`. Both proven from a *second* session while your first session was still open.

---

## Phase 3 — CIS Benchmark subset

Three independent hardening items: mount options, service reduction, account lockout policy.

**[lab-hard1]** — `/tmp` mount hardening via a systemd override (Ubuntu 24.04 mounts `/tmp` as a `tmp.mount` unit backed by tmpfs; you override its options rather than editing fstab). Create the drop-in directory and file:

```bash
sudo mkdir -p /etc/systemd/system/tmp.mount.d
```

`/etc/systemd/system/tmp.mount.d/override.conf`:

```ini
[Mount]
Options=mode=1777,strictatime,nosuid,nodev,size=2G
```

`nosuid` stops set-uid binaries planted in `/tmp` from running with elevated privilege; `nodev` stops device-node tricks from that same throwaway, world-writable directory — both close a classic privilege-escalation staging ground.

Apply and verify:

```bash
sudo systemctl daemon-reload
sudo systemctl restart tmp.mount
mount | grep " /tmp "
```

Expected output: a line containing `nosuid` and `nodev` for the `/tmp` mount.

**[lab-hard1]** — disable-unused-services checklist. List what's enabled, then work through the list deciding what this VM actually needs:

```bash
systemctl list-unit-files --state=enabled --type=service
```

Common lab-image services that are safe to disable if present and unused (check each against what you actually configured in earlier missions before disabling — don't disable something you're actively using):

```bash
for svc in avahi-daemon cups rpcbind nfs-server bluetooth ModemManager; do
  systemctl is-enabled "$svc" 2>/dev/null && sudo systemctl disable --now "$svc" && sudo systemctl mask "$svc"
done
```

Expected output: for each service present, `enabled` printed, then it gets disabled and masked (masking prevents anything, including a dependency, from silently re-enabling it).

**[lab-hard1]** — password and account lockout policy via `pam_faillock`. `/etc/security/faillock.conf`:

```
deny = 5
unlock_time = 900
fail_interval = 900
```

`deny=5` locks the account after 5 bad attempts; `unlock_time=900` auto-unlocks after 15 minutes; `fail_interval=900` is the window those 5 attempts must fall within.

Wire it into PAM — in `/etc/pam.d/common-auth`, `pam_faillock` needs a `preauth` call before the `pam_unix.so` line and an `authfail` call after it:

```
auth    required                        pam_faillock.so preauth
auth    [success=1 default=ignore]      pam_unix.so nullok
auth    [default=die]                   pam_faillock.so authfail
auth    requisite                       pam_deny.so
auth    required                        pam_permit.so
```

(Ubuntu's PAM stack already has most of these lines — insert the two `pam_faillock.so` lines around the existing `pam_unix.so` line rather than duplicating it.)

**Checkpoint:**

```bash
mount | grep " /tmp "
systemctl is-enabled avahi-daemon 2>&1
faillock --user labadmin
```

Expected: `/tmp` shows `nosuid,nodev`; disabled services report `masked` (or "No such file or directory" if never installed); `faillock` runs cleanly showing zero current failures. Prove the lockout policy works without locking yourself out — from a throwaway test account, not `labadmin`:

```bash
sudo useradd -m -s /bin/bash locktest
echo "locktest:TempPass123!" | sudo chpasswd
for i in 1 2 3 4 5 6; do sshd_config_test=1; ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no locktest@172.16.10.40 exit; done
```

Wait — this only works if `PasswordAuthentication` were `yes`; since Phase 2 disabled it, prove faillock locally instead:

```bash
for i in 1 2 3 4 5 6; do su - locktest -c "true" <<< "wrongpassword"; done
faillock --user locktest
```

Expected output: after the 5th failure, `faillock --user locktest` shows a `V` (valid failure) count reaching the deny threshold, and further correct-password attempts still fail until `unlock_time` elapses or you run `sudo faillock --user locktest --reset`.

---

## Phase 4 — sysctl network hardening

**[lab-hard1]** — `/etc/sysctl.d/99-hardening.conf`:

```
# Reject spoofed packets that couldn't have arrived via their claimed route
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Never act on ICMP redirects — a router-in-the-middle attack vector
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0

# This host is not a router; never send redirects to anyone
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Refuse source-routed packets (attacker-specified path, bypasses normal routing)
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# Log packets with impossible source addresses instead of silently dropping them
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# Ignore ICMP redirects even from gateways already believed to be trusted
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0

# Ignore broadcast ICMP echo (blocks smurf-style amplification abuse)
net.ipv4.icmp_echo_ignore_broadcasts = 1

# SYN cookies: absorb SYN-flood attempts without exhausting the connection backlog
net.ipv4.tcp_syncookies = 1

# Full ASLR (stack, heap, and mmap base all randomized)
kernel.randomize_va_space = 2

# Never write world-readable core dumps from setuid processes
fs.suid_dumpable = 0

# Hide real kernel pointers from /proc even from root-owned reads by unprivileged code
kernel.kptr_restrict = 2

# Restrict dmesg to CAP_SYSLOG — stops unprivileged users reading kernel-log detail
kernel.dmesg_restrict = 1
```

Apply and verify:

```bash
sudo sysctl --system
sudo sysctl net.ipv4.conf.all.rp_filter net.ipv4.tcp_syncookies kernel.kptr_restrict
```

Expected output: `sysctl --system` prints every file it applied ending with `99-hardening.conf`; the second command echoes back `= 1`, `= 1`, `= 2` respectively.

**Checkpoint:** every key in `99-hardening.conf` reads back the value you set via `sysctl <key>`, and `sysctl --system` reported no errors applying the file.

---

## Phase 5 — auditd: watching for privilege escalation

**[lab-hard1]** — install and enable auditd:

```bash
sudo apt install -y auditd audispd-plugins
sudo systemctl enable --now auditd
```

`/etc/audit/rules.d/hardening.rules`:

```
# Anyone editing sudoers is a privilege-escalation event worth a permanent record
-w /etc/sudoers -p wa -k sudoers_changes
-w /etc/sudoers.d/ -p wa -k sudoers_changes

# Same for the account database itself
-w /etc/passwd -p wa -k passwd_changes
-w /etc/shadow -p wa -k shadow_changes
-w /etc/group -p wa -k group_changes

# Every command any real human user (uid >= 1000) executes, system accounts excluded
-a always,exit -F arch=b64 -S execve -F auid>=1000 -F auid!=4294967295 -k exec_uid1000
-a always,exit -F arch=b32 -S execve -F auid>=1000 -F auid!=4294967295 -k exec_uid1000
```

(`auid!=4294967295` excludes the "unset" audit login UID used by system/kernel-spawned processes — without it you'd drown in noise from services that never had an interactive login.)

Load the rules:

```bash
sudo augenrules --load
sudo systemctl restart auditd
sudo auditctl -l
```

Expected output: `auditctl -l` lists all five rules back verbatim.

**Checkpoint — trigger one and find it:**

```bash
sudo visudo -c
echo "" | sudo tee -a /etc/sudoers.d/README > /dev/null
```

```bash
sudo ausearch -k sudoers_changes -ts recent
```

Expected output: at least one audit event block containing `type=PATH` with `name="/etc/sudoers.d/README"` and the syscall that touched it.

```bash
sudo aureport -k --summary
```

Expected output: a small table with `sudoers_changes` and `exec_uid1000` each showing a nonzero event count.

---

## Phase 6 — fail2ban

**[lab-hard1]** — install fail2ban:

```bash
sudo apt install -y fail2ban
```

`/etc/fail2ban/jail.local`:

```ini
[sshd]
enabled  = true
port     = ssh
filter   = sshd
backend  = systemd
maxretry = 3
findtime = 600
bantime  = 600
```

```bash
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

Expected output: a status block showing `Currently failed: 0`, `Currently banned: 0`, jail is running.

**[attacker]** — generate real failed-auth attempts against `lab-hard1`. Since Phase 2 disabled password auth entirely, use attempts fail2ban's `sshd` filter still catches — invalid usernames and rejected keys both write matching lines to the auth log:

```bash
for i in 1 2 3 4; do
  ssh -o BatchMode=yes -o ConnectTimeout=3 nosuchuser@172.16.10.40 exit
done
```

Expected output: four `Permission denied` (or connection-refused-by-policy) failures, one per attempt.

**[lab-hard1]** — confirm the ban:

```bash
sudo fail2ban-client status sshd
```

Expected output: `Currently banned: 1` and the attacker's IP listed under `Banned IP list`.

```bash
sudo iptables -L f2b-sshd -n 2>/dev/null || sudo nft list set inet f2b-table addr-set-sshd 2>/dev/null
```

Expected output: the attacker's IP address present in the ban table (exact command depends on whether your fail2ban build uses iptables or nftables backend — one of the two will show it).

**Checkpoint:** `fail2ban-client status sshd` shows the attacker's real IP under `Banned IP list`, populated by real failed attempts from a separate VM, not by manually inserting a ban.

---

## Phase 7 — unattended-upgrades

**[lab-hard1]**:

```bash
sudo apt install -y unattended-upgrades apt-listchanges
```

`/etc/apt/apt.conf.d/50unattended-upgrades` — key lines (uncomment/set in the existing file, don't duplicate):

```
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

`/etc/apt/apt.conf.d/20auto-upgrades`:

```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
```

`Automatic-Reboot "false"` is deliberate — an unattended kernel-update reboot on a lab VM you might be mid-session on is its own kind of self-inflicted lockout.

**Checkpoint:**

```bash
sudo unattended-upgrade --dry-run --debug 2>&1 | tail -30
```

Expected output: log lines showing it checked `Allowed origins`, found zero or more security packages eligible, and finished without an error (a dry run doesn't need anything to actually be pending).

---

## Phase 8 — AppArmor: enforce and observe

**[lab-hard1]**:

```bash
sudo apt install -y apparmor-utils apparmor-profiles tcpdump
sudo aa-status | grep -i tcpdump
```

Expected output: the tcpdump profile listed, likely already loaded (complain or enforce mode depends on your image).

Force it into enforce mode explicitly, whatever its prior state:

```bash
sudo aa-enforce /usr/sbin/tcpdump
sudo aa-status | grep -A1 -i "profiles are in enforce"| grep -i tcpdump
```

Expected output: `tcpdump` now appears in the enforce-mode list.

**[lab-hard1]** — trigger a denial. tcpdump's shipped profile restricts where it can write capture files; writing outside its allowed paths gets blocked:

```bash
sudo tcpdump -i lo -w /etc/tcpdump-test.pcap -c 1 &
sleep 2
ls -la /etc/tcpdump-test.pcap 2>&1
```

Expected output: the file either fails to appear or tcpdump reports a permission error — AppArmor blocked the write outside its profile's allowed paths, not a normal Unix permission problem.

**Checkpoint:**

```bash
sudo journalctl -k --since "2 min ago" | grep -i apparmor
```

Expected output: at least one line containing `apparmor="DENIED"`, `profile="/usr/sbin/tcpdump"`, and the `operation=` and `name=` fields naming the blocked path. That line is your proof the profile is actively enforcing, not just loaded.

---

## Phase 9 — re-run Lynis, compare

**[lab-hard1]**:

```bash
sudo lynis audit system --no-colors | sudo tee ~/hardening-baseline/lynis-after.txt
```

```bash
grep "Hardening index" ~/hardening-baseline/lynis-before.txt ~/hardening-baseline/lynis-after.txt
```

Expected output: two `Hardening index : NN` lines — the `-after` value must be at least 15 points higher than `-before`.

```bash
diff <(grep "suggestion\[\]" /var/log/lynis-report.dat) ~/hardening-baseline/lynis-before.txt | head -40
```

(This is a rough diff for eyeballing — Lynis regenerates `/var/log/lynis-report.dat` fresh each run, so the meaningful comparison is the suggestion list shrinking and the Hardening index rising, not a literal diff.)

**Checkpoint:** `lynis-after.txt`'s Hardening index is at least 15 points above `lynis-before.txt`'s, and the suggestion list is visibly shorter.

---

## Break-fix drills

Diagnose from the symptom before opening the hints. State what you observe, form a hypothesis, test it, then fix.

**Drill 1 — Over-hardening broke nginx's cert access**

Ask Claude, in this session, to install nginx on `lab-hard1` with a self-signed cert for this drill, then tighten the private key file's permissions/ownership in a way that's plausible under a "harden everything" mindset but breaks nginx's ability to read its own TLS key.

Symptom: `sudo systemctl status nginx` shows a failed start, and `curl -k https://localhost/` fails to connect. Before touching permissions by guesswork, add a temporary audit watch on the key file and reproduce the failure so you have hard evidence of *what* was denied and *to whom*, not just a hunch.

**Drill 2 — Locked out via `AllowGroups`**

Ask Claude to remove `labadmin` from the `ssh-users` group (or edit `AllowGroups` to name a group `labadmin` isn't in) and reload `sshd` on `lab-hard1`.

Symptom: every SSH attempt — key or otherwise — is refused before authentication is even attempted. You have no working shell on the box over the network. Recover using the Hyper-V console (Enhanced Session or Basic Session, whichever your Mission 01 setup uses) to get a local shell without SSH, fix the group membership or `AllowGroups` line, and reload.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `sudo auditctl -w /etc/ssl/... -p r -k nginx-cert-debug` (path depends on where you put the cert/key), restart nginx, then `sudo ausearch -k nginx-cert-debug` — look for a non-zero `exit=` code (e.g. `exit=-13` is `EACCES`, permission denied) on the read attempt, and check which UID/process made it (`www-data`, the nginx worker user).
- Drill 2: the Hyper-V console gives you a local console session that doesn't go through `sshd` at all — `AllowGroups` only gates the SSH daemon. From that console: `groups labadmin`, `sudo usermod -aG ssh-users labadmin`, `sudo systemctl reload ssh`, then retest from a real SSH client before closing the console.

</details>

---

## Prove-it: red-team drill

In a live Claude Code session, ask Claude to attempt **three** privilege-escalation or persistence techniques against your hardened `lab-hard1` — pick from categories like: editing `/etc/sudoers` or `/etc/passwd` directly to grant privilege, planting a cron job or an extra `authorized_keys` entry for persistence, running an unauthorized binary out of `/tmp`, or brute-forcing SSH. Don't ask for the exact commands in advance — the point is that you don't know precisely what's coming, only the category.

For each of the three attempts, you must:

1. Find the corresponding evidence in `ausearch`/`aureport` (or `fail2ban-client status sshd` for a brute-force attempt) — a specific audit event, not "I assume it was logged."
2. State in your own words exactly which control stopped it, or would have stopped it if it got further than detection: the `sudoers_changes`/`passwd_changes` audit watch, the `exec_uid1000` execve rule, `nosuid`/`nodev` on `/tmp`, `AllowGroups` + key-only SSH, or the fail2ban ban.

This is the actual deliverable of this phase — a live attack, real audit evidence, and a written explanation per attempt, not a checklist you tick from memory.

---

## Done when

- [ ] `lynis-before.txt` and `lynis-after.txt` both exist, and the Hardening index rose by 15+ points
- [ ] SSH accepts key-only auth for `ssh-users` members, refuses password auth outright, and refuses root login — proven from a second session before the first was ever closed
- [ ] `/tmp` mounts with `nosuid,nodev`; the unused-services checklist was run and unneeded services disabled+masked; `pam_faillock` locks an account after repeated failures and auto-unlocks per `unlock_time`
- [ ] `/etc/sysctl.d/99-hardening.conf` applied cleanly, every value reads back correctly via `sysctl`
- [ ] `/etc/audit/rules.d/hardening.rules` loaded; `ausearch`/`aureport` show at least one real captured sudoers-edit event
- [ ] fail2ban's `sshd` jail banned a real attacking IP generated from a separate VM
- [ ] `unattended-upgrades` dry-run completes cleanly with security origins allowed and auto-reboot disabled
- [ ] An AppArmor profile is confirmed in enforce mode, and a real `apparmor="DENIED"` line was captured in the journal
- [ ] Both break-fix drills reproduced, diagnosed (via audit evidence, not guesswork), and fixed
- [ ] The red-team prove-it drill run live: three attack attempts, three pieces of audit/fail2ban evidence, three written explanations of what stopped or would stop each
