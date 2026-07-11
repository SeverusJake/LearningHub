# Mission 08 — Hardening

**Track:** sysops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01 (Lab Forge)

> **Warning:** several steps in this mission can lock you out of the VM you're hardening — a bad SSH config or an over-tight PAM rule stops you from logging back in. GUIDE.md gives you a snapshot-first workflow and an explicit test-before-disconnect procedure at every risky step. Read those warnings, don't skip them, and you'll never be worse off than a `Restore-VMSnapshot` away from a working machine.

## Goal

Take a Linux host from "fresh clone" to a documented, defensible security baseline — and then prove the baseline holds by attacking it yourself. You'll run a real auditing tool (Lynis), close the standard list of easy wins (SSH, filesystem mount options, kernel network settings, password policy, unused services), wire up detection (auditd, fail2ban), add patch automation and mandatory access control (unattended-upgrades, AppArmor), and finish by having Claude attempt real privilege-escalation and persistence tricks against your hardened box while you prove, with audit log evidence, that each one was caught.

## Skills gained

- Auditing a Linux host's security posture with Lynis and reading its findings
- Locking down SSH lab-wide: key-only auth, no root login, group-restricted access
- Applying a practical CIS Benchmark subset: mount options, service reduction, account lockout policy
- Hardening the kernel network stack with a documented `sysctl` baseline
- Writing auditd rules that catch privilege-escalation-relevant file and process activity
- Configuring fail2ban to automatically ban brute-force SSH sources
- Automating security patching with unattended-upgrades
- Enforcing AppArmor profiles and reading denials from the audit trail
- Diagnosing hardening-induced service breakage and lockouts, and building a baseline you can reapply to every future VM

## Deliverables

- [ ] Lynis hardening index raised by at least 15 points on one VM, before/after reports saved
- [ ] SSH locked down lab-wide: keys only, no root login, `AllowGroups ssh-users` enforced
- [ ] auditd rules catching sudoers/passwd edits and privilege-escalation-relevant `execve` calls, with a captured event as proof
- [ ] fail2ban active on `sshd`, proven by banning a real attacking IP from another VM
- [ ] A documented hardening baseline (sysctl file, auditd rules, fail2ban jail, SSH config, mount override) reusable as a drop-in on every future lab VM

## Start

Open a Claude Code session in this folder and say: `start sysops/08`. Follow GUIDE.md.
