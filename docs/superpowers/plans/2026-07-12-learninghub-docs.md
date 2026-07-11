# LearningHub Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the complete LearningHub document set: hub README, capstones, three learning tracks (10 missions each, README + GUIDE per mission), and eight money-project folders (README + PLAYBOOK + TRACKER each).

**Architecture:** Pure-documentation repository. Each task produces one self-contained folder of Markdown files, verified against placeholder and structure checks, then committed. Tasks are independent within a track; track README tasks come first because mission docs link back to them.

**Tech Stack:** Markdown, git. Guides reference: Hyper-V, Ubuntu 24.04, Rocky 9, Docker, kind, k3s, Terraform (bpg/proxmox), Packer, Ansible, ArgoCD, Prometheus/Grafana/Loki/Tempo, Proxmox VE 8.x + PBS, GitHub Actions.

## Global Constraints

These apply to EVERY task. Every task's requirements implicitly include this section.

**Spec:** `docs/superpowers/specs/2026-07-12-learninghub-design.md` — the approved design. Do not contradict it.

**Audience/voice:** Advanced IT user. Plain, direct English. No filler, no motivational fluff. Every command in a fenced code block with expected output or success indicator. Windows host commands in PowerShell; Linux guest commands in bash. State which machine each command runs on.

**Banned patterns (plan failure if present in any produced doc):** `TBD`, `TODO`, `FIXME`, "fill in", "coming soon", "left as an exercise" (except inside a Prove-It challenge, which is deliberate), empty sections, dead relative links.

**Mission README.md template (learning tracks):**

```markdown
# Mission NN — <Name>

**Track:** <sysops|devops|proxmox> · **Difficulty:** 💀..💀💀💀💀💀 · **Time:** <estimate>
**Prerequisites:** <missions or "none">

## Goal
<2-4 sentences: what you build, why it matters in real jobs>

## Skills gained
<bullet list, concrete: "write nftables rulesets", not "networking">

## Deliverables
<checklist of artifacts that must exist when done>

## Start
Open a Claude Code session in this folder and say: `start <track>/NN`. Follow GUIDE.md.
```

**Mission GUIDE.md template (learning tracks):**

```markdown
# Guide — Mission NN: <Name>

## Phase 0 — Setup check
<verify prerequisites with commands; expected outputs>

## Phase 1..N — <phase name>
<numbered steps. Each step: what to do, exact command(s), expected output.
Every phase ends with a **Checkpoint:** block — a verification command whose
output proves the phase worked. Do not continue on checkpoint failure.>

## Break-fix drills
<numbered scenarios. Each: sabotage description ("in a Claude session, ask
Claude to run the sabotage for drill N"), symptom the user sees, and the
rule: diagnose before reading hints. No inline solutions.>

## Prove-it challenges
<numbered problems, no answers inline. Acceptance criteria stated.>

## Hints
<details><summary>Hints for drills and challenges (open only when stuck)</summary>
<one short nudge per drill/challenge, not full solutions>
</details>

## Done when
<final acceptance checklist mirroring README deliverables>
```

**Money README.md template:**

```markdown
# NN — <Idea name>

**Model:** <one line> · **First $ (typical):** <range> · **Ceiling:** $<range>/mo · **Payout:** <method>
**AI does:** <list> · **You do:** <list>

## Honest expectations
<3-5 sentences: variance, failure odds, what actually drives success>

## Rules and compliance
<platform ToS notes, AI-disclosure requirements, IP/trademark rules, banned tactics>

## Eligibility check
<numbered steps to verify country/payment eligibility BEFORE investing time>

## Kill / scale criteria
<explicit: abandon if X by week N; double down if Y>
```

**Money PLAYBOOK.md template:**

```markdown
# Playbook — <Idea name>

## Phase 1 — Setup (once)
<numbered steps; mark each [YOU] or [AI]. [YOU] = accounts, verification,
payments, sending, publishing. [AI] = drafting, building, generating.>

## Phase 2 — Operating loop (<daily|burst> · ~<time> per cycle)
<numbered loop steps, each marked [YOU]/[AI], with concrete quantities
(e.g. "10 proposals", "5 designs")>

## Phase 3 — Scaling
<what to change once first revenue lands>

## Templates and prompts
<concrete starting artifacts: outreach email skeletons, gig description
skeletons, prompt patterns for the AI session — real text, not descriptions>
```

**Money TRACKER.md template:**

```markdown
# Tracker — <Idea name>

| Date | Hours | Action taken | Revenue | Expenses | Notes |
|------|-------|--------------|---------|----------|-------|

## Weekly review
<5 fixed questions: revenue vs target, hours vs plan, what worked,
what to stop, kill/scale check against README criteria>
```

**Money compliance floor (every money doc):** no fake reviews, no account misrepresentation, no spam, no undisclosed AI where a platform requires disclosure (Amazon KDP, Adobe Stock), no trademark/IP infringement, no fabricated credentials. Income figures always framed as ranges with no guarantee. Note that taxes are the user's responsibility (one line, no tax advice).

**Verification command (every task):** from repo root:
```
git grep -nE "TBD|TODO|FIXME|fill in|coming soon" -- <task folder>
```
Expected: no output. Also open each produced file and confirm every template section exists and is non-empty.

**Commit style:** one commit per task, message given in the task. All commits end with:
```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 1: Hub README + capstones

**Files:**
- Create: `README.md`
- Create: `capstones/README.md`

**Interfaces:**
- Produces: hub navigation and progress dashboard that all track READMEs are linked from; capstone definitions referenced by sysops/devops/proxmox mission 10 docs and money/03.

- [ ] **Step 1: Write `README.md`** with sections: (1) What this is — one paragraph; (2) Map — table of four tracks + capstones with one-line description and link; (3) How to use — workflow: open Claude Code session, say `start <track>/<NN>`, follow GUIDE.md, guides adapt live in-session; (4) Progress dashboard — checkbox table per track listing all 10 missions (names from spec tables) and all 8 money folders; (5) Ground rules — learning tracks: no copy-paste without understanding checkpoints, break-fix drills are mandatory; money track: compliance floor summary + link to `money/README.md`.
- [ ] **Step 2: Write `capstones/README.md`** describing both capstones from the spec: **Capstone A — Full-Stack Money Machine:** micro-tool from `money/03` containerized (devops/02), pipelined (devops/03+07), deployed to k3s on Proxmox (proxmox/08), observed (devops/08); prerequisites listed as exact mission links; acceptance: paying-capable tool reachable via HTTPS, deployed only via git, dashboards show traffic. **Capstone B — Company Private Cloud:** points to `proxmox/10-capstone-private-cloud/` as the executable mission; acceptance: teammate provisions a VM via PR with zero admin help.
- [ ] **Step 3: Verify** per Global Constraints (grep + section check on both files).
- [ ] **Step 4: Commit:** `docs: add hub README and capstones`

### Task 2: sysops track README

**Files:**
- Create: `sysops/README.md`

**Interfaces:**
- Produces: canonical lab topology all sysops guides reference: Hyper-V internal switch `LabSwitch`, NAT network `172.16.10.0/24`, gateway `172.16.10.1`, domain `lab.local`, VM naming `lab-<role>` (e.g. `lab-dns1`), Ubuntu 24.04 + Rocky 9 template names `tpl-ubuntu2404`, `tpl-rocky9`.

- [ ] **Step 1: Write `sysops/README.md`**: track goal (job-ready Linux sysadmin via on-PC Hyper-V lab); the lab topology block above (verbatim values — all mission guides must use them); mission table (10 rows from spec: number, name, difficulty 💀 rating ascending 1→5, skills, time estimate); progression advice (01 mandatory first, 02-09 any order, 10 last); host requirements (Win11 Pro, 32GB RAM, ~200GB free disk, Hyper-V enabled).
- [ ] **Step 2: Verify** per Global Constraints.
- [ ] **Step 3: Commit:** `docs(sysops): add track README with lab topology`

### Task 3: sysops/01-lab-forge

**Files:**
- Create: `sysops/01-lab-forge/README.md`, `sysops/01-lab-forge/GUIDE.md`

**Interfaces:**
- Consumes: topology values from `sysops/README.md` (LabSwitch, 172.16.10.0/24, tpl-ubuntu2404, tpl-rocky9).
- Produces: working templates + snapshot/clone workflow every later sysops mission assumes.

- [ ] **Step 1: Write README** per template. Difficulty 💀💀. Time 4-6h. Deliverables: Hyper-V lab network up, two reusable templates, documented clone procedure, 3 test VMs cloned with static IPs.
- [ ] **Step 2: Write GUIDE** with phases: (1) Enable Hyper-V (`Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All`), reboot check; (2) Create internal switch + NAT (`New-VMSwitch -Name LabSwitch -SwitchType Internal`, `New-NetIPAddress 172.16.10.1`, `New-NetNat -InternalIPInterfaceAddressPrefix 172.16.10.0/24`), checkpoint: host pings 172.16.10.1; (3) Download Ubuntu 24.04 + Rocky 9 ISOs, create gen-2 VM (secure boot template for Linux), install Ubuntu with OpenSSH, static IP via netplan example given in full; (4) Generalize into template: clean machine-id, ssh host keys, shutdown, export or mark do-not-boot; repeat for Rocky (nmcli static config shown); (5) Clone workflow: import/copy VHDX, regenerate identity, checklist; (6) Snapshot discipline: checkpoint before every mission, naming `pre-mission-NN`. Break-fix drills: (1) NAT deleted — VMs lose internet; (2) two clones boot with same IP — conflict diagnosis. Prove-it: clone 3 VMs with static .21/.22/.23 addresses and SSH between all pairs in under 10 minutes.
- [ ] **Step 3: Verify** per Global Constraints.
- [ ] **Step 4: Commit:** `docs(sysops): add mission 01 lab-forge`

### Task 4: sysops/02-linux-deep-core

**Files:**
- Create: `sysops/02-linux-deep-core/README.md`, `sysops/02-linux-deep-core/GUIDE.md`

**Interfaces:**
- Consumes: one Ubuntu clone from mission 01.

- [ ] **Step 1: Write README** per template. Difficulty 💀💀💀. Time 8-12h. Deliverables: custom systemd service + timer running, cgroup-limited process demo, sudoers policy, four break-fix drills solved.
- [ ] **Step 2: Write GUIDE** phases: (1) systemd anatomy — write real unit `/etc/systemd/system/labmon.service` (full unit file given: simple bash script logging disk usage), enable/start, `systemctl status` expected output; add `labmon.timer` (full file); (2) journald — `journalctl -u`, `-p err`, `--since`, persistent journal config; (3) targets and dependencies — `After=`, `Requires=`, dependency graph reading with `systemctl list-dependencies`; (4) cgroups v2 — `systemd-run --scope -p MemoryMax=100M stress-ng ...`, watch the OOM kill, `systemd-cgtop`; (5) users/sudo — create ops user, group, drop-in `/etc/sudoers.d/ops` (exact content, `visudo -cf` check); (6) process forensics — strace a failing command, lsof on deleted-but-open file, /proc/<pid> tour, signals table. Break-fix drills: (1) fstab entry corrupted → emergency mode recovery; (2) service masked → unit "not found"; (3) sudoers syntax error → locked out of sudo, recover via root shell/recovery boot; (4) fork bomb → contain via cgroup then prevent via limits. Prove-it: I hand you a VM where `labmon.service` fails on boot for a reason you have not seen; produce written root-cause + fix.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 02 linux-deep-core`

