# Mission 01 — Lab Forge

**Track:** sysops · **Difficulty:** 💀💀 · **Time:** 4-6h
**Prerequisites:** none

## Goal

Build the Hyper-V lab foundation that every later sysops mission runs on. You'll stand up an isolated internal network with NAT internet access, then build two golden VM templates (Ubuntu 24.04 and Rocky 9) that clone cleanly with no identity collisions. By the end you can spin up a fresh, uniquely-identified VM in under two minutes.

## Skills gained

- Create a Hyper-V internal switch and NAT gateway for an isolated lab subnet
- Build cloud-init-ready, generalized VM templates (machine-id, SSH host keys, hostname all clean)
- Clone a template and regenerate machine identity (machine-id, host keys, hostname, static IP)
- Configure static networking on Ubuntu (netplan) and Rocky (nmcli)
- Apply snapshot discipline (`Checkpoint-VM`) before risky changes

## Deliverables

- [ ] `LabSwitch` internal switch + `LabNat` NAT up, host can ping `172.16.10.1`
- [ ] `tpl-ubuntu2404` template built, generalized, marked do-not-boot
- [ ] `tpl-rocky9` template built, generalized, marked do-not-boot
- [ ] Documented clone procedure (machine-id/host-keys/hostname/IP regen checklist)
- [ ] 3 test VMs cloned from templates with static IPs `.21`, `.22`, `.23`, all pingable and SSH-reachable from the host and from each other

## Start

Open a Claude Code session in this folder and say: `start sysops/01`. Follow GUIDE.md.
