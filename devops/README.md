# DevOps Track

## Track Goal

Take one real application from a blank laptop all the way to a production-grade, GitOps-managed Kubernetes deployment with full observability — and learn every layer of the modern platform stack by actually building it, not by reading about it. You'll write the app, containerize it, pipeline it, orchestrate it, provision its infrastructure as code, hand its deployment over to GitOps, instrument it end to end, and then break it on purpose to prove it survives. Every mission adds one real layer on top of the last; by the capstone you can go from an empty repo to a self-healing, observable, git-driven platform in a single working day.

## The App: shiplog

**shiplog** is the one application every mission in this track builds, ships, and operates. It's a FastAPI URL-shortener with hit-stats and a Postgres backend — small enough to build in an afternoon, real enough to need a database, health checks, metrics, and actual production concerns at every layer. You build shiplog once, in mission 02, and every mission after that containerizes it, deploys it, scales it, secures it, observes it, or breaks it. Its repo lives at `devops/shiplog/`.

| Endpoint | Purpose |
|---|---|
| `POST /links` | Create a short link |
| `GET /{slug}` | Redirect to the target URL |
| `GET /stats/{slug}` | Return hit stats for a slug |
| `GET /healthz` | Liveness check |
| `GET /metrics` | Prometheus metrics |

## Mission Table

| # | Mission | Difficulty | Skills | Time |
|---|---------|------------|--------|------|
| 01 | [Git Mastery](01-git-mastery/) | 💀💀 | Rebase, bisect, hooks, trunk-based dev, Actions basics | 4-6h |
| 02 | [Docker Deep](02-docker-deep/) | 💀💀💀 | Multi-stage builds, compose, image hardening, trivy | 8-12h |
| 03 | [CI/CD Forge](03-cicd-forge/) | 💀💀💀 | GitHub Actions, self-hosted runner, full pipeline | 8-12h |
| 04 | [K8s Core](04-k8s-core/) | 💀💀💀💀 | kind multi-node, ingress, RBAC, network policies, break-fix | 12-16h |
| 05 | [K8s Advanced](05-k8s-advanced/) | 💀💀💀💀 | Authoring Helm charts, HPA, StatefulSet Postgres | 12-16h |
| 06 | [IaC](06-iac/) | 💀💀💀 | Terraform modules + state, Packer images | 8-12h |
| 07 | [GitOps](07-gitops/) | 💀💀💀💀 | ArgoCD app-of-apps, sealed-secrets, dev→prod promotion | 12-16h |
| 08 | [Observability](08-observability/) | 💀💀💀💀 | OpenTelemetry, Tempo/Loki/Grafana, SLOs | 12-16h |
| 09 | [Chaos + SRE](09-chaos-sre/) | 💀💀💀💀 | chaos-mesh, k6 load testing, postmortems | 8-12h |
| 10 | [Capstone: Zero-to-Prod](10-capstone-zero-to-prod/) | 💀💀💀💀💀 | Empty repo → one-command GitOps k8s platform | one day |

## Tool Prerequisites

Install these before starting mission 01, then confirm each with its version check:

```bash
# Docker (Docker Desktop, or docker inside WSL2)
docker --version

# kind (Kubernetes in Docker)
kind --version

# kubectl
kubectl version --client

# Helm
helm version

# Terraform
terraform --version

# Git
git --version

# GitHub CLI
gh --version
```

If any command fails, install that tool before continuing — every mission from 02 onward assumes the full set is already on your PATH.

## Progression

- **01 → 02 → 03 in order.** Git discipline (01) is assumed by the CI pipeline (03), and the pipeline builds the image produced in Docker Deep (02).
- **04 → 05 in order.** K8s Advanced (05) builds its Helm chart and StatefulSet on top of the raw manifests and cluster from K8s Core (04).
- **06 (IaC) can be done anytime** after 03 — it doesn't depend on the Kubernetes missions and nothing later strictly depends on it, though its Terraform/Packer skills feed into later tracks.
- **07 and 08 both require 04** — GitOps (07) promotes the Deployment manifests from K8s Core, and Observability (08) instruments the running cluster from K8s Core.
- **09 requires 07** — chaos experiments run against the GitOps-managed deployment, and its SLO checks depend on the dashboards built in 08.
- **10 is last.** The capstone assumes every skill from 01-09 and gives you nothing but an empty repo and a clock.