### Task 5: sysops/03-storage-wars

**Files:**
- Create: `sysops/03-storage-wars/README.md`, `sysops/03-storage-wars/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: LVM stack built and extended live, degraded RAID rebuilt, ZFS pool with snapshots + send/recv replica, LUKS volume auto-unlocked at boot.
- [ ] **Step 2: Write GUIDE** phases: (1) Attach 4 virtual disks via PowerShell `Add-VMHardDiskDrive` (commands given); (2) partitioning with gdisk; (3) LVM — pvcreate/vgcreate/lvcreate, ext4 + xfs, online extend (`lvextend -r`), LVM snapshot + revert; (4) mdadm — RAID1 build, `/proc/mdstat` reading, fail a member (`mdadm --fail`), hot-rebuild, then RAID5 with 3 disks; (5) ZFS — install zfsutils, mirrored pool `tank`, datasets with compression + quotas, snapshot/rollback, `zfs send | ssh ... zfs recv` to second VM; (6) LUKS — cryptsetup luksFormat, crypttab + keyfile, verify at reboot; (7) quotas — xfs_quota project quota example. Break-fix: (1) disk yanked from RAID5 while writing (PowerShell remove disk) — recover; (2) filesystem full but `du` disagrees with `df` (deleted open file) — find and free; (3) LV deleted — recover via `vgcfgrestore`. Prove-it: migrate a live directory from LVM ext4 volume to a ZFS dataset with under 60 seconds of unavailability; document the cutover plan first.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 03 storage-wars`

### Task 6: sysops/04-network-fortress

**Files:**
- Create: `sysops/04-network-fortress/README.md`, `sysops/04-network-fortress/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: 3-VM segmented network (VLANs), default-deny nftables on all nodes, WireGuard tunnel, authoritative DNS for lab.local, DHCP with dynamic DNS updates.
- [ ] **Step 2: Write GUIDE** phases: (1) netplan static + verification (`ip -br a`, `ip r`); (2) Linux bridge + VLAN subinterfaces (802.1q, `vlan10`/`vlan20` on a router VM with `sysctl net.ipv4.ip_forward=1`); (3) bonding active-backup demo (two NICs via Hyper-V, failover test with ping running); (4) nftables — full ruleset file given (default-deny input, established/related, ssh allow, NAT masquerade on router, port-forward example), `nft -f` load + persistence; (5) WireGuard — keypairs, `wg0.conf` both ends (full configs), tunnel between two VMs, allowed-ips explained; (6) bind9 — authoritative zone `lab.local` (zone file + named.conf.local in full), forward+reverse, `dig` checkpoints; (7) Kea DHCP — subnet config JSON, DDNS to bind9 with TSIG key (full config); (8) tcpdump — capture DHCP handshake and DNS query, read them. Break-fix: (1) wrong gateway on one VM — reachable one-way; (2) MTU 1300 on router — big transfers hang, small pings fine; (3) firewall locks out SSH — recover via Hyper-V console; (4) DNS forwarding loop — SERVFAIL storms. Prove-it: design and build net for 3-tier app: web VLAN reachable from lab only on 443, app VLAN only from web, db VLAN only from app; prove with nmap scans from each segment.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 04 network-fortress`

### Task 7: sysops/05-service-citadel

**Files:**
- Create: `sysops/05-service-citadel/README.md`, `sysops/05-service-citadel/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time 16-24h. Warning line: mail is the hardest single service in the track — expected. Deliverables: private CA + TLS everywhere, nginx reverse proxy, working internal mail (send/receive via IMAP client), FreeIPA SSO with two enrolled clients.
- [ ] **Step 2: Write GUIDE** phases: (1) private CA with openssl (CA key/cert commands, signing script, install CA into VM trust stores); (2) nginx reverse proxy with upstream + TLS (full server block), redirect 80→443; (3) Postfix — internal-only MTA for lab.local (main.cf key directives with explanations), Dovecot IMAP + Maildir, test with `swaks` and an IMAP client, mailq/postqueue debugging; (4) DNS records for mail: MX, SPF TXT, DKIM key + opendkim, DMARC TXT in bind zone (exact records); (5) FreeIPA — server install on Rocky VM (`ipa-server-install` answers given), enroll two Ubuntu clients (`ipa-client-install`), create users/groups, kinit + SSO ssh between clients, sudo rule via IPA, HBAC rule restricting one host. Break-fix: (1) cert expired (I re-sign with past date) — TLS failures, rotate; (2) mail stuck in queue (DNS for MX broken) — read queue, trace, fix; (3) Kerberos auth fails from time skew — diagnose via klist/logs. Prove-it: one documented command sequence onboards new employee: IPA user + mail working + SSO ssh to all clients; run it for user `newhire01` and show evidence.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 05 service-citadel`

### Task 8: sysops/06-all-seeing-eye

**Files:**
- Create: `sysops/06-all-seeing-eye/README.md`, `sysops/06-all-seeing-eye/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: Prometheus scraping all lab VMs, Grafana with one imported + one self-built dashboard, Alertmanager mailing alerts via mission 05 Postfix, Loki centralizing logs, two written runbooks.
- [ ] **Step 2: Write GUIDE** phases: (1) Prometheus install (binary + systemd unit given), `prometheus.yml` with static targets; (2) node_exporter on every VM via one-line install script (given) + unit; (3) PromQL basics — rate(), CPU%, disk prediction `predict_linear`, recording rule example (full rules file); (4) Alertmanager — route/receiver config to lab SMTP (full YAML), alert rules: DiskWillFillIn4Hours, ServiceDown (exact expressions); (5) Grafana — install, provision Prometheus datasource (provisioning YAML), import node-exporter-full dashboard by ID, then author own 4-panel dashboard (panel-by-panel instructions); (6) Loki + promtail configs (full YAML both), LogQL queries incl. error-rate; (7) runbooks — template given; write DiskFull + ServiceDown runbooks. Break-fix: (1) scrape target silently dropped by bad relabel config; (2) alert flapping from missing `for:` duration; (3) cardinality explosion from a label on a per-request metric — find via `prometheus_tsdb` metrics. Prove-it: I trigger a disk-fill on a random VM; alert must reach the mail inbox and you resolve using only your runbook, timed 20 minutes.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 06 all-seeing-eye`

### Task 9: sysops/07-doomsday-drill

**Files:**
- Create: `sysops/07-doomsday-drill/README.md`, `sysops/07-doomsday-drill/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 8-10h. Deliverables: restic backups of all critical VMs on schedule, written backup policy (RPO/RTO per system), one full timed restore performed and documented.
- [ ] **Step 2: Write GUIDE** phases: (1) backup policy first — worksheet: list lab systems, assign RPO/RTO, what data vs config; (2) restic — init repo on a dedicated backup VM over SFTP, env-file pattern for password, `restic backup` with excludes (full command), verify with `restic snapshots`/`check`; (3) systemd timer for nightly backups (unit + timer files given), success/failure alert integration with mission 06 (textfile collector or curl to Alertmanager); (4) prune policy — `restic forget --keep-daily 7 --keep-weekly 4 --prune` reasoning; (5) restore drills — single file as-of-N-days, full directory, full-system rebuild: fresh clone + restore config/data + service validation; (6) database-aware backups — mariadb install + `mariadb-dump` pre-backup hook script (given). Drill (the point of the mission): in a live session I pick one VM and destroy it without warning (disk delete). Clock starts. Restore to working state within your written RTO. Postmortem template included; fill it after. Prove-it: restore `/etc/nginx` exactly as it was 3 snapshots ago and prove with diff.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 07 doomsday-drill`

### Task 10: sysops/08-hardening

