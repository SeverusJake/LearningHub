# Mission 02 — Template Factory

**Track:** proxmox · **Difficulty:** 💀💀 · **Time:** 4-6h
**Prerequisites:** Mission 01

## Goal

Build reusable cloud-init VM and LXC templates so every later mission can clone infrastructure in seconds instead of installing operating systems by hand. By the end of this mission, spinning up a fresh, network-reachable, SSH-ready VM is a one-command clone, not a 20-minute installer wizard.

## Skills gained

- Building a cloud-init-ready VM from scratch with `qm create` and `qm importdisk`
- Wiring up a cloud-init drive: static IP via `--ipconfig0`, SSH keys, and a vendor snippet that installs `qemu-guest-agent`
- Converting a VM to a template with `qm template` and understanding full clones vs linked clones
- Building an LXC container template with `pveam` and `pct create`, and knowing when to reach for LXC instead of a VM
- Writing and attaching a hookscript that runs custom logic on VM lifecycle events
- Template hygiene: version tagging and a documented, repeatable rebuild procedure

## Deliverables

- [ ] An Ubuntu 24.04 cloud-init template at VMID `9000`, in the `learning` pool, tagged `learning`, living on `vmbr-lab`
- [ ] A working LXC template workflow (downloaded via `pveam`, built with `pct create`, unprivileged)
- [ ] A hookscript attached to a VM that tags and logs on start, with log output to prove it ran
- [ ] Clone → boot → SSH-reachable in under 2 minutes, fully automated, proven repeatable by running the same script twice
- [ ] All template/clone objects respect the VMID range `9000-9999` and carry the `learning` tag

## Start

Open a Claude Code session in this folder and say: `start proxmox/02`. Follow GUIDE.md.
