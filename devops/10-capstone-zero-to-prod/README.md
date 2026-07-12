# Mission 10 — Capstone: Zero-to-Prod

**Track:** devops · **Difficulty:** 💀💀💀💀💀 · **Time:** one focused, timed day
**Prerequisites:** Missions 01-09 (Git Mastery through Chaos + SRE)

## Goal

Prove you can assemble everything the last nine missions taught you into one working platform, from nothing. Start from a completely empty directory. Run `make bootstrap`. Walk away and come back to a `kind` cluster with ArgoCD installed and managing itself via an app-of-apps, shiplog deployed and synced through GitOps, a CI/CD pipeline on a fresh GitHub repo that ships images and opens its own tag-bump PRs, and a full observability stack — dashboards and SLO alerts included — deployed the same GitOps way as everything else. No mission-by-mission hand-holding this time: this is the day you find out whether Missions 01-09 actually taught you a platform, or just nine disconnected exercises. `make destroy` has to hand it all back just as cleanly.

## Skills gained

- **Platform assembly** — taking the Docker image (02), CI pipeline (03), Kubernetes manifests and Helm chart (04-05), Terraform/Packer (06), ArgoCD app-of-apps (07), observability stack (08), and chaos/SRE drills (09) you already built and wiring them into one coherent, self-consistent system instead of nine standalone artifacts
- **Bootstrap automation** — collapsing a multi-tool, multi-repo, multi-hour manual sequence into a single idempotent `make bootstrap` target (and its inverse, `make destroy`), with real dependency ordering between cluster, GitOps controller, and workloads
- **Self-service delivery** — building the platform to the standard where a stranger with only your README and your public repos can reproduce the whole thing without asking you a single question, and where a code change flows from `git push` to a running pod with no manual step in between

## Deliverables

- [ ] From a completely empty directory, one command — `make bootstrap` — produces: a `kind` cluster, ArgoCD installed and self-managing through an app-of-apps root application, and shiplog running in `dev` fully synced through GitOps
- [ ] A fresh GitHub repo wired with CI: pull-request checks, a release workflow that builds and publishes an image, and an automated GitOps tag-bump PR that ArgoCD picks up and syncs with no manual `kubectl apply`
- [ ] An observability stack (metrics, dashboards, alerting) deployed the same way as shiplog — as an ArgoCD-managed application, not a one-off `helm install` — with a live RED dashboard and live SLO burn-rate alerts
- [ ] `make destroy` tears every piece back down cleanly, and a second `make bootstrap` reproduces the identical working state from scratch
- [ ] A README a stranger could run end to end with no other context than what's in this repo
- [ ] All 20 items in GUIDE.md's acceptance checklist passed, with a timing log showing the whole run completed in one focused day (target ≤8h)

## Start

Open a Claude Code session in this folder and say: `start devops/10`. Follow GUIDE.md.