**Files:**
- Create: `sysops/08-hardening/README.md`, `sysops/08-hardening/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: Lynis score raised ≥15 points on one VM, SSH locked down lab-wide, auditd catching privilege escalation attempts, fail2ban active, documented hardening baseline applicable to future VMs.
- [ ] **Step 2: Write GUIDE** phases: (1) baseline — run Lynis, save report, pick top findings; (2) SSH — keys only, `PasswordAuthentication no`, `PermitRootLogin no`, `AllowGroups ssh-users`, test-before-disconnect procedure (keep session open!); (3) CIS subset — filesystem mount options (nodev/nosuid on /tmp via systemd mount override, file given), disable unused services checklist, password/lockout policy via pam_faillock (config given); (4) sysctl hardening file (given: rp_filter, redirects off, martians log, etc.) with one-line explanations each; (5) auditd — rules file (given) watching /etc/sudoers, /etc/passwd, execve by uid≥1000, ausearch/aureport usage; (6) fail2ban — sshd jail local config (given), trigger it from another VM, check banned IP; (7) unattended-upgrades config; (8) AppArmor — enforce an existing profile, read denials in journal; (9) re-run Lynis, compare score. Break-fix: (1) over-hardening broke a service (nginx can't read cert after perms change) — diagnose via audit log; (2) you locked yourself out via AllowGroups — console recovery. Prove-it (red-team drill): in a live session I attempt 3 privilege-escalation/persistence tricks on your hardened VM; you must produce auditd evidence of all 3 and explain what stopped or would stop each.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 08 hardening`

### Task 11: sysops/09-automation

**Files:**
- Create: `sysops/09-automation/README.md`, `sysops/09-automation/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: bash toolkit passing shellcheck, Ansible repo (inventory, 4+ roles, vault) that rebuilds core lab from blank template clones with one command.
- [ ] **Step 2: Write GUIDE** phases: (1) bash advanced — template script skeleton (given: `set -euo pipefail`, trap cleanup, getopts, log function), rewrite two scripts from earlier missions with it, shellcheck clean; (2) Ansible setup — control node, inventory INI with groups (dns, web, monitor), ad-hoc commands; (3) first playbook + idempotency (run twice, zero changes second run — checkpoint); (4) roles — build `common` (users, ssh hardening from mission 08, packages), `nginx` (from mission 05), `node_exporter` (from mission 06); role skeleton layout shown; (5) templates + handlers — nginx.conf.j2 with variables, restart handler; (6) ansible-vault — encrypt secrets, vault-id usage; (7) tags, `--check --diff` workflow; (8) site.yml composing everything (full file given). Grand deliverable run: clone 3 blank VMs from template, `ansible-playbook site.yml`, entire core lab configured. Break-fix: (1) playbook not idempotent (shell task without creates:) — find and fix; (2) handler never fires — notify chain broken. Prove-it: I delete arbitrary config files across your VMs; one playbook run restores everything; drift report via `--check` first.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 09 automation`

### Task 12: sysops/10-capstone-minicorp

**Files:**
- Create: `sysops/10-capstone-minicorp/README.md`, `sysops/10-capstone-minicorp/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time: one weekend. Prerequisites: all of 01-09. Deliverables: 6-VM company infra built from zero via Ansible, ops runbook, survived 3-failure chaos drill.
- [ ] **Step 2: Write GUIDE.** Scenario framing: "MiniCorp hired you as the only sysadmin; empty rack." Spec table of 6 VMs: router/firewall, dns+dhcp, ipa, files+mail, monitoring, backup — each with required services (all built in prior missions), IPs from lab topology plan. Rules: everything via Ansible (mission 09 repo extended), snapshots only at phase boundaries, runbook updated as you go. Phases: (1) network + router; (2) core services (DNS/DHCP/IPA); (3) mail + files; (4) monitoring + backup coverage of all nodes; (5) acceptance checklist (25+ items given: every service, every alert path, every backup verified, onboarding run for 2 users, restore drill passed). Chaos drill format: 3 staged failures in one session (from a given pool: node death, DNS poison-ish misconfig, cert expiry, disk fill, corrupted service config), timed, runbook-only. Postmortem required. No hints section — capstone rule stated: guides are closed, only your own runbook and man pages.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(sysops): add mission 10 capstone-minicorp`

### Task 13: devops track README

**Files:**
- Create: `devops/README.md`

**Interfaces:**
- Produces: definition of **shiplog**, the lifecycle app all devops missions use: FastAPI URL-shortener with hit-stats, Postgres backend, `/healthz` + `/metrics` endpoints, repo lives at `devops/shiplog/` (created in mission 02). All later mission docs reference this name and layout.

- [ ] **Step 1: Write `devops/README.md`**: track goal (ship one real app from laptop to GitOps-managed k8s with full observability); introduce shiplog (paragraph + endpoint table: `POST /links`, `GET /{slug}`, `GET /stats/{slug}`, `GET /healthz`, `GET /metrics`); mission table (10 rows from spec with difficulty ascending, time estimates); tool install prerequisites (Docker Desktop or docker in WSL2, kind, kubectl, helm, terraform, git, gh CLI) with version-check commands; progression: 01-03 in order, 04-05 in order, 06 anytime, 07-08 after 04, 09 after 07, 10 last.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(devops): add track README defining shiplog app`

### Task 14: devops/01-git-mastery

**Files:**
- Create: `devops/01-git-mastery/README.md`, `devops/01-git-mastery/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀. Time 4-6h. Deliverables: rescued mangled repo, bisect-found bug, pre-commit hooks running, first GitHub Actions workflow green.
- [ ] **Step 2: Write GUIDE** phases: (1) setup playground repo with seeded history (script given that generates 30 commits incl. a bug commit for bisect); (2) interactive rebase — squash/reword/reorder/edit on a feature branch, `--onto` case; (3) `git bisect run` with test script (given); (4) reflog rescue — hard-reset "disaster" then recover; (5) hooks — pre-commit framework config (given: shellcheck, trailing whitespace, no-commit-to-main), install, trigger; (6) trunk-based workflow explained + branch protection setup on GitHub (steps); (7) worktrees for parallel work; (8) first Actions workflow (full YAML: lint job on push/PR), push, watch run. Break-fix: (1) detached HEAD with unpushed commits — save them; (2) rebase gone wrong mid-flight — abort vs continue decision; (3) force-push clobbered teammate work — recover from reflog/remote. Prove-it: I hand you a repo with tangled merge history, a lost commit, and a secret accidentally committed 5 commits back; deliver clean history with the secret fully purged (filter-repo) and the lost commit restored.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 01 git-mastery`

### Task 15: devops/02-docker-deep

**Files:**
- Create: `devops/02-docker-deep/README.md`, `devops/02-docker-deep/GUIDE.md`

**Interfaces:**
- Produces: `devops/shiplog/` source layout later missions build on: `app/main.py`, `app/db.py`, `tests/`, `Dockerfile`, `compose.yaml`, `requirements.txt`.

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: shiplog built and running via compose with Postgres, final image <80MB non-root with zero HIGH/CRITICAL trivy findings, image pushed to ghcr.io.
- [ ] **Step 2: Write GUIDE** phases: (1) build shiplog with AI pair (endpoint spec from track README; guide includes complete `main.py` reference implementation ~80 lines and `requirements.txt` so the mission is self-contained); (2) naive Dockerfile first (given), measure size, then multi-stage (given: builder + `python:3.12-slim` runtime, venv copy, non-root `USER app`, HEALTHCHECK), compare; (3) `.dockerignore`; layer-cache experiment: change code vs change requirements, observe rebuild times; (4) compose.yaml (full file: app + postgres:16 + volume + healthcheck-gated depends_on), up, exercise endpoints with curl (commands + expected JSON); (5) trivy scan, read findings, fix base-image pin; (6) dive — inspect layers, find waste; (7) push to ghcr with PAT (steps). Break-fix: (1) container works locally, dies in compose — env var vs localhost DB host; (2) permission denied on volume as non-root user; (3) healthcheck flaps under load. Prove-it: get runtime image under 80MB without breaking tests, document each MB saved and what it cost.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 02 docker-deep`

### Task 16: devops/03-cicd-forge

**Files:**
- Create: `devops/03-cicd-forge/README.md`, `devops/03-cicd-forge/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: full pipeline (test→scan→build→push→release) on shiplog repo, self-hosted runner in a lab VM, PR-to-release under 5 minutes demonstrated.
- [ ] **Step 2: Write GUIDE** phases: (1) test job — pytest matrix (3.11/3.12), pip caching (full workflow YAML incrementally built through the mission); (2) trivy scan job gating merge; (3) build+push job to ghcr on main with sha + semver tags, `docker/metadata-action`; (4) release — tag push triggers release workflow with auto-changelog (`softprops/action-gh-release`); (5) self-hosted runner — register in Ubuntu VM (steps + systemd service), label it, route heavy job to it, security note: never on public-fork repos; (6) environments — `staging`/`prod` with required reviewer on prod, deployment job placeholder that later missions replace with ArgoCD note; (7) secrets handling — repo secrets, `GITHUB_TOKEN` permissions block minimal. Break-fix: (1) cache key never hits — hash misuse; (2) workflow can't push package — permissions: packages:write missing; (3) runner offline mid-job — recover, make job idempotent. Prove-it: open PR with failing test — merge blocked; fix, merge, tagged release with image appears with zero manual steps; screen-record it under 5 min.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 03 cicd-forge`

### Task 17: devops/04-k8s-core

