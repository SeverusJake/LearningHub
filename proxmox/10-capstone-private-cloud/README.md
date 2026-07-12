# Mission 10 — Capstone: Private Cloud

**Track:** proxmox · **Difficulty:** 💀💀💀💀💀 · **Time:** 2-3 burst days
**Prerequisites:** Missions 01-03, 07-09 (Recon + Safety Rails, Template Factory, IaC on Proxmox, SDN, K8s on Proxmox, Cluster Watchtower); devops/03, 06-07 (CI/CD Forge, IaC, GitOps)

## Goal

Turn every artifact the last nine missions produced into one thing a colleague can actually use without asking you for anything: a git-driven private cloud. A teammate opens a pull request against a small YAML file describing a VM or a Kubernetes namespace, the pipeline validates it, plans it, and posts the plan back as a comment; a reviewer merges; the pipeline applies it against the real cluster and posts back exactly how to connect. No GUI clicks, no Slack message asking you to "spin something up," no tribal knowledge about which VMID is free. The Terraform modules from Mission 03, the SDN segmentation from Mission 07, the k3s cluster from Mission 08, the monitoring stack from Mission 09, and the CI/CD and GitOps patterns from devops/03 and devops/07 all get wired into one self-service platform, gated by policy instead of by you being awake.

This is the mission where the guide stops holding your hand. You've built a self-hosted runner, you've written Terraform against this exact cluster, you've built PR-triggered pipelines that comment on their own output, and you've handed deployment authority to ArgoCD. Everything below is a requirements spec and an acceptance checklist, not a phase-by-phase walkthrough — the walkthrough already happened, across nine missions, and it's sitting in your own repos.

By the end, you'll demo this to one real colleague, live, and watch a merged PR turn into a running VM or a quota-enforced namespace while they watch.

## Skills gained

- **CI/CD-driven infrastructure requests** — turning a declarative request file into a validated, planned, applied piece of real infrastructure with no human running `terraform apply` by hand
- **Policy-gated approvals** — encoding size limits, naming conventions, and mandatory expiry into machine-checked gates, with a human-approval label as the deliberate escape hatch for anything outside the defaults
- **PR-based provisioning workflows** — the same plan-on-PR / apply-on-merge shape for two very different backends (Proxmox VMs via Terraform, k8s namespaces via kubectl/ArgoCD), proving the pattern generalizes instead of being a Terraform-only trick
- **Audit-via-git-history** — reconstructing who asked for what, when, and why from `git log` alone, with no side channel ever required to explain why a resource exists
- **Presenting technical work to a team** — writing the one-page pitch that turns nine missions of lab work into a credible "here's what I built and here's what it's worth" conversation with your actual team

## Deliverables

- [ ] A request-format schema: `requests/vm-<name>.yaml` (name, size S/M/L, image, owner, expiry) and `requests/ns-<name>.yaml` (namespace, cpu/mem quota, owner), both documented and validated by the pipeline before anything plans
- [ ] A GitHub Actions pipeline on the devops/03 self-hosted runner, living in the lab network: plans and comments on every PR touching `requests/`, applies and comments connection details on every merge
- [ ] Policy gates enforced in code: a naming convention, mandatory expiry, size limits with a human-approval label required above the default ceiling, and a scheduled workflow that opens teardown PRs the moment a request's expiry date passes
- [ ] A k8s-namespace request path that renders `ResourceQuota` + `LimitRange` manifests from the request file and lands them on the Mission 08 k3s cluster through the same plan-on-PR / apply-on-merge shape, GitOps-style
- [ ] All 15 items in GUIDE.md's acceptance checklist passed, in order, against the real cluster
- [ ] A one-page pitch writeup, and a demo actually delivered to one colleague — not just written down as "could be demoed"

## Start

Open a Claude Code session in this folder and say: `start proxmox/10`. Follow GUIDE.md.
