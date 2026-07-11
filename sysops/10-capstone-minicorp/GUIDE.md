# Guide — Mission 10: Capstone: MiniCorp

## The capstone rule — read this first

This guide is closed. What follows is a requirements specification and an acceptance checklist, not a walkthrough. There is no numbered step-by-step, and there is no hints section anywhere in this document, including in the chaos-drill section. You already have everything you need: your own runbooks from Missions 02-09, the Ansible repo you built in Mission 09, and the man pages / `--help` output installed on every system you touch. Use them. If you find yourself wanting a hint, that is the signal that your Mission 09 runbook or role structure has a gap — go fix the gap, not the guide.

## Scenario

MiniCorp hired you as its one and only sysadmin. The previous admin left no notes. The rack is empty: six blank clones of your Mission 01 templates, sitting on the lab network, unconfigured. The company needs a router, a directory service, email and file storage for its staff, monitoring that pages you before customers notice an outage, and backups that actually restore. You have one weekend. Build the company.

## VM specification

Six VMs, all cloned from your Mission 01 templates (`tpl-ubuntu2404` or `tpl-rocky9` — your choice per node, but state the choice in your runbook). All addresses are on the lab's `172.16.10.0/24` / `lab.local` plan from the `sysops/README.md` topology block. The router carries two internal segments off the flat lab network, following the same VLAN pattern you built in Mission 04.

| VM | Role | IP address | Required services (built in) |
|----|------|-----------|-------------------------------|
| `mc-router.lab.local` | Router / firewall | `172.16.10.100` (uplink, NATed to the lab), `10.10.10.1/24` (vlan10 — servers), `10.20.20.1/24` (vlan20 — workstations) | nftables default-deny ruleset with NAT/masquerade and explicit allow rules; VLAN segmentation between vlan10 and vlan20 (Mission 04) |
| `mc-dns.lab.local` | DNS + DHCP | `10.10.10.11` | bind9 authoritative for `lab.local`, forwarding everything else; Kea DHCP serving vlan20 with correct lease time, DNS, and domain options (Mission 04) |
| `mc-ipa.lab.local` | Identity | `10.10.10.12` | FreeIPA server: Kerberos, LDAP, SSO, sudo rules (Mission 05) |
| `mc-filemail.lab.local` | Files + mail | `10.10.10.13` | Postfix + Dovecot for internal mail (Mission 05); a shared network file store (NFS or Samba export) for staff home/shared directories (Mission 03) |
| `mc-monitor.lab.local` | Monitoring | `10.10.10.14` | Prometheus, Grafana, Alertmanager, Loki + promtail, scraping and log-collecting from all six nodes (Mission 06) |
| `mc-backup.lab.local` | Backup | `10.10.10.15` | restic (or an equivalent PBS-style datastore) backing up configuration and data from all six nodes on a schedule, with prune and verify (Mission 07) |

Client-side validation (onboarding, SSO, mail delivery, file access) is done from a throwaway client session — reuse a Mission-05-style enrolled client VM or your own workstation over SSH/IMAP. That client is not one of the six MiniCorp VMs; the six VMs are server-side infrastructure only.

## Build rules

- **Everything through Ansible.** Extend the control repo from Mission 09 — its `common` role, its inventory conventions, its vault usage — rather than starting a new one. Every one of the six VMs must be reachable, from blank clone to fully configured, by running your playbooks against it. No manual edits on any node once its role has run; if you find a manual fix, turn it into a task and re-run.
- **Inventory groups follow the service table above** — one group per role (router, dns, ipa, filemail, monitor, backup) or finer-grained if your design calls for it. Document your inventory layout in the runbook.
- **Secrets live in the vault.** Every password, keytab, or API token used by a role is vault-encrypted and referenced via `--vault-id`, exactly as in Mission 09.
- **Snapshots only at phase boundaries.** Take a Hyper-V checkpoint on the relevant VMs when a phase's acceptance criteria pass, not mid-phase. Name checkpoints so a stranger could tell what state they represent (e.g. `mc-phase2-core-services`).
- **The runbook is a living document.** Update it as you build, not after. By the end of the mission it must be accurate enough that someone who has never seen MiniCorp could operate it from the runbook alone.