**Files:**
- Create: `devops/04-k8s-core/README.md`, `devops/04-k8s-core/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: 3-node kind cluster running shiplog behind ingress, default-deny NetworkPolicies, least-privilege RBAC, 5 seeded failures fixed under time.
- [ ] **Step 2: Write GUIDE** phases: (1) kind 3-node config (full YAML with ingress port mappings), create, node inspection; (2) raw manifests for shiplog — Deployment (with resources, liveness `/healthz`, readiness), Service, ConfigMap for settings, Secret for DB URL (all manifests given in full); Postgres via StatefulSet-lite Deployment+PVC for now (noted: proper StatefulSet in 05); (3) ingress-nginx install for kind + Ingress manifest, curl through localhost checkpoint; (4) rollout mechanics — change image tag, watch rollout, `rollout undo`, maxSurge/maxUnavailable experiment; (5) RBAC — ServiceAccount for shiplog with zero perms, then a `list pods` Role+Binding demo with `kubectl auth can-i` proofs; (6) NetworkPolicy — default-deny all, then allow dns, allow ingress→app, app→db (all YAML given), verify with `kubectl exec` curl tests; (7) debugging toolbox — describe/events/logs --previous/exec/port-forward/`kubectl debug` ephemeral container. Break-fix drill set (I seed via session): CrashLoopBackOff (bad env), ImagePullBackOff (typo tag), Pending (impossible resources), OOMKilled (low limit), Service selector mismatch — 5 scenarios, 40-minute clock, write one-line root cause each. Prove-it: from zero, redeploy whole stack from manifests in <10 min without the guide.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 04 k8s-core`

### Task 18: devops/05-k8s-advanced

**Files:**
- Create: `devops/05-k8s-advanced/README.md`, `devops/05-k8s-advanced/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: authored Helm chart deploying whole stack across 3 value-sets, HPA scaling under k6 load, proper Postgres StatefulSet, kustomize comparison written.
- [ ] **Step 2: Write GUIDE** phases: (1) helm create then strip to real chart for shiplog — templates for deploy/svc/ingress/secret, `_helpers.tpl` naming, values.yaml with image/resources/ingress host/replicas (key templates given in full); (2) chart best practices — required values via `required`, checksum annotation for config rollouts; (3) `helm template` diff-driven development, `helm test` hook with curl job; (4) three values files: dev/staging/prod (replicas, resources, host differ); (5) Postgres as real StatefulSet (full manifest: volumeClaimTemplates, headless svc, init from secret) or note on using bitnami chart — both paths, pick one, tradeoff table; (6) metrics-server on kind (patch for insecure TLS), HPA v2 manifest on CPU (given), k6 script (given) to trigger scale-out, watch; (7) PDB + what it blocks during drain (demo with `kind` node drain); (8) kustomize overlays reproducing the 3 envs, written comparison: when helm vs kustomize. Break-fix: (1) helm upgrade stuck pending — another operation in progress, find and clear; (2) HPA at max but latency worse — limits vs requests misset; (3) StatefulSet pod stuck terminating with PVC. Prove-it: `helm install shiplog ./chart -f values-prod.yaml` on a fresh kind cluster = fully working HTTPS app, one command, no edits.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 05 k8s-advanced`

### Task 19: devops/06-iac

**Files:**
- Create: `devops/06-iac/README.md`, `devops/06-iac/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Deliverables: Terraform managing local docker + kind resources via a reusable module, remote state in MinIO, Packer-built Ubuntu image with node_exporter baked (consumed later by proxmox/03).
- [ ] **Step 2: Write GUIDE** phases: (1) TF fundamentals on docker provider — provider block, resource, plan/apply/destroy cycle (full configs), state file inspection `terraform state list/show`; (2) variables/outputs/locals, tfvars; (3) write module `modules/web-container` (nginx with port/name inputs), call it twice — DRY demo; (4) remote state — MinIO container as S3 backend (compose file given), backend config, migrate state, why remote state + locking matters; (5) workspaces dev/prod with count differences; (6) drift — manually change a container, `terraform plan` shows drift, reconcile; (7) Packer — ubuntu cloud-image build with provisioner installing node_exporter + qemu-guest-agent (full HCL given, qemu builder), output artifact noted for proxmox track reuse; (8) validation gates — fmt/validate/tflint in a GH Actions workflow (YAML given). Break-fix: (1) state lost — reimport resources with `terraform import`; (2) two applies collide — lock error, explain; (3) module change breaks caller — version pinning lesson. Prove-it: colleague (me) asks for identical second environment: one tfvars file + one command, nothing else changed.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 06 iac`

### Task 20: devops/07-gitops

**Files:**
- Create: `devops/07-gitops/README.md`, `devops/07-gitops/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: ArgoCD managing dev/staging/prod shiplog from git, sealed-secrets, CI bumping image tags via PR, rollback via `git revert` demonstrated, kubectl never used for deploys.
- [ ] **Step 2: Write GUIDE** phases: (1) gitops repo layout (tree given: `apps/shiplog/{base,envs/dev,envs/staging,envs/prod}` using helm chart from 05 + values per env); (2) ArgoCD install on kind, UI + CLI login, first Application manifest (given) pointing at dev; (3) app-of-apps root application (given) managing all three envs; (4) sync policies — auto for dev, manual for prod, prune + self-heal demo (delete a deployment, watch it return); (5) sealed-secrets controller, `kubeseal` workflow for DB secret (commands given), commit sealed secret safely; (6) CI integration — GH Actions job from mission 03 extended: on release, open PR against gitops repo bumping image tag in dev values (yq command + `peter-evans/create-pull-request` YAML given); promotion = PR from dev values to staging/prod; (7) sync waves + presync db-migration job hook (manifest given); (8) rollback — bad release, `git revert`, argo syncs back; incident note comparing with `rollout undo`. Break-fix: (1) app OutOfSync loop — mutating webhook/defaulted field, use ignoreDifferences; (2) sealed secret won't decrypt — wrong namespace/name scope; (3) deleted Application with cascade — what died, restore from git. Prove-it: full journey — code change → CI release → auto PR to dev → promote via PRs to prod, with zero kubectl, evidenced by argo history + git log only.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 07 gitops`

### Task 21: devops/08-observability

**Files:**
- Create: `devops/08-observability/README.md`, `devops/08-observability/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Deliverables: shiplog emitting OTel traces+metrics, kube-prometheus-stack + Tempo + Loki running, logs↔traces↔metrics cross-linked in Grafana, RED dashboard, multiwindow burn-rate SLO alerts, root-cause found from traces in drill.
- [ ] **Step 2: Write GUIDE** phases: (1) instrument shiplog — `opentelemetry-instrument` auto-instrumentation env vars in helm values (given) + one custom span + one custom counter in code (code given); (2) OTel Collector deployment (config given: OTLP in, batch, exporters to Tempo + Prometheus remote-write); (3) kube-prometheus-stack via helm values (given, trimmed), Tempo single-binary, Loki+promtail — install order + checkpoints; (4) Grafana correlation — datasource config with derived fields (trace_id regex in logs → Tempo link, exemplars on); structured logging in app: JSON with trace_id (logging config given); (5) RED dashboard build — rate/error/duration panels from histogram (PromQL given per panel); (6) SLO — define 99% availability + p95<300ms, burn-rate alerts multiwindow (2 rules given with math explained); (7) trace-debugging drill: I deploy a shiplog variant with hidden 400ms sleep in one code path + intermittent 500s in another; find both from Grafana only, no code reading, written diagnosis. Break-fix: (1) traces missing — collector OTLP port/protocol mismatch; (2) exemplars not linking — histogram vs native config; (3) Loki drops logs — label cardinality too high. Prove-it: the drill in phase 7 is the prove-it; acceptance = both root causes named with trace screenshots.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 08 observability`

### Task 22: devops/09-chaos-sre

**Files:**
- Create: `devops/09-chaos-sre/README.md`, `devops/09-chaos-sre/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 8-12h. Deliverables: k6 load profiles, 4 chaos-mesh experiments run against hypotheses, one full gameday executed, 2 postmortems written, error budget policy doc.
- [ ] **Step 2: Write GUIDE** phases: (1) k6 — smoke/load/stress/soak scripts (all four given, thresholds set from mission 08 SLOs), run against shiplog, read summaries; (2) steady-state hypothesis worksheet (template given): "given X load, killing one pod keeps error rate <1%"; (3) chaos-mesh install on kind, experiments with manifests given: pod-kill, network-delay (100ms on db), io-stress, cpu-stress — each run = hypothesis → run under k6 load → verdict; (4) fixes loop — whatever failed hypothesis becomes work item (e.g. missing PDB, no retries, one replica db reality acknowledged); (5) gameday — full format doc: roles (incident commander = you, chaos agent = me in session), comms log template, 60-min scenario, SLO tracking during; (6) postmortem template (given: timeline, impact, root cause, contributing factors, action items — blameless rules) + write 2 from actual drills; (7) error budget — compute from SLO, policy: what happens at 50%/100% burn (feature freeze rule), one-page doc. Prove-it: survive gameday with SLO intact, or exceed budget and produce a postmortem with ≥3 actionable items you then implement.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 09 chaos-sre`

### Task 23: devops/10-capstone-zero-to-prod

**Files:**
- Create: `devops/10-capstone-zero-to-prod/README.md`, `devops/10-capstone-zero-to-prod/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time: one focused day (timed). Prerequisites: 01-09. Deliverables: from empty dir, `make bootstrap` produces cluster + ArgoCD + pipelines + shiplog + observability; acceptance checklist passed.
- [ ] **Step 2: Write GUIDE.** Rules: guides closed, own notes/repos allowed (that's the point — your artifacts from 01-09 are your platform library). Requirements spec (not steps): (1) one command `make bootstrap` → kind cluster, ArgoCD installed and self-managing via app-of-apps, shiplog deployed to dev; (2) CI on fresh GitHub repo: PR checks + release + gitops tag-bump PR; (3) observability stack deployed via ArgoCD with RED dashboard and SLO alerts live; (4) `make destroy` full teardown; (5) README a stranger could run. Acceptance checklist given (20 items, each a command + expected result). Timing rule: log start/end, target ≤8h. Reflection section: what did you have to look up, what should have been a module — feeds your personal platform-template repo (suggested follow-on).
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(devops): add mission 10 capstone-zero-to-prod`

