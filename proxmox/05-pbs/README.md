# Mission 05 — PBS

**Track:** proxmox · **Difficulty:** 💀💀💀 · **Time:** 6-8h
**Prerequisites:** Mission 01 (Mission 02 strongly recommended — you need actual lab VMs to back up)

## Goal

Deploy Proxmox Backup Server and prove you can actually restore under time pressure, not just take backups. Anyone can schedule a backup job and never look at it again; this mission exists because that habit is exactly how companies discover — during a real outage — that their backups were silently broken for months. By the end, PBS is running as a real VM on the cluster with its own datastore, your lab VMs are backed up on a schedule with client-side encryption, pruning and garbage collection keep the datastore bounded, verify jobs are catching corruption before you need the data, and you have personally destroyed a VM and a file on purpose and gotten both back within an RTO you wrote down *before* you broke anything.

## Skills gained

- PBS datastore setup on a dedicated disk, separate from the OS
- Encrypted backup jobs: client-side AES-256 encryption keys, passphrase + master-key escrow, and the paper backup that survives a lost laptop
- Prune/retention math — turning `keep-last`/`keep-daily`/`keep-weekly`/`keep-monthly`/`keep-yearly` into a bounded, explainable snapshot count
- Garbage collection and reading a datastore's deduplication factor
- Verify jobs and why silent disk-level corruption (bitrot) is worse than a backup that fails loudly
- Full VM restore to a new VMID, single-file restore from an encrypted backup, and knowing when live-restore is (and isn't) the right call
- The sync-job concept as an offsite stand-in

## Deliverables

- [ ] PBS running as a VM on the cluster with a working datastore on its own dedicated disk
- [ ] Scheduled, encrypted backup jobs covering the `learning` pool, with prune, verify, and garbage collection all configured and proven to run
- [ ] A timed full VM restore to a new VMID, and a timed single-file restore from an encrypted backup, both performed for real and recorded against an RTO you wrote down beforehand
- [ ] A working sync job to a second datastore standing in for an offsite copy
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork

## Start

Open a Claude Code session in this folder and say: `start proxmox/05`. Follow GUIDE.md.