## Phases

Build in this order — later phases depend on earlier ones being real, not stubbed.

1. **Network + router.** `mc-router` up, NAT to the lab uplink working, vlan10/vlan20 segmented, default-deny nftables in place. Nothing else can be provisioned reliably until DNS and routing exist.
2. **Core services.** `mc-dns` (DNS + DHCP) and `mc-ipa` (identity) stood up and talking to each other and to the router. Every other VM in the spec gets a forward and reverse DNS record here, whether or not it's built yet.
3. **Mail + files.** `mc-filemail` stood up, enrolled against `mc-ipa`, serving mail and shared storage to IPA-authenticated users.
4. **Monitoring + backup.** `mc-monitor` and `mc-backup` stood up, and — this is the part people skip — retrofitted to cover every node built in phases 1-3 as well as themselves. A node with no metrics, no logs, and no backup is not done.
5. **Acceptance.** Run the full checklist below against the live system. Fix anything that fails via Ansible, not by hand, then re-verify.

## Acceptance checklist

All of the following must be true and demonstrable before you consider MiniCorp built. "Demonstrable" means you can produce the command and its output on request — a claim without evidence doesn't count.

1. All six VMs were provisioned and configured exclusively through Ansible playbook runs — no undocumented manual changes on any node.
2. `ansible-playbook site.yml --check --diff` against the full inventory reports zero changes on a freshly-built system.
3. `mc-router` provides working NAT/internet access to both vlan10 and vlan20.
4. `mc-router`'s live `nft list ruleset` matches the Ansible-templated ruleset exactly, and is default-deny inbound with only the required ports explicitly allowed.
5. vlan10 (servers) and vlan20 (workstations) are isolated from each other except for explicitly allowed service ports — proven with an nmap scan from a vlan20 host against a vlan10 target.
6. `mc-dns` answers authoritatively for `lab.local` (`dig @10.10.10.11 lab.local SOA +short` returns a value).
7. Every one of the six MiniCorp VMs has both a forward (A) and reverse (PTR) record on `mc-dns`.
8. Kea DHCP hands vlan20 clients a lease with correct lease time, DNS server, and domain search options — proven from a fresh client lease.
9. `mc-ipa` is the working Kerberos/LDAP source of truth, and at least one other node is enrolled against it (`kinit` succeeds for a real user).
10. Two new IPA user accounts are provisioned end-to-end through Ansible (not `ipa user-add` typed by hand) and each can SSO-SSH into an enrolled client with no password prompt.
11. Each onboarded user has a working mailbox on `mc-filemail` — proven with a sent and received test message (e.g. via `swaks` and an IMAP fetch).
12. Each onboarded user's shared/home storage on `mc-filemail` is reachable and writable from a client mount.
13. `mc-monitor`'s Prometheus shows 6/6 targets `up` on its `/targets` page.
14. Grafana on `mc-monitor` shows live, populated dashboards for at least the router, DNS, IPA, and files+mail nodes.
15. Alertmanager on `mc-monitor` delivers a real test alert to a real inbox through `mc-filemail`'s Postfix relay.
16. At least one alerting rule exists per node type (disk space, service-down, certificate expiry as applicable) and each has been observed to fire at least once during testing, with a correct `for:` duration.
17. Loki is ingesting logs from all six VMs, and a single LogQL query spanning all of them returns results.
18. `mc-backup` runs a scheduled job (systemd timer, deployed via Ansible) backing up configuration and data from all six nodes, itself included.
19. A snapshot listing on `mc-backup` (`restic snapshots` or equivalent) shows a recent, successful snapshot for every node.
20. A full restore drill has been performed: an arbitrary config file or directory restored from `mc-backup` onto a live node and verified byte-identical against a known-good copy with `diff`.
21. Any TLS certificates in use (IPA web UI, mail submission, etc.) come from one consistent CA and none are within 14 days of expiry at acceptance time.
22. Every credential in the Ansible repo is vault-encrypted — `git grep` for plaintext secrets across the repo returns nothing.
23. Hyper-V checkpoints exist for each of the five build phases, clearly named, taken only at phase boundaries.
24. The ops runbook exists as one document, covers all six services (start/stop/restart/logs/common fixes), and matches the infrastructure as actually built.
25. The runbook's IP/hostname/service map matches the running infrastructure exactly.
26. All six VMs individually survive a reboot and come back with every service auto-starting and passing its own health check, unattended.
27. No configuration drift exists anywhere: a final `ansible-playbook --check` run returns zero changes across the whole inventory.
28. The chaos drill (below) has been run in one timed live session, and all three staged failures were diagnosed and remediated using only the runbook and installed documentation.
29. A written, blameless postmortem exists for the chaos drill, covering timeline, root cause per failure, impact, and at least one concrete follow-up action per failure.
30. After the chaos drill and its fixes, a re-run of the full site playbook against all six nodes returns the infrastructure to a fully idempotent, zero-diff state.