### Task 24: proxmox track README

**Files:**
- Create: `proxmox/README.md`

**Interfaces:**
- Produces: safety contract + naming conventions all proxmox missions reference: pool `learning`, VM ID range 9000-9999, bridge `vmbr-lab` with VLAN tag range, API token user `learn@pve!tf`, tag `learning` on every object, "never touch" rule for objects outside the pool.

- [ ] **Step 1: Write `proxmox/README.md`**: track goal (cluster-grade virtualization + private cloud on real company hardware); **safety contract** (block above verbatim, plus: config backup before any cluster-level change, no storage/network changes outside dedicated resources without change note, off-hours for anything cluster-wide); mission table (10 rows from spec, difficulty, time); note that cluster has 3+ nodes so Ceph/HA missions run for real; relationship to devops track (mission 08 hosts the GitOps stack).
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(proxmox): add track README with safety contract`

### Task 25: proxmox/01-recon-safety-rails

**Files:**
- Create: `proxmox/01-recon-safety-rails/README.md`, `proxmox/01-recon-safety-rails/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀. Time 3-4h. Deliverables: cluster inventory doc, `/etc/pve` backup routine, `learning` pool + isolated bridge + least-privilege API token, signed-by-yourself safety doc.
- [ ] **Step 2: Write GUIDE** phases: (1) inventory — `pvecm status`, `pveversion -v`, storage list, network config per node, existing VM/CT census; inventory doc template given; (2) understand pmxcfs — what `/etc/pve` is, backup script (given: tar of /etc/pve from one node + `pvecm status` snapshot) + cron/systemd timer; (3) resource pool `learning` creation, add-nothing-else rule; (4) network isolation — add `vmbr-lab` bridge (or dedicated VLAN tag on existing bridge — decision table given based on what recon found) so lab traffic can't reach production subnets; (5) API token — create user `learn@pve`, role with VM.* on pool only (exact privilege list given), token, test with curl (command given); (6) write safety doc from template (given): blast-radius statement, never-touch list from recon, rollback plan per mission type. Prove-it: prove the token cannot see or touch a production VM (curl attempts with expected 403s).
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 01 recon-safety-rails`

### Task 26: proxmox/02-template-factory

**Files:**
- Create: `proxmox/02-template-factory/README.md`, `proxmox/02-template-factory/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀. Time 4-6h. Deliverables: Ubuntu cloud-init template (VMID 9000), LXC template workflow, hookscript demo, clone→SSH under 2 minutes fully automated.
- [ ] **Step 2: Write GUIDE** phases: (1) download Ubuntu 24.04 cloud image on node, create VM 9000 shell (`qm create` full flags: virtio-scsi, agent=1, serial console), `qm importdisk`, attach cloud-init drive (all commands given); (2) cloud-init config — user, ssh key, IP config via `qm set --ipconfig0`, vendor snippet installing qemu-guest-agent (snippet file + storage enable steps given); (3) convert to template, full clone vs linked clone tradeoffs, clone + boot checkpoint (agent reports IP: `qm agent 9001 network-get-interfaces`); (4) LXC — download template, `pct create` with mount point + unprivileged, when LXC vs VM table; (5) hookscript — perl/bash example (given) that adds a tag and logs on start, attach to VM; (6) template hygiene: version tag in notes, rebuild procedure. Break-fix: (1) clone boots but no IP — cloud-init drive missing/regeneration; (2) agent shows no data — agent not installed in image, fix via vendor snippet. Prove-it: script (bash on node or via API) that clones template → waits for agent → prints SSH command, under 2 min end-to-end, run twice.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 02 template-factory`

### Task 27: proxmox/03-iac-on-proxmox

**Files:**
- Create: `proxmox/03-iac-on-proxmox/README.md`, `proxmox/03-iac-on-proxmox/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 8-12h. Prerequisites: proxmox/01+02, devops/06 recommended. Deliverables: Terraform module cloning fleets from template, Packer building golden image directly on Proxmox, Ansible dynamic inventory over the fleet, 5-VM env with zero UI clicks.
- [ ] **Step 2: Write GUIDE** phases: (1) bpg/proxmox provider auth with mission 01 token (provider block given, env var for secret); (2) single VM resource from clone (full resource: clone from 9000, cloud-init user/ssh/ip, pool, tags); (3) module `modules/pve-vm` with for_each fleet map (full module + caller given: `{ web1 = { ip = ... }, db1 = ... }`); (4) Packer proxmox-clone builder — golden image on top of 9000 with baked node_exporter (reuse devops/06 provisioner) (full HCL), template versioning strategy; (5) Ansible proxmox dynamic inventory plugin (yaml config given, keyed by tags), ping all, apply `common` role from sysops/09; (6) state discipline — backend options note, never import production VMs, `prevent_destroy` on template. Break-fix: (1) apply fails 403 — token privilege gap, read the API error; (2) two VMs same VMID race — how allocation works; (3) plan wants to replace VM on cloud-init change — lifecycle ignore_changes decision. Prove-it: `terraform apply` → 5 VMs (2 web, 2 app, 1 db by tags) → dynamic inventory configures all → `terraform destroy` leaves cluster exactly as before (prove with before/after VM census).
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 03 iac-on-proxmox`

### Task 28: proxmox/04-storage-deep

**Files:**
- Create: `proxmox/04-storage-deep/README.md`, `proxmox/04-storage-deep/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀. Time 12-16h. Safety note: storage experiments stay on lab disks/pools only; coordinate if nodes lack spare disks. Deliverables: ZFS replication job between nodes, healthy lab Ceph pool with RBD-backed VM, OSD-failure survival demonstrated, ZFS-vs-Ceph decision doc.
- [ ] **Step 2: Write GUIDE** phases: (1) storage recon — what exists (`pvesm status`), identify spare disks/partitions usable for lab (decision tree given incl. "no spare disks → nested/file-backed fallback path"); (2) ZFS — create lab pool (or use file-backed vdevs if no spares — commands for both), dataset as Proxmox storage, VM on it, snapshot + `pve-zsync`/replication job to second node (GUI + CLI), failover test: migrate VM using replicated disk; (3) Ceph concepts primer — mon/mgr/osd/pool/pg/crush in one page; (4) lab Ceph — install ceph on nodes (pveceph), 1 mon per node, OSDs on lab disks (`pveceph osd create`), pool `lab-rbd` with size 3/min 2, add as storage, VM disk on it; (5) health reading — `ceph -s`, `ceph osd tree`, pg states table (active+clean vs degraded vs backfill); (6) failure drill — stop one OSD while VM writes (fio command given), watch degraded→recovery, VM uninterrupted checkpoint; (7) rados bench + rbd bench, numbers recorded; (8) decision doc — ZFS vs Ceph: when each, based on your own measurements. Break-fix: (1) pg stuck undersized — OSD down longer than expected; (2) pool nearfull warning — ratios and what to do; (3) replication job fails — dataset renamed. Prove-it: VM on Ceph survives OSD kill mid-fio with zero fs errors; produce `ceph -s` timeline + fio output as evidence.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 04 storage-deep`

### Task 29: proxmox/05-pbs

**Files:**
- Create: `proxmox/05-pbs/README.md`, `proxmox/05-pbs/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 6-8h. Deliverables: PBS running with datastore, scheduled encrypted backups of lab VMs with prune/verify/GC, timed full restore + file-level restore performed.
- [ ] **Step 2: Write GUIDE** phases: (1) PBS install as VM on the cluster (ISO, sizing, dedicated disk for datastore); (2) datastore + user/API token for PVE, add PBS storage to PVE (fingerprint step); (3) backup job — pool-based selection (the `learning` pool), schedule, mode snapshot, encryption keys (generate, store, WARN in bold: lose key = lose backups, paper-backup step); (4) prune schedule + GC — retention math example table (given), run GC, dedup factor reading; (5) verify jobs + why bitrot matters; (6) restore drills — full VM restore to new VMID (timed, record), single-file restore via file-restore UI/CLI from encrypted backup, live-restore demo + when it's safe; (7) sync job concept (offsite second PBS) — configured to a second datastore as stand-in; (8) monitoring hook — PBS metrics into mission 09's Grafana (note forward-ref). Break-fix: (1) backup fails "guest agent not running" — fsfreeze implications; (2) restore to full datastore — space planning; (3) verify finds corrupt chunk — what now (re-backup + investigate). Prove-it: I delete a file inside a lab VM and destroy a second VM entirely; file-level restore + timed full restore both within your written RTO from mission 07's policy style.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 05 pbs`

### Task 30: proxmox/06-ha-cluster

