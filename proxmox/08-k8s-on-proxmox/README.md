# Mission 08 — K8s on Proxmox

**Track:** proxmox · **Difficulty:** 💀💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 03 (IaC on Proxmox) — mandatory. devops/04-07 (K8s Core through GitOps) strongly recommended: this mission assumes you already know what a Deployment, a Service, an HPA, and an ArgoCD Application are, and spends its time on what's different about running them on a cluster you provisioned yourself instead of `kind`.

## Goal

Every devops-track mission so far has run shiplog on `kind` — a real Kubernetes API, but one that lives inside a single Docker daemon on your laptop and disappears the moment you delete it. This mission builds the real thing: a highly-available k3s cluster — three control-plane nodes running embedded etcd, two workers — provisioned entirely by the Terraform module from Mission 03 and cloud-init, running on your own slice of the company Proxmox cluster. No `kind`, no laptop-local Docker network, no single point of failure in the control plane.

Once the cluster is up, this is also the mission where the proxmox and devops tracks physically merge: the ArgoCD instance devops/07 built gets pointed at this cluster as a second managed target, and shiplog — the same app, the same Helm chart, the same GitOps repo — gets deployed here as a new environment. By the end you will have killed a control-plane VM out from under a running workload, on purpose, under load, and watched the cluster shrug it off.

## Skills gained

- k3s HA architecture with embedded etcd: what "embedded" buys you over kubeadm's stacked or external etcd, and what it costs
- Driving a multi-role VM fleet's bootstrap entirely through cloud-init — no post-boot SSH-and-type-commands step anywhere in the cluster's creation
- `kube-vip` for a control-plane virtual IP: how a VIP can exist before the API server it's supposed to be fronting has even started
- MetalLB in Layer 2 mode: giving `LoadBalancer` Services real, ARP-announced IPs on a bare-metal lab network that has no cloud provider to hand them out
- Proxmox CSI vs. k3s's built-in local-path provisioner: when node-local storage is fine and when it silently breaks HA
- Registering an external, non-`kind` cluster into an existing ArgoCD instance and shipping a real app onto it
- Resilience testing a stateful control plane for real: node replacement via Terraform, and a full hard node kill with etcd quorum and API availability as the measured outcome, not a guess

## Deliverables

- [ ] A 5-VM k3s cluster (3 servers, 2 agents) provisioned entirely by the Mission 03 Terraform module plus per-role cloud-init, inside the `learning` pool, VMIDs in `9000-9999`
- [ ] A working control-plane VIP via `kube-vip`, with `kubectl get nodes` showing all 5 nodes `Ready` through it
- [ ] MetalLB running in L2 mode, proven with a real `LoadBalancer` Service reachable by IP from the lab network
- [ ] A stated, evidenced comparison of local-path storage vs. Proxmox CSI, with a working PVC on each
- [ ] This cluster registered into the devops/07 ArgoCD instance and running shiplog as a new `pve` environment, reachable through an Ingress fronted by a MetalLB IP
- [ ] Survival of a hard-killed k3s server VM demonstrated under active k6 load, with a timeline and `kubectl get events` as evidence

## Start

Open a Claude Code session in this folder and say: `start proxmox/08`. Follow GUIDE.md.
