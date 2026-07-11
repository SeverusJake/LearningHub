# Proxmox Track

## Track Goal

Master cluster-grade virtualization and build a git-driven private cloud on real company hardware. This track runs on a live, multi-node Proxmox VE cluster you administer with full admin rights — not a nested lab on your laptop. You'll go from a clean cluster inventory to a self-service platform where colleagues request VMs and namespaces through a pull request, picking up Ceph, HA, SDN, PBS, and Kubernetes-on-Proxmox along the way, all wired together with Terraform, Packer, and Ansible instead of clicking through the GUI.

## Safety Contract

You have full admin on shared company hardware. Every other node, VM, and service on this cluster belongs to someone or something you are not authorized to touch. These conventions are not suggestions — every mission in this track assumes them verbatim, and mission 01 exists specifically to put them in place before anything else happens.

```
Resource pool (all learning objects)  : learning
VM ID range (learning objects only)   : 9000-9999
Dedicated bridge                      : vmbr-lab            (with a lab VLAN tag range)
API token user (least-privilege)      : learn@pve!tf
Tag on every learning object          : learning
```

**Hard rules — no exceptions:**

- Never touch objects outside the `learning` pool. If it isn't tagged `learning` and isn't in your VM ID range, it isn't yours.
- Back up `/etc/pve` before any cluster-level change. No exceptions, no "it's just a small config edit."
- No storage or network changes outside dedicated lab resources (`vmbr-lab`, lab-tagged storage) without a written change note describing what, why, and rollback.
- Run anything cluster-wide (corosync changes, cluster-wide upgrades, SDN reloads affecting other nodes) only inside an agreed off-hours window.

## Mission Table

| # | Mission | Difficulty | Skills | Time |
|---|---------|------------|--------|------|
| 01 | [Recon + Safety Rails](01-recon-safety-rails/) | 💀 | Cluster inventory, `/etc/pve` config backup, resource pool setup, isolated bridge, API token | 3-4h |
| 02 | [Template Factory](02-template-factory/) | 💀💀 | VM/LXC templates, cloud-init, qemu-agent, hookscripts | 4-6h |
| 03 | [IaC on Proxmox](03-iac-on-proxmox/) | 💀💀💀 | Terraform (bpg provider), Packer, Ansible dynamic inventory | 8-12h |
| 04 | [Storage Deep](04-storage-deep/) | 💀💀💀💀 | ZFS replication, Ceph | 12-16h |
| 05 | [PBS](05-pbs/) | 💀💀💀 | Proxmox Backup Server, datastores, prune/verify, restore drills | 6-8h |
| 06 | [HA + Cluster](06-ha-cluster/) | 💀💀💀💀💀 | corosync, HA groups, live migration, fencing | 8-12h |
| 07 | [SDN](07-sdn/) | 💀💀💀 | Zones, VNets, VLAN segmentation, IPAM | 6-8h |
| 08 | [K8s on Proxmox](08-k8s-on-proxmox/) | 💀💀💀💀💀 | Terraform + cloud-init → HA k3s cluster | 12-16h |
| 09 | [Cluster Watchtower](09-cluster-watchtower/) | 💀💀 | PVE exporter, Grafana, alerting | 4-6h |
| 10 | [Capstone: Private Cloud](10-capstone-private-cloud/) | 💀💀💀💀💀 | Self-service platform, VM/namespace via pull request | 2-3 days |

## Progression

- **01 Recon + Safety Rails is mandatory first.** It establishes the resource pool, VM ID range, bridge, and API token that every later mission depends on. Nothing else runs safely without it.
- After 01, missions proceed by dependency, not strictly in number order:
  - **02** builds directly on 01 (templates live in the `learning` pool, on `vmbr-lab`).
  - **03** needs 01-02 — IaC targets the templates and safety rails already in place.
  - **04, 05, 06, 07, 09** each build on 01-03 (they provision and tear down their test objects through Terraform/Ansible, not by hand).
  - **08** needs 03 — the k3s cluster is provisioned entirely through Terraform and cloud-init.
  - **10 Capstone is last.** It needs 01-03 and 07-09: the safety rails, the IaC pipeline, SDN segmentation, the k3s platform, and the monitoring stack all get assembled into one self-service system.

## Cluster Note

This track assumes a real cluster of 3 or more nodes, which is what makes missions 04 (Ceph) and 06 (HA, live migration, fencing) meaningful — you're seeing actual quorum behavior, actual OSD rebalancing, and actual failover, not a simulation. Treat that as a privilege that comes with the safety contract above, not a footnote.

Mission 08 (K8s on Proxmox) is also where this track meets the DevOps track: the HA k3s cluster you build here is the platform that hosts the DevOps track's GitOps stack. Complete 08 before starting any DevOps mission that assumes a running cluster.
