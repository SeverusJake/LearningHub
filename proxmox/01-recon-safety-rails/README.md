# Mission 01 — Recon + Safety Rails

**Track:** proxmox · **Difficulty:** 💀 · **Time:** 3-4h
**Prerequisites:** none

## Goal

Understand the real cluster you have admin on, and build guardrails so nothing you do here touches production. You have full administrative rights on a live company Proxmox cluster with 3 or more nodes. That access is real and it is a privilege — every other VM, container, storage volume, and network on this cluster belongs to someone or something you are not authorized to touch. This mission comes first, before any building, because the rest of the Proxmox track assumes the guardrails built here are already in place: a dedicated resource pool, a dedicated network, a least-privilege API token, and a written safety doc you sign yourself.

## Skills gained

- Cluster inventory: reading cluster health and membership with `pvecm status` and `pveversion -v`
- Understanding pmxcfs (`/etc/pve`), the cluster-replicated configuration filesystem, and backing it up correctly
- Resource pool isolation: creating and using a Proxmox pool as a hard boundary
- Network isolation: choosing and building a dedicated bridge or VLAN so lab traffic can never reach production subnets
- Least-privilege API tokens: scoping a Proxmox API token to only the permissions and objects it needs

## Deliverables

- [ ] A cluster inventory document covering every node, storage backend, network config, and existing VM/CT census
- [ ] A working `/etc/pve` backup routine (script + systemd timer) running on a schedule
- [ ] The `learning` resource pool, the `vmbr-lab` bridge (or equivalent VLAN isolation), and a least-privilege API token (`learn@pve!tf`) — all created and verified
- [ ] A safety doc you have written and signed yourself: blast-radius statement, never-touch list, and rollback plan per mission type

## Start

Open a Claude Code session in this folder and say: `start proxmox/01`. Follow GUIDE.md.
