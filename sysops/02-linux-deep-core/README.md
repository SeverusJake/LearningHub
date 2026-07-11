# Mission 02 — Linux Deep Core

**Track:** sysops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01

## Goal

Get real mastery of the four things every Linux sysadmin lives in daily: systemd, journald, cgroups, and the user/sudo trust model. You'll build a genuine monitoring service from scratch — unit file, timer, logging, resource limits — then deliberately break your own system four different ways and recover it. This is the mission where "I've used Linux" turns into "I can fix Linux at 3am."

## Skills gained

- Write systemd service and timer units from scratch (not copy-pasted)
- Read and filter journald output by unit, priority, and time window
- Apply cgroup v2 memory limits to a process and observe an OOM kill
- Author a least-privilege sudoers drop-in and validate it safely
- Do process forensics with strace, lsof, and /proc
- Recover a system from fstab corruption, a masked unit, and a sudoers lockout

## Deliverables

- [ ] `labmon.service` + `labmon.timer` installed, enabled, and firing every 5 minutes
- [ ] Persistent journald storage configured and verified across a reboot
- [ ] A process throttled with `MemoryMax` that gets OOM-killed on purpose, visible in the journal
- [ ] `ops` user + group created, `/etc/sudoers.d/ops` policy written and validated with `visudo -cf`
- [ ] All four break-fix drills solved (fstab corruption, masked unit, sudoers lockout, fork bomb)
- [ ] Written root-cause + fix for the Prove-It `labmon.service` boot failure

## Start

Open a Claude Code session in this folder and say: `start sysops/02`. Follow GUIDE.md.
