# SysOps Track

## Track Goal

Become a job-ready Linux sysadmin by building — and deliberately breaking — a real multi-VM lab on your own PC. Using Hyper-V on Windows 11, you'll stand up a network of Linux servers, run production-grade services on them, monitor them, back them up, harden them, automate their rebuild, and recover them after simulated disasters. Every mission produces artifacts and scars you'd otherwise only get from real on-call experience: working configs, break-fix war stories, and muscle memory for the tools sysadmins use daily.

## Lab Topology

These values are canonical. Every mission guide in this track assumes them verbatim — do not alter them.

```
Hyper-V internal switch name : LabSwitch
NAT network                  : 172.16.10.0/24
NAT gateway                  : 172.16.10.1
Lab domain                   : lab.local
VM naming convention         : lab-<role>          (e.g. lab-dns1)
Base template (Ubuntu 24.04) : tpl-ubuntu2404
Base template (Rocky 9)      : tpl-rocky9
```

## Mission Table

| # | Mission | Difficulty | Skills | Time |
|---|---------|------------|--------|------|
| 01 | [Lab Forge](01-lab-forge/) | 💀💀 | Hyper-V switches/NAT, VM templates, cloud-init, snapshots | 4-6h |
| 02 | [Linux Deep Core](02-linux-deep-core/) | 💀💀💀 | systemd, journald, cgroups, users/sudo, break-fix | 8-12h |
| 03 | [Storage Wars](03-storage-wars/) | 💀💀💀 | LVM, mdadm RAID, ZFS, LUKS, quotas | 8-12h |
| 04 | [Network Fortress](04-network-fortress/) | 💀💀💀💀 | VLANs, bonding, nftables, WireGuard, bind9, Kea DHCP | 12-16h |
| 05 | [Service Citadel](05-service-citadel/) | 💀💀💀💀💀 | nginx+TLS/private CA, Postfix+Dovecot mail, FreeIPA SSO | 16-24h |
| 06 | [All-Seeing Eye](06-all-seeing-eye/) | 💀💀💀 | Prometheus, Grafana, Alertmanager, Loki, runbooks | 8-12h |
| 07 | [Doomsday Drill](07-doomsday-drill/) | 💀💀💀💀 | restic/borg backups, timed destroy-and-restore | 8-10h |
| 08 | [Hardening](08-hardening/) | 💀💀💀 | CIS benchmark, auditd, SSH lockdown, Lynis, fail2ban | 8-12h |
| 09 | [Automation](09-automation/) | 💀💀💀💀 | advanced bash → Ansible, rebuild lab from playbooks | 12-16h |
| 10 | [Capstone: MiniCorp](10-capstone-minicorp/) | 💀💀💀💀💀 | full company infra from zero, chaos drill | one weekend |

## Progression

- **01 Lab Forge is mandatory first** — it builds the lab itself; nothing else runs without it.
- **02-09 can be done in any order** once the lab exists. Pick based on which skill gap you want to close next.
- **10 Capstone: MiniCorp is last** — it draws on every skill from 02-09 and assumes they're already in place.

## Host Requirements

- Windows 11 Pro (Hyper-V requires Pro, Enterprise, or Education — not Home)
- 32GB RAM
- ~200GB free disk space
- Hyper-V feature enabled
- Virtualization enabled in BIOS/UEFI (Intel VT-x/AMD-V)
