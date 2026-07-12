# Mission 04 — Storage Deep

**Track:** proxmox · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 01 (03 recommended)

**Safety note: every storage experiment in this mission stays confined to lab disks and lab pools only. If a node has no spare disk or partition to give you, do not repurpose one that's in production use — use the file-backed vdev fallback in Phase 1/2 instead, and coordinate with your team before touching anything on shared storage.** Creating a ZFS pool or a Ceph OSD both destroy whatever was previously on the target block device with no confirmation prompt worth trusting — treat every `zpool create` and `pveceph osd create` command in this guide as a one-way door, and double, triple-check the device name against the recon table you build in Phase 1 before you run it for real.

## Goal

Master both ZFS replication and Ceph on real multi-node hardware. Missions 01-03 gave you a fenced-off pool, a golden template, and an IaC pipeline — everything so far has lived on whatever default storage the cluster shipped with. This mission stops treating storage as a given and starts treating it as something you design: a ZFS pool with asynchronous replication between two nodes, and a genuine Ceph cluster spanning three or more nodes with real OSDs, real placement groups, and real CRUSH placement. Because your cluster actually has 3+ nodes, the Ceph half of this mission is not a toy — `ceph -s` reports on real quorum, real recovery traffic crosses a real network between real disks, and an OSD you kill is a daemon that was actually serving data a second ago, not a simulation of one.

By the end, you'll have watched a VM keep running, uninterrupted, while an entire OSD went down mid-write and Ceph rebuilt redundancy around it — and you'll have your own numbers, not vendor marketing, backing up when you'd reach for ZFS replication and when you'd reach for Ceph instead.

## Skills gained

- ZFS pools, datasets, and snapshots on Proxmox, including the file-backed vdev fallback for when a node has no spare disk
- Proxmox's native storage replication (`pvesr`) and the underlying `zfs send`/`receive` mechanics it automates
- Ceph's core concepts — monitor, manager, OSD, pool, placement group, CRUSH — well enough to explain what each one is actually responsible for
- Standing up a lab Ceph cluster with `pveceph`: mons, mgrs, OSDs on real disks, and an RBD pool sized for real replication
- Reading Ceph's health output (`ceph -s`, `ceph osd tree`) fluently enough to tell "recovering" from "actually broken" at a glance
- Surviving an OSD failure with a VM's filesystem live and writing through it, and proving the survival with evidence, not a claim

## Deliverables

- [ ] A working ZFS replication job moving a VM's disk from one node to a second node on a schedule, proven with a real failover test
- [ ] A healthy lab Ceph cluster (`HEALTH_OK`) with a `lab-rbd` pool at size 3 / min_size 2, backing at least one running VM's disk
- [ ] A demonstrated OSD-failure survival: a VM under active write load stays up and filesystem-clean while an OSD is stopped and Ceph recovers
- [ ] A ZFS-vs-Ceph decision doc, grounded in your own `rados bench`/`rbd bench` (and comparable ZFS) numbers, not received wisdom
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork

## Start

Open a Claude Code session in this folder and say: `start proxmox/04`. Follow GUIDE.md.
