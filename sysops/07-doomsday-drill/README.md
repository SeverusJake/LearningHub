# Mission 07 — Doomsday Drill

**Track:** sysops · **Difficulty:** 💀💀💀💀 · **Time:** 8-10h
**Prerequisites:** Mission 01 (Lab Forge). Mission 06 (All-Seeing Eye) is required for the alert-integration steps in Phase 3 and the destroy-and-restore drill — without a working Alertmanager, backup failures fail truly silently.

> **Warning:** the point of this mission isn't the backup tooling — it's finding out whether your restore actually works before you need it to. Most of the pain in this mission is deliberate: writing an RTO down and then being timed against it.

## Goal

Design a backup policy for the lab like you'd be expected to defend one at work, then prove it survives contact with reality. You'll pick what gets backed up and how often *before* touching any tooling, stand up scheduled restic backups with alert integration, and then have one of your own VMs destroyed without warning so you can restore it against the clock, on the RTO you wrote for yourself.

## Skills gained

- restic repository design, scheduling, and env-file secret handling
- Writing an RPO/RTO policy per system and justifying the numbers
- Prune/retention design (`--keep-daily` / `--keep-weekly`) and the reasoning behind it
- Full-system, full-directory, and single-file restore under time pressure
- Database-consistent backups (`mariadb-dump` pre-backup hooks) instead of backing up a live datadir
- Detecting a silently-failed backup job through alerting, not by noticing the outage yourself

## Deliverables

- [ ] restic backups of every critical lab VM running on a nightly systemd timer
- [ ] A written backup policy document: every lab system, its RPO, its RTO, and whether it holds data, config, or both
- [ ] Backup success/failure wired into Mission 06's Alertmanager, including a staleness alert for silent failures
- [ ] One full, timed restore of a destroyed VM, performed live and documented against your own written RTO
- [ ] A completed postmortem for the destroy-and-restore drill
- [ ] `/etc/nginx` restored exactly as it existed 3 snapshots ago, proven with `diff`

## Start

Open a Claude Code session in this folder and say: `start sysops/07`. Follow GUIDE.md.
