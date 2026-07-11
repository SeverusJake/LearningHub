# Mission 04 — K8s Core

**Track:** devops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Missions 01, 02

## Goal

Take shiplog — the FastAPI URL-shortener + Postgres app you built and containerized in Mission 02, image already sitting on `ghcr.io` — and run it for real on a multi-node Kubernetes cluster. Not a single-node toy: three `kind` nodes, raw manifests you write by hand (no Helm yet — that's Mission 05), traffic arriving through `ingress-nginx`, a `ServiceAccount` with real RBAC boundaries, and `NetworkPolicy` rules that default-deny everything and then punch only the holes you need. By the end you can deploy the whole stack from nothing in under ten minutes, and when something breaks — and five things will, on purpose — you can find the root cause with `kubectl` alone, fast.

## Skills gained

- Standing up a multi-node `kind` cluster with ingress-ready port mappings
- Writing raw Kubernetes manifests by hand: Deployment, Service, ConfigMap, Secret, PersistentVolumeClaim
- Liveness vs readiness probes, and why a misconfigured one causes very different failures
- Installing and wiring `ingress-nginx`, and routing HTTP traffic through it into a ClusterIP Service
- Rollout mechanics: `rollout status`, `rollout undo`, and tuning `maxSurge`/`maxUnavailable`
- Least-privilege RBAC: ServiceAccounts, Roles, RoleBindings, and proving permissions with `kubectl auth can-i`
- NetworkPolicy: default-deny, then explicit allow rules for DNS, ingress-to-app, and app-to-db traffic
- The core k8s debugging toolbox: `describe`, `events`, `logs --previous`, `exec`, `port-forward`, ephemeral debug containers

## Deliverables

- [ ] A 3-node `kind` cluster (1 control-plane + 2 workers) running shiplog end to end
- [ ] shiplog reachable over HTTP through `ingress-nginx`, not a `NodePort` shortcut
- [ ] A default-deny `NetworkPolicy` baseline in the `shiplog` namespace, with narrow allow rules for DNS, ingress→app, and app→db
- [ ] A least-privilege `ServiceAccount` for shiplog, proven with `kubectl auth can-i`
- [ ] All 5 seeded break-fix drills diagnosed and fixed under a 40-minute clock, one-line root cause written for each
- [ ] The whole stack redeployed from your own manifests, from zero, in under 10 minutes, without the guide open

## Start

Open a Claude Code session in this folder and say: `start devops/04`. Follow GUIDE.md.
