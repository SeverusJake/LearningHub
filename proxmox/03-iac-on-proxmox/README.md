# Mission 03 — IaC on Proxmox

**Track:** proxmox · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Missions 01, 02 (devops/06 recommended for Packer/Terraform basics first)

## Goal

Provision and manage the Proxmox lab entirely as code — no manual clicks. Missions 01 and 02 gave you the guardrails (pool, bridge, least-privilege token) and a golden template (`tpl-ubuntu2404` at VMID 9000). This mission stops treating those as things you click through in the GUI and starts treating them as things Terraform, Packer, and Ansible declare, converge on, and tear down deterministically. By the end, a 5-VM environment — two web nodes, two app nodes, one database — comes up from a single `terraform apply`, gets configured by Ansible without you typing a single IP address by hand, and disappears without a trace on `terraform destroy`.

This is also where the devops track and the proxmox track share work instead of duplicating it: devops/06 already built a Packer-baked Ubuntu image with `node_exporter` and `qemu-guest-agent` compiled in, using the `qemu` builder against a bare cloud image. This mission builds the Proxmox-native equivalent directly on the cluster — same provisioner logic, different builder, because here you already have a warm template to clone instead of a cold ISO to boot.

## Skills gained

- The `bpg/proxmox` Terraform provider: authenticating with an API token, reading provider-native resources and data sources
- Reusable VM modules with `for_each`, turning a hand-written resource into a fleet defined by a map
- Packer's `proxmox-clone` builder: building a golden image directly on the cluster by cloning an existing template, provisioning it, and re-templating the result
- Ansible dynamic inventory sourced from live Proxmox tags via the `community.general.proxmox` plugin, replacing any hand-maintained inventory file
- State discipline on shared, non-disposable infrastructure: what belongs in this state file, what never does, and how to make destructive mistakes structurally harder

## Deliverables

- [ ] A Terraform module (`modules/pve-vm`) that clones a fleet of VMs from the template, driven entirely by a `for_each` map
- [ ] A Packer-built golden image, produced on top of VMID 9000 directly on the Proxmox cluster, with `node_exporter` baked in
- [ ] A working Ansible dynamic inventory built from `community.general.proxmox`, grouped by the `learning` tag and per-role tags
- [ ] A 5-VM environment (2 web, 2 app, 1 db) built, configured, and torn down with zero manual UI clicks
- [ ] All 3 break-fix drills solved by diagnosis, not guesswork
- [ ] Prove-it: `terraform apply` builds the 5-VM fleet, the dynamic inventory configures all 5, and `terraform destroy` leaves the cluster in exactly the state it was in before — proven with a before/after VM census, not a guess

## Start

Open a Claude Code session in this folder and say: `start proxmox/03`. Follow GUIDE.md.
