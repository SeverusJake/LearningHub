# Mission 03 — Storage Wars

**Track:** sysops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Mission 01 (Lab Forge)

## Goal

Master Linux storage from the block layer up. You'll build, extend, break, and recover every major storage stack a sysadmin is expected to run in production: LVM for flexible volume management, mdadm software RAID for redundancy, ZFS for checksummed pools with snapshots and replication, and LUKS for at-rest encryption. Each stack gets built live, then deliberately damaged so you learn recovery under pressure instead of just reading about it.

## Skills gained

- Partition disks with `gdisk` (GPT, partition type codes)
- Build an LVM stack (PV → VG → LV), format ext4 and xfs, extend a live filesystem online with `lvextend -r`
- Take and revert an LVM snapshot
- Build mdadm RAID1 and RAID5 arrays, read `/proc/mdstat`, fail a member and hot-rebuild an array
- Install and run ZFS: mirrored pools, datasets with compression and quotas, snapshot/rollback, `zfs send | zfs recv` replication to a second host
- Encrypt a volume with LUKS and configure unattended auto-unlock at boot via keyfile + crypttab
- Apply an XFS project quota
- Recover from real storage failures: a disk pulled mid-write, a filesystem reported full when `du` disagrees with `df`, and a deleted logical volume

## Deliverables

- [ ] LVM stack built (ext4 + xfs LVs) and extended live with `lvextend -r` while mounted
- [ ] mdadm RAID1 array degraded and rebuilt clean; mdadm RAID5 array built across 3 disks
- [ ] ZFS mirrored pool `tank` with quota'd, compressed datasets, a snapshot/rollback performed, and a `zfs send | ssh | zfs recv` replica present on a second VM
- [ ] LUKS-encrypted volume that auto-unlocks at boot via keyfile, verified across a reboot
- [ ] XFS project quota enforced on a directory
- [ ] All 3 break-fix drills solved and documented
- [ ] Prove-it: live directory migrated from an LVM ext4 volume to a ZFS dataset with under 60 seconds of unavailability, with a written cutover plan

## Start

Open a Claude Code session in this folder and say: `start sysops/03`. Follow GUIDE.md.