**Files:**
- Create: `proxmox/06-ha-cluster/README.md`, `proxmox/06-ha-cluster/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time 8-12h. Safety note in bold: node-failure simulation = maintenance-window activity; coordinate with team; never pull quorum below viability on a production cluster — the guide's failure drill uses graceful methods and one node at a time. Deliverables: HA group with prioritized failover for lab VMs, live + offline migration mastery, node-failure drill with full log-trail explanation.
- [ ] **Step 2: Write GUIDE** phases: (1) corosync deep-read — `corosync.conf` walkthrough, quorum math (3 nodes = tolerate 1), `pvecm status` fields explained, what happens at quorum loss (pmxcfs read-only), qdevice when even nodes; (2) migration — live with shared storage (Ceph from 04) vs `--with-local-disks`, downtime measured with ping during both (expected: sub-second vs brief pause); (3) HA stack — lrm/crm services, `ha-manager` add lab VMs, HA group with node priorities, max_restart/max_relocate meanings; (4) maintenance — node drain (migrate away), reboot node cleanly, watch VMs return per group policy; (5) failure drill (lab VMs only, window agreed): stop pve-ha-lrm + freeze scenario vs graceful `systemctl stop` of cluster services on one node → watchdog/fencing explanation (softdog), timeline: how long until HA relocates (~2min expected), read `journalctl -u pve-ha-crm` on master + lrm on nodes, annotate every state transition; (6) split-brain theory — why fencing before restart, what the watchdog guarantees. Break-fix: (1) VM won't migrate — local resource (ISO mounted) blocking; (2) HA state `error` — acknowledge + recover flow; (3) node rejoins with stale config — corosync version bump explanation. Prove-it: written incident narrative of the drill: every log line from failure to recovery, in order, explained — reviewed in session.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 06 ha-cluster`

### Task 31: proxmox/07-sdn

**Files:**
- Create: `proxmox/07-sdn/README.md`, `proxmox/07-sdn/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀. Time 6-8h. Deliverables: SDN zone/VNets serving three isolated tenant networks across nodes, IPAM in use, controlled egress via exit node, applied only within lab scope.
- [ ] **Step 2: Write GUIDE** phases: (1) SDN concepts — zone/vnet/subnet model vs classic bridges, one-page primer; (2) enable SDN (apt package check, `/etc/network/interfaces.d/sdn` sourcing), datacenter→SDN tour; (3) simple zone first — vnet + subnet with DHCP (dnsmasq plugin), two VMs on it across different nodes, ping checkpoint proves cross-node overlay/VLAN works; (4) VLAN zone on `vmbr-lab` — three tenant VNets (tags from README range), IPAM pve plugin allocating subnets (10.77.1-3.0/24), gateway + SNAT toggle per subnet; (5) isolation proof — tenant A cannot reach tenant B (nmap), but both reach allowed egress; firewall-at-vnet-level notes; (6) apply-config mechanics — pending changes model, what `Apply` reloads, rollback = remove + apply; (7) teardown cleanliness (leave cluster SDN as found outside lab zones). Break-fix: (1) VNet up but no DHCP leases — dnsmasq plugin not enabled zone-side; (2) cross-node vnet dead — bridge VLAN-aware flag missing on one node; (3) apply wiped a manual bridge tweak — why SDN owns its config files. Prove-it: three tenants, three VMs each (clone via mission 03 terraform), full isolation matrix demonstrated with a scripted nmap sweep outputting a pass/fail table.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 07 sdn`

### Task 32: proxmox/08-k8s-on-proxmox

**Files:**
- Create: `proxmox/08-k8s-on-proxmox/README.md`, `proxmox/08-k8s-on-proxmox/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time 12-16h. Prerequisites: proxmox/03, devops/04-07. Deliverables: HA k3s cluster (3 servers + 2 agents) provisioned by Terraform + cloud-init, VIP for API, LoadBalancer services working, ArgoCD from devops track deploying shiplog onto it, server-node-kill survival.
- [ ] **Step 2: Write GUIDE** phases: (1) architecture decision table — k3s HA embedded etcd vs kubeadm (choose k3s, reasons), sizing per node; (2) Terraform — extend mission 03 module: 5 VMs with roles via tags, cloud-init user-data per role (server-init with `cluster-init`, server-join, agent-join — full snippets with k3s install commands + token handling via TF random_password); (3) kube-vip for control-plane VIP (manifest into server user-data, given), kubeconfig retrieval + sanity `kubectl get nodes` = 5 Ready; (4) MetalLB in L2 mode — IP pool from lab subnet (manifests given), expose test svc, curl from lab checkpoint; (5) storage — local-path default vs proxmox-csi (install steps for csi with mission 01 token, StorageClass, PVC test both ways, comparison table); (6) GitOps bridge — register this cluster in ArgoCD from devops/07 (argocd cluster add), new env values `values-pve.yaml` for shiplog (ingress via MetalLB IP), app manifest (given), sync, curl proof; (7) resilience — `terraform taint`/replace an agent (workloads reschedule), then hard-stop a k3s server VM: API stays up via VIP, etcd quorum holds, workloads fine — evidence checklist; (8) teardown/rebuild — full destroy + reapply timed (target <15 min to Ready). Break-fix: (1) second server won't join — token vs cluster-init ordering; (2) MetalLB IP unreachable from lab — L2 advertisement/bridge tag mismatch; (3) csi PVC Pending — token privileges again. Prove-it: kill one k3s server during active k6 load from devops/09 against shiplog; SLO holds; produce timeline + `kubectl get events` evidence.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 08 k8s-on-proxmox`

### Task 33: proxmox/09-cluster-watchtower

**Files:**
- Create: `proxmox/09-cluster-watchtower/README.md`, `proxmox/09-cluster-watchtower/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀. Time 4-6h. Deliverables: pve-exporter + PBS metrics scraped, cluster Grafana dashboard, alert rules (node down, storage 80%, backup failed, HA state error), alert delivery to email/Telegram, sub-minute node-down detection.
- [ ] **Step 2: Write GUIDE** phases: (1) prometheus-pve-exporter — install (pip/venv or container on a lab VM), config with mission 01 token (yaml given), scrape config; (2) PBS — built-in metrics endpoint token + scrape job (config given); (3) Prometheus — reuse sysops/06 server or fresh VM via mission 03 TF (decision note), add jobs; (4) Grafana dashboard — import proxmox dashboard by ID + author 6-panel cluster board (per-panel PromQL given: node cpu/mem, storage usage, VM count by node, backup job age, HA status); (5) alert rules file (given verbatim): `PVENodeDown` (up==0 1m), `StorageAbove80`, `BackupTooOld` (>26h), `HAResourceError`; (6) delivery — Alertmanager email via company SMTP or Telegram bot receiver (both configs given, pick one); (7) runbook stubs per alert (template reused from sysops/06). Break-fix: (1) exporter 401 — token privilege/path; (2) all targets up but node metrics frozen — exporter caching/timeout tuning; (3) alert fired but no message — route matcher mismatch. Prove-it: gracefully take one node's exporter target down (and, in a window, one real node via mission 06's drill) — alert in channel <60s, screenshot + timestamps.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 09 cluster-watchtower`

### Task 34: proxmox/10-capstone-private-cloud

**Files:**
- Create: `proxmox/10-capstone-private-cloud/README.md`, `proxmox/10-capstone-private-cloud/GUIDE.md`

- [ ] **Step 1: Write README.** Difficulty 💀💀💀💀💀. Time: 2-3 burst days. Prerequisites: proxmox/01-03+07-09, devops/03+06-07. Deliverables: git-driven self-service platform — merged PR with a YAML request file provisions a VM or k8s namespace with quotas, requester gets outputs as PR comment; demoed to one colleague.
- [ ] **Step 2: Write GUIDE.** Requirements-spec style (capstone: guides closed, own artifacts open): (1) request format — `requests/vm-<name>.yaml` schema given (name, size S/M/L mapping table, image, owner, expiry) and `requests/ns-<name>.yaml` (namespace, cpu/mem quota, owner); (2) pipeline — GH Actions self-hosted runner (from devops/03) inside the lab network: PR opened → validate schema + policy (size limits, naming, expiry required) + `terraform plan` posted as PR comment; merge → `apply`; connection details posted back; (3) policy gates — max sizes without human approval label, auto-expiry via scheduled workflow that opens teardown PRs; (4) k8s namespace path — same flow but kubectl/ArgoCD against mission 08 cluster with ResourceQuota+LimitRange manifests templated; (5) security notes — runner scoped to lab, secrets in GH environments, PVE token = mission 01 least-privilege; (6) acceptance checklist (15 items: end-to-end VM request ≤10 min, quota enforced, teardown works, audit trail = git history, demo done); (7) pitch section — one-page writeup template to show your team ("what this replaces, what it cost, what it saves"). Career note: this artifact is the portfolio piece.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(proxmox): add mission 10 capstone-private-cloud`

### Task 35: money track README

**Files:**
- Create: `money/README.md`

**Interfaces:**
- Produces: global compliance rules + ranking table + budget allocation all money folders reference.

- [ ] **Step 1: Write `money/README.md`**: honest framing paragraph (no guarantees; expect several failures; portfolio approach — run experiments, kill losers fast, scale winners; realistic month-1 range $0-300, month-3 range $100-1000 if 2-3 experiments hit); ranking table from spec (8 rows: folder, model, AI/manual split, first-$ speed, ceiling, payout); cadence table (daily-loop: 01/02; burst-friendly: 05/06/07; compounding: 03/04/08); **$50 budget allocation** (2 domains ≈ $20 for money/02 demo + money/03; $30 reserve — everything else starts free); global compliance floor (verbatim from Global Constraints); operating system: pick 2 experiments max at once, 4-week checkpoint against each folder's kill/scale criteria, weekly review ritual (30 min, TRACKER.md); tax responsibility one-liner.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(money): add track README with rules and rankings`

### Task 36: money/01-freelance-gigs

**Files:**
- Create: `money/01-freelance-gigs/README.md`, `PLAYBOOK.md`, `TRACKER.md` (in same folder)