## Chaos drill

This is a single live session. It happens after Phase 5 passes acceptance — you are drilling a system you have already declared done, the way a real outage hits production, not a staging environment.

**Format:**

- Claude acts as the chaos agent for this drill. In one sitting, Claude stages three failures back-to-back, chosen from the pool below, without telling you in advance which ones or which nodes they land on.
- Start a clock the moment the first failure is staged. Track total time and time-per-failure in your runbook or a scratch log — it becomes part of the postmortem.
- **Runbook-only.** For the duration of the drill you may consult your own runbook, installed man pages, and built-in `--help` output. You may not consult this guide, any other LearningHub guide, or external how-to sources. If your runbook doesn't cover a failure mode, that's a real finding — write it down and fix the runbook afterward, don't reach for outside help mid-drill.
- For each failure: diagnose it (state what's wrong and show the evidence), remediate it (fix it, through Ansible where the fix is a configuration change), then verify the fix with a concrete command and its output before moving to the next failure.
- All three failures must be resolved before the drill ends. If you get stuck past a reasonable time box, note it honestly in the postmortem — a documented failure to recover in time is a valid, gradable outcome; silently giving up is not.

**Failure pool** (Claude picks 3, not necessarily one from each node):

- **Node death** — a VM is stopped, disks pulled from Hyper-V, or otherwise made completely unreachable.
- **DNS misconfiguration** — a zone file, forwarder, or resolver setting on `mc-dns` (or a client's resolver) is altered so lookups fail or return the wrong answer.
- **Certificate expiry** — a certificate in use somewhere in the stack is replaced with one that is expired or has the wrong name, breaking TLS for the service that depends on it.
- **Disk fill** — a filesystem on one of the six nodes is filled to the point a service can no longer write, log, or accept new data.
- **Corrupted service config** — a live configuration file for one of the six core services is altered into a state that is syntactically or semantically broken, taking the service down or into a degraded mode.

## Postmortem

Immediately after the drill ends — same session, before you close it out — write a blameless postmortem. It must include, for the drill as a whole and per failure where relevant:

- **Timeline** — when each failure was staged, when it was noticed, when it was diagnosed, when it was fixed, when it was verified.
- **Impact** — what was actually broken or unavailable, and for how long.
- **Root cause** — the real underlying cause per failure, not just the symptom.
- **Contributing factors** — anything about the design, the runbook, or the Ansible repo that made the failure worse or harder to find than it needed to be.
- **Action items** — at least one concrete, assignable follow-up per failure (a runbook update, an alert rule you didn't have, a role that should have prevented this class of failure). These are not optional homework; add them to your runbook or backlog before you consider the mission closed.

## Done when

- Every item in the acceptance checklist is checked off and demonstrable.
- The chaos drill has been run, all three failures resolved (or honestly documented as unresolved within the time box), and the postmortem is written with real action items.
- The runbook, the Ansible repo, and the running infrastructure all agree with each other — no daylight between what's documented and what's actually deployed.
