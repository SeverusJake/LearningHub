# Mission 06 — HA + Cluster

**Track:** proxmox · **Difficulty:** 💀💀💀💀💀 · **Time:** 8-12h
**Prerequisites:** Missions 01, 04 (Ceph for shared storage)

**Safety note: node-failure simulation in this mission is a maintenance-window activity, not something you run on a whim. Coordinate with your team before you touch anything in Phase 5 — get an agreed window, agree which node, agree how long. Never let any step in this mission pull the real cluster's quorum below the level it needs to stay viable. The failure drill in this guide uses graceful, reversible methods, exercised on lab VMs only, one node at a time — never two nodes at once, never on a cluster that is already running degraded.**

## Goal

Understand corosync and quorum deeply enough to reason about them from first principles, not just recite `pvecm status` fields, and then safely exercise real HA failover on hardware that matters. Missions 01 and 04 gave you a fenced-off pool of VMs and a Ceph-backed shared storage layer; this mission is where those two things combine to prove that a VM can survive its node dying. Everything here runs on the same live, multi-node company cluster the rest of the track uses — the quorum math, the fencing, and the watchdog behavior you'll observe are the real mechanisms protecting real infrastructure, not a simulated stand-in for them.

By the end, you will have watched a lab VM survive a real, hard node failure — not a graceful shutdown, an actual watchdog-triggered reset — and you'll be able to explain every log line between the failure and the recovery in your own words, because you'll have read them happen in real time.

## Skills gained

- corosync configuration and quorum math: reading `corosync.conf`, computing vote thresholds by hand, and knowing exactly how many node failures a given cluster size tolerates
- Live migration vs. offline and local-disk migration: the mechanics of each, what storage layout each one requires, and measured real-world downtime for each
- `ha-manager` groups and priorities: building a prioritized failover policy so HA-managed VMs land on the node you intend, not just any node with room
- Node maintenance drains: safely emptying a node of every workload before a reboot or patch cycle, and watching it refill correctly afterward
- Reading fencing and watchdog behavior: what `softdog` actually guarantees, why Proxmox HA fences before it ever restarts anything, and how to read that entire sequence out of `journalctl`

## Deliverables

- [ ] An HA group (`labgroup`) with node priorities, holding at least two lab VMs, that fails over in priority order when their assigned node goes down
- [ ] Live migration and local-disk (or offline) migration both performed on real lab VMs, each with a continuous-ping downtime measurement backing up the numbers, not a guess
- [ ] A full, safely-executed node-failure drill (Phase 5) with a complete, line-by-line log trail from the moment the node dropped to the moment its VM was running again elsewhere — annotated in your own words

## Start

Open a Claude Code session in this folder and say: `start proxmox/06`. Follow GUIDE.md.