- [ ] **Step 1: Write README** per money template. Model: sell AI-leveraged technical services on Fiverr + Upwork — niches: Python scraping scripts, data cleaning (CSV/Excel), Excel/Sheets automation, small bug fixes, technical writing. First $ days-2wks; ceiling $300-2000/mo. Honest expectations: new accounts start with zero trust — first 5 orders are underpriced reputation purchases; response speed is the #1 ranking lever; expect 20-50 proposals per first win on Upwork. Rules: both platforms allow AI-assisted delivery but ban misrepresentation and account sharing — YOU are the seller, AI is your tool; never deliver unreviewed AI output; no client contact off-platform before order (ToS). Eligibility: verify Fiverr + Upwork payout to PayPal for your country (steps: create account → payout settings → confirm PayPal listed before writing gigs). Kill/scale: kill niche if 0 orders after 4 weeks AND 30+ Upwork proposals; scale by raising prices 25% every 5 five-star reviews.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 setup [YOU]: accounts + verification, profile photo, PayPal link; [AI]: profile bio, 3 Fiverr gigs (scraping / data cleaning / automation) — full gig-description skeletons included in Templates section with title formulas, package tiers (basic/standard/premium with prices $15/$40/$90 starting), FAQ blocks, search-tag lists; portfolio: 3 sample deliverables built with AI (sample scraper + before/after data clean + automation demo, each ≈1h). Phase 2 loop (daily, 45-90 min): [YOU] check messages (respond <1h during active hours); [AI] browse Upwork feed for 5-10 fitting jobs → drafts personalized proposals (proposal skeleton in Templates: hook referencing their specific problem, 2-line plan, 1 relevant sample, question); [YOU] send 5-10/day; on order: [AI] does the work in Claude Code session, [YOU] review line-by-line, test, deliver with summary note ([AI] drafts). Revision policy: 2 free rounds, scope-creep phrases to watch (list given). Phase 3 scale: raise prices, decline low-value work, productize best-seller into fixed packages, funnel repeat clients to retainers. Templates: gig skeletons ×3, proposal skeleton, delivery-note skeleton, revision-response skeleton — full text.
- [ ] **Step 3: Write TRACKER** per template with money/01-specific weekly questions (proposals sent, response rate, orders, avg $/order).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 01-freelance-gigs`

### Task 37: money/02-biz-websites

**Files:**
- Create: `money/02-biz-websites/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: cold-outreach web design for small service businesses (trades: plumbers, electricians, landscapers, dentists — pick one vertical) at $200-500 flat + optional $20-30/mo care plan. First $ 2-4 wks; ceiling $400-2000/mo. Honest expectations: this is a sales job — 1-3% reply rate on cold email is normal; 100 sends ≈ 1-2 clients; the build is the easy 10%. Rules: CAN-SPAM basics (real identity, working unsubscribe, no deceptive subject), no scraped-email spam blasts — targeted, researched, low-volume outreach; verify local regs equivalent; deliver what you sold. Eligibility: PayPal invoicing available for your account (check business features); domain+hosting costs pass to client or use their accounts. Kill/scale: kill vertical after 150 researched contacts with 0 closed deals; scale by niching harder + referral ask at delivery + care-plan recurring base.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [AI]: pick vertical + city criteria; build 3 demo sites for fictional businesses in that vertical (static, fast, mobile-first — built in Claude Code, deployed free on Cloudflare Pages) as portfolio; outreach sequences written (Templates: email 1 = specific observation about their current web presence + one concrete fix + demo link; follow-ups day 4 and day 10 — full text skeletons); [YOU]: buy 1 portfolio domain (~$10), set up business PayPal invoicing. Phase 2 loop (daily 60 min): [AI] research 10 prospects (no site / broken site / no mobile — manual Maps+search method described, no ToS-violating scraping), drafts personalized email per prospect; [YOU] verify + send 10, log in tracker, reply to responses ([AI] drafts replies + proposal PDF); close on call or email — simple 1-page agreement skeleton given (not legal advice note); 50% deposit via PayPal invoice before work. Delivery: [AI] builds site ≤1 day, [YOU] review, client revision round, launch on their domain, final invoice. Phase 3: care plans (updates+hosting management), referral bonus offer, raise to $500+ after 5 sites. Templates: 3 emails, proposal skeleton, agreement skeleton, delivery checklist.
- [ ] **Step 3: Write TRACKER** with money/02 weekly questions (contacts researched, sent, replies, calls, closes, avg deal).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 02-biz-websites`

### Task 38: money/03-micro-tools

**Files:**
- Create: `money/03-micro-tools/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: niche paid web tools — free tier + $5-15 one-time or $3-5/mo pro tier via Lemon Squeezy (merchant of record, pays out to PayPal). First $ 2-6 wks; ceiling $50-500/mo per tool, portfolio effect across tools. Honest expectations: most tools earn $0; distribution beats code quality; 3-5 launches to find one with legs; SEO takes months — launches provide the early spikes. Rules: Lemon Squeezy ToS + accurate product claims; no fake testimonials; privacy policy if storing user data (template pointer); launch-platform etiquette (HN/Reddit: participate genuinely, disclose you're the author, respect sub rules — no drive-by spam). Eligibility: Lemon Squeezy account + PayPal payout availability check; Cloudflare Pages/Workers free tier. Kill/scale: kill tool if <100 visits AND $0 after 6 wks + 3 launch attempts; scale winner with SEO content pages + adjacent features + capstone deployment (link to `capstones/README.md`).
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [AI+YOU]: idea selection framework — worksheet scoring 1-5 on: pain frequency, search demand (keyword ideas + how to eyeball volume free), payment willingness (B2B/prosumer bias), buildable-in-a-weekend, existing-competition gap; 12 seed ideas listed (niche invoice generator, cron builder+explainer pro, regex tester with saved library, YAML/env/JSON converter pro, image → favicon pack, meta-tag/OG preview generator, changelog generator from git log, timestamp converter team edition, markdown → styled PDF, DNS record checker with monitoring, QR batch generator, pricing-page A/B mockup tool); [YOU] pick 1. Build sprint (burst weekend): [AI] builds MVP in Claude Code (stack: static + serverless on Cloudflare free tier), landing page (headline formula + social proof placeholder rules — no fake numbers), Lemon Squeezy checkout wired (license key or hosted checkout steps); [YOU] domain (~$10), accounts, deploy click, test purchase end-to-end (LS test mode). Phase 2 loop (weekly): 1 launch action per week ([AI] drafts: Show HN post, 2-3 relevant subreddit posts, X thread, directory submissions list — 10 directories named), 1 SEO content page per week ([AI] writes, [YOU] fact-check + publish), respond to all user feedback ([AI] drafts), ship 1 improvement from feedback. Phase 3: winner → SEO cluster, affiliate/adjacent tool cross-links, consider capstone A deployment for infra learning. Templates: launch post skeletons (HN/Reddit/X), landing-page copy skeleton, feedback-reply skeleton.
- [ ] **Step 3: Write TRACKER** with money/03 weekly questions (visits, signups, purchases, feedback items shipped).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 03-micro-tools`

### Task 39: money/04-gumroad-products

**Files:**
- Create: `money/04-gumroad-products/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: digital products on Gumroad (PayPal payout): dev-focused Notion templates (homelab tracker, incident runbook pack, job-hunt CRM), boilerplates (FastAPI+Stripe starter, Ansible role pack, GitHub Actions workflow pack), PDF cheatsheet packs (k8s troubleshooting, Linux one-liners with explanations). First $ 2-6 wks; ceiling $50-500/mo. Honest expectations: products don't sell themselves — each needs its own distribution push; free tier products build email list that sells paid ones; expect first 3 products to inform, not earn. Rules: Gumroad ToS, all content original or properly licensed, no reselling scraped/copied material, accurate descriptions. Eligibility: Gumroad account + PayPal payout country check (steps). Kill/scale: kill product line at <$20 after 8 wks and 4+ distribution pushes; scale winners with bundles, tiered versions, email list.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [AI]: product pipeline — pick from 3 lines above, build product #1 end-to-end in one burst (concrete build steps per product type: Notion template = duplicate-able page structure + how-to-use guide; boilerplate = repo + README + video-script; PDF pack = content in markdown → styled PDF via pandoc/typst, cover via AI image); listing: title formula, description skeleton (Templates), 3 preview images ([AI] generates/mocks), pricing strategy (anchor: free-lite + $9-29 paid, PWYW experiment rules); [YOU]: Gumroad account, upload, publish, connect PayPal. Phase 2 loop (2 bursts/wk): distribution — [AI] drafts value-first posts for relevant subreddits/X/dev.to (rule: teach the thing, product link in context, disclose authorship), 1 free-sample funnel (free lite version collects emails via Gumroad follow), email broadcast per new product ([AI] drafts); 1 new product per 2 weeks until 5 live, then double down on best seller. Phase 3: bundle top sellers, affiliate program on Gumroad, cross-promote from money/03 tools. Templates: listing skeleton, 3 post skeletons, email broadcast skeleton.
- [ ] **Step 3: Write TRACKER** (views, conversions, revenue per product, email subs).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 04-gumroad-products`

### Task 40: money/05-stock-assets

**Files:**
- Create: `money/05-stock-assets/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: GenAI images/vectors on Adobe Stock (accepts labeled GenAI; PayPal payout). First $ 3-8 wks (review queues); ceiling $20-300/mo passive-ish, catalog game (500+ assets for meaningful income). Honest expectations: acceptance rates 30-70% while learning; per-asset earnings cents-to-dollars; volume + niche selection decide outcome; this is the most passive but slowest-compounding folder. Rules (strict): Adobe requires GenAI labeling at submission — always label; NO recognizable people (even AI-generated faces need released-model rules — avoid faces entirely), no logos/trademarks/artist-style mimicry ("in the style of X" prompts banned), no editorial claims; check each additional platform's current GenAI policy before submitting there (Shutterstock/Getty policies differ — verification step, not assumption). Eligibility: Adobe Stock contributor account + PayPal payout + tax form (W-8BEN for non-US) steps. Kill/scale: kill at <$10 after 12 wks and 300+ assets live; scale winning niches ×10.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [YOU]: contributor account, tax form, payout; [AI]: niche research method — browse Adobe Stock bestsellers in commercial-safe niches (abstract business backgrounds, textures, seasonal/holiday themes ahead of season, isolated objects, mockup-friendly flat-lays), keep a niche scoreboard. Phase 2 loop (burst: 3-4h session → 40-60 assets): [AI] generate prompt matrix per niche (base concept × styles × colorways — matrix template given), batch-generate, upscale pipeline; [YOU] curate hard (quality gate checklist: hands/text/artifacts/composition — reject ~50%), [AI] writes titles + 30-45 keywords per asset (CSV format for bulk upload given), [YOU] upload batch with GenAI label, log. Weekly: review acceptance/rejection reasons, update niche scoreboard, kill weak niches. Phase 3: replicate proven niches across seasons, vectors via tracing pipeline (raster→vector steps), consider second platform after policy verification. Templates: prompt matrix, metadata CSV columns, quality-gate checklist.
- [ ] **Step 3: Write TRACKER** (assets submitted/accepted/rejected, downloads, revenue, niche notes).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 05-stock-assets`

### Task 41: money/06-pod-merch

**Files:**
- Create: `money/06-pod-merch/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: print-on-demand designs on Redbubble + TeePublic (both PayPal payout). First $ 3-8 wks; ceiling $20-300/mo, catalog game. Honest expectations: heavily saturated — wins come from niche targeting (professions, hobbies, inside jokes) not generic art; text-based designs outsell complex art for beginners; hundreds of designs before pattern emerges. Rules (strict): trademark check EVERY phrase before upload (USPTO TESS search step + each platform's IP policy), zero fan-art/brands/celebrities (fastest route to account ban), original text/graphics only, follow each platform's AI-art disclosure policy as currently published (verification step included). Eligibility: account + PayPal payout check both platforms. Kill/scale: kill at <$10 after 12 wks and 200+ designs; scale winning niches with design variations + seasonal timing.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [YOU]: accounts, payout, artist bio ([AI] drafts). Phase 2 loop (burst: 2-3h → 10-20 designs): [AI] niche research (Google Trends + platform search autocomplete method described; niche scoreboard like money/05), design batch: text-based first (pun/pride/profession formulas given) as SVG/PNG 4500×5400 transparent, graphic designs second; [YOU] trademark-check each phrase (logged in tracker — non-negotiable step), upload with [AI]-written titles/tags/descriptions per platform limits, enable sensible product range. Weekly: favorites/views/sales review, double down. Phase 3: winning niche → 20 variations, seasonal calendar (given: which niches peak when, upload 6-8 wks ahead), expand to third platform after policy check. Templates: design brief formula, title/tag skeletons per platform, trademark-check log format.
- [ ] **Step 3: Write TRACKER** (designs live, views, favorites, sales, royalties, TM-check log).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 06-pod-merch`

### Task 42: money/07-kdp-books

**Files:**
- Create: `money/07-kdp-books/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: medium-content + niche nonfiction on Amazon KDP: workbooks with real substance (habit/finance/skill practice books), niche how-to ebooks (30-60 pages solving one specific problem), log books with genuinely useful structure. NOT low-content spam (saturated + quality bar). First $ 4-8 wks; ceiling $50-500/mo, catalog game (10+ titles). Honest expectations: most first books sell ≈0 without ads; niche selection is 80% of outcome; KDP is the slowest money folder but most durable catalog. Payout: bank transfer/Payoneer — NOT PayPal (setup steps; flag as the one folder needing different rails). Rules (strict): KDP asks whether content is AI-generated at publish — answer honestly (AI-generated content is currently permitted with disclosure; AI-assisted differs — definitions quoted in doc with link pointer to current policy for re-verification); every book fact-checked by [YOU]; no keyword-stuffed titles (ToS); no copyright material. Eligibility: KDP account + tax interview (W-8BEN) + payout method for your country. Kill/scale: kill after 5 quality books + 12 wks at <$20; scale winning niche with series + A+ content.
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [YOU]: KDP account, tax interview, payout rails. Phase 2 per-book pipeline (burst: 1 book per weekend): [AI] niche research (Amazon search + bestseller-rank eyeballing method, competition checklist: <30 reviews on page-1 competitors = opening), outline → full manuscript draft → self-edit pass → [YOU] fact-check + voice pass (quality gates checklist: 7 gates given — accuracy, no filler chapters, actual exercises in workbooks, formatting, TOC, no AI-tells, cover text legibility); interior format ([AI]: pandoc/typst pipeline or KDP template), cover ([AI] concept + Canva/AI art within KDP cover calculator dims — steps), metadata: title/subtitle formula, 7 keywords, 3 categories method; [YOU] publish with honest AI disclosure. Phase 3: series in winning niche, paperback+ebook both formats, A+ content module, free-promo-days strategy for reviews (within ToS — no bought/exchanged reviews ever). Templates: niche scoreboard, outline skeleton, quality-gate checklist, metadata worksheet.
- [ ] **Step 3: Write TRACKER** (books live, KENP + sales per book, niche notes).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 07-kdp-books`

### Task 43: money/08-seo-affiliate-site

**Files:**
- Create: `money/08-seo-affiliate-site/README.md`, `PLAYBOOK.md`, `TRACKER.md`

- [ ] **Step 1: Write README.** Model: niche content site monetized with affiliate programs (Amazon Associates + specialized programs) — the slow-burn compounder. First $ 3-6 months; ceiling $0-1000+/mo. Honest expectations printed in bold: this is the ONLY folder with zero chance of month-1 revenue; Google indexes slowly and AI-content-flood era means thin content dies — only genuinely useful, experience-backed content ranks; treat as background compounding bet, never the primary experiment. Rules: affiliate disclosure on every page (FTC), Amazon Associates ToS (no price listing, 180-day cookie rules note, must make 3 sales in 180 days to keep account — so apply AFTER traffic exists), no fabricated product experience — test-what-you-review or aggregate honestly labeled research. Eligibility: Amazon Associates availability + payout for your country; alternative networks list (Impact, ShareASale, direct programs). Kill/scale: assess only at month 4 (30+ posts, GSC impressions trending?); kill at month 6 if <500 impressions/day trend; scale winners with content clusters + comparison tools (bridge to money/03 skills).
- [ ] **Step 2: Write PLAYBOOK.** Phase 1 [AI+YOU]: niche selection worksheet (criteria: you can add genuine experience — homelab/dev tooling natural fit; buyer-intent keywords exist; page-1 has weak spots — forums/thin content; not YMYL health/finance); domain ($10) + free hosting (Cloudflare Pages + static generator — [AI] builds site skeleton with fast theme, category structure); content plan: 30-post cluster map ([AI] generates: 5 pillar + 25 supporting, buyer-intent mix — "best X for Y"/"X vs Y"/how-tos). Phase 2 loop (2-3 posts/wk): [AI] drafts from outline with your real experience inserted ([YOU] provide notes/screenshots from your actual lab/tools — the differentiation step, non-skippable), [YOU] fact-check + publish; on-page SEO checklist per post (given: title/H2s/internal links/schema/image alts); GSC submit; monthly: [AI] analyzes GSC data → update underperformers, build 1 white-hat link action (HARO-style/resource suggestions/genuine guest post). Apply to Amazon Associates only once ~50 visits/day. Phase 3: winning cluster → expand, add comparison tables/tools, consider display ads at 10k sessions/mo. Templates: niche worksheet, post outline skeleton, on-page checklist, update-cycle checklist.
- [ ] **Step 3: Write TRACKER** (posts live, GSC impressions/clicks, affiliate clicks, revenue — monthly granularity note).
- [ ] **Step 4: Verify. Step 5: Commit:** `docs(money): add 08-seo-affiliate-site`

### Task 44: Final integration pass

**Files:**
- Modify: `README.md` (hub)
- Possibly modify: any file with broken links

- [ ] **Step 1: Link check** — script every relative link in every `.md` resolves (PowerShell or bash loop given by executor; simplest: grep all `](` targets, test-path each). Fix any broken ones.
- [ ] **Step 2: Placeholder sweep repo-wide:** `git grep -nE "TBD|TODO|FIXME|fill in|coming soon"` → expect empty (excluding this plan file's own Banned-patterns line and spec).
- [ ] **Step 3: Dashboard accuracy** — hub README progress dashboard lists exactly the folders that exist, names matching.
- [ ] **Step 4: Commit:** `docs: final link and consistency pass`

---

## Self-Review Notes

- **Spec coverage:** hub README (Task 1), capstones (Task 1), 3 track READMEs (2/13/24), 30 missions (3-12, 14-23, 25-34), money README (35), 8 money folders (36-43), templates + honesty + compliance in Global Constraints. Spec's success criteria all mapped. No gaps found.
- **Consistency:** shiplog defined once (Task 13) and referenced by name in 15-23, 32; lab topology defined once (Task 2); proxmox safety contract defined once (Task 24) with template VMID 9000 used in 26-27; capstone cross-links match spec.
- **Placeholders:** content specs are concrete (named tools, exact configs to include, exact drills); "given" markers instruct the executor to write full artifacts, which is the deliverable of a docs plan.
