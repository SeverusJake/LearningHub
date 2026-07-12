# Mission 07 — SDN

**Track:** proxmox · **Difficulty:** 💀💀💀 · **Time:** 6-8h
**Prerequisites:** Mission 01

## Goal

Use Proxmox's Software-Defined Networking to run multiple isolated tenant networks across cluster nodes, entirely inside the lab scope Mission 01 fenced off. Every mission before this one either used a single flat lab bridge (`vmbr-lab`) or borrowed someone else's network design. This mission is where you build the network layer yourself: zones that define how isolation and overlay work, VNets that VMs actually plug into, subnets with real DHCP and IP address tracking, and firewall rules that prove one tenant genuinely cannot reach another. Nothing here leaves the `learning` pool, the `9000-9999` VMID range, or `vmbr-lab` — you are building multi-tenant networking on top of the same fence Mission 01 put up, not extending the fence itself.

By the end, you will have run real tenant traffic — DHCP-assigned, VLAN-segmented, cross-node — over infrastructure you configured entirely through Proxmox's SDN layer, and you'll have a scripted nmap sweep proving the isolation is real, not assumed.

## Skills gained

- The SDN zone/vnet/subnet model: how Proxmox's own abstraction layer maps onto real Linux networking primitives, and how it differs structurally from the classic bridge-per-node approach every earlier mission used
- IPAM in practice: using Proxmox's built-in `pve` IPAM plugin to allocate and track subnet addresses instead of a spreadsheet
- Cross-node overlay networking: building a VXLAN zone that gives VMs on different physical nodes a working shared L2 segment with nothing but IP reachability between the nodes
- Egress control via exit nodes: SNAT-ing tenant traffic out through a designated node, and enforcing which destinations that egress is actually allowed to reach
- VNet-level firewalling: proving tenant isolation with a real scan, and understanding exactly why SDN's routing alone does not give you isolation for free

## Deliverables

- [ ] SDN zones and VNets serving three isolated tenant networks, each reachable from VMs on more than one cluster node
- [ ] IPAM in active use — every tenant subnet's addresses allocated and visible through the `pve` IPAM plugin, not hand-assigned
- [ ] Controlled egress via a designated exit node with SNAT enabled per subnet, proven to reach an allowed lab-internal destination
- [ ] A scripted nmap sweep showing tenant-to-tenant traffic blocked while tenant-to-egress traffic succeeds, for all three tenants
- [ ] Every zone, VNet, subnet, and firewall rule created for this mission removed at the end, leaving the cluster's SDN state exactly as Mission 01 left it

## Start

Open a Claude Code session in this folder and say: `start proxmox/07`. Follow GUIDE.md.
