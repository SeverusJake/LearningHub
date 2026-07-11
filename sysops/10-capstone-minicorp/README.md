# Mission 10 — Capstone: MiniCorp

**Track:** sysops · **Difficulty:** 💀💀💀💀💀 · **Time:** one weekend
**Prerequisites:** All of Missions 01-09. In particular: the Hyper-V lab and templates (01), storage and shared-storage patterns (03), routing/firewall/DNS/DHCP (04), TLS/mail/FreeIPA (05), the monitoring stack (06), backup discipline (07), a hardening baseline (08), and — critical — the Ansible control repo you built in Mission 09.

## Goal

MiniCorp just hired you as its only sysadmin. There is no infrastructure yet — just an empty rack of six blank template clones and a network plan. Your job is to build the entire company's server-side infrastructure from zero, entirely through the Ansible repo you started in Mission 09, and then prove it survives real failures. This mission does not teach you anything new; it forces you to integrate everything from Missions 02-09 into one coherent, reproducible, documented system, the way an actual first day at a small company would.

The second half of the mission is a live chaos drill: three failures staged back-to-back, a running clock, and only your own runbook and the system's man pages to work from. This is the closest thing in this track to a real on-call incident, and it is graded on whether you can recover without external help — including this guide.

## Skills gained

- Integrating routing, DNS/DHCP, identity, mail/file services, monitoring, and backup into one system that has to work together, not in isolation
- Authoring and maintaining an operations runbook that is actually usable under pressure — not written after the fact, but kept current as you build
- Structuring a multi-role Ansible repo at company scale: per-service roles, shared inventory groups, vaulted secrets, and a single entry-point playbook
- Phase-gated change management: deciding where snapshot boundaries belong and sticking to them
- Incident response and triage with a ticking clock and no external documentation
- Writing a blameless postmortem that produces real follow-up actions, not just a timeline

## Deliverables

- [ ] A 6-VM MiniCorp infrastructure (router/firewall, DNS+DHCP, identity, files+mail, monitoring, backup) built entirely from a single Ansible repo extended from Mission 09 — no manual, undocumented configuration on any node
- [ ] An operations runbook, written and maintained throughout the build, covering every service, its IP/hostname map, and common failure remediation
- [ ] Two real user accounts onboarded end-to-end (identity, mail, file access, SSO) as evidence the platform actually functions for its intended purpose
- [ ] A completed restore drill proving the backup node's snapshots are real and usable
- [ ] A survived, timed, 3-failure chaos drill run in a single live session, runbook-only, with a written blameless postmortem afterward
- [ ] A passed acceptance checklist (25+ items) covering network, identity, mail, files, monitoring, backup, security hygiene, and idempotency

## Start

Open a Claude Code session in this folder and say: `start sysops/10`. Follow GUIDE.md.
