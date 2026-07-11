# Mission 04 — Network Fortress

**Track:** sysops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 01 (Lab Forge)

## Goal

Turn your flat lab subnet into a segmented, firewalled, encrypted network with its own authoritative naming and addressing services. You'll carve the single `172.16.10.0/24` network into VLAN-separated segments behind a router VM, bond that router's NICs for link redundancy, lock every host down with default-deny `nftables`, punch an encrypted WireGuard tunnel between two nodes, then stand up authoritative `bind9` DNS for `lab.local` and a Kea DHCP server that registers leases in DNS automatically. By the end you have a small but real edge-to-core network stack, not a demo.

## Skills gained

- Tag and route VLAN subinterfaces (802.1q) on Linux, with Hyper-V trunk/access VLAN plumbing to match
- Bond two virtual NICs active-backup and prove failover under load
- Write, load, and persist a full `nftables` default-deny ruleset (input policy, established/related, NAT masquerade, DNAT port-forward)
- Build a WireGuard tunnel from scratch: keypairs, peer config, `allowed-ips` semantics
- Run authoritative `bind9` for a real zone — forward and reverse, with a working `named.conf.local`
- Deploy Kea DHCP with dynamic DNS updates (DDNS) secured by a TSIG key, so leases auto-register in `bind9`
- Read raw DHCP and DNS traffic off the wire with `tcpdump`

## Deliverables

- [ ] 3+ VM segmented network: a router VM with bonded NICs and VLAN subinterfaces, plus two or more segment VMs, all built from Mission 01 templates
- [ ] Default-deny `nftables` ruleset loaded and made persistent on every node (router does NAT + port-forward, hosts allow only SSH + established/related)
- [ ] Working WireGuard tunnel between two VMs, with `allowed-ips` scoped correctly on both ends
- [ ] Authoritative `bind9` zone for `lab.local` (forward + reverse) answering real `dig` queries
- [ ] Kea DHCP server handing out leases on a segment, with DDNS updates landing automatically in `bind9`
- [ ] Break-fix drills completed: bad gateway, MTU black hole, firewall self-lockout recovery, DNS forwarding loop
- [ ] Prove-it: 3-tier segmented network (web/app/db) with `nmap`-proven access rules from each tier

## Start

Open a Claude Code session in this folder and say: `start sysops/04`. Follow GUIDE.md.
