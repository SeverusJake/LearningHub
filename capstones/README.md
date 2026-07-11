# Capstones

Cross-track final projects. Each mission track (sysops, devops, proxmox) ends with its own in-track capstone (mission 10). The two capstones here are different: they deliberately span tracks, so the payoff of one track's missions becomes the input to another's. Do these after the prerequisite missions listed below — not instead of them.

## Capstone A — Full-Stack Money Machine

Take a real, revenue-capable product from `money/03-micro-tools/` and run it through your own DevOps and Proxmox stack instead of a managed PaaS. This is the mission that proves the other tracks weren't academic: the pipeline you built is the pipeline that ships your own product.

**What you build:** the micro-tool is designed in `money/03-micro-tools/`, containerized with the multi-stage, non-root, trivy-clean Dockerfile pattern from `devops/02-docker-deep/`, pushed through the test → scan → build → release pipeline from `devops/03-cicd-forge/`, promoted dev → staging → prod with zero direct `kubectl` via the ArgoCD app-of-apps setup from `devops/07-gitops/`, and deployed onto the HA k3s cluster you provisioned on the company Proxmox cluster in `proxmox/08-k8s-on-proxmox/`. Once live, it's instrumented end-to-end with the OpenTelemetry traces, RED dashboard, and SLO alerting from `devops/08-observability/`.

**Prerequisites (in this order):**
1. [money/03-micro-tools/](../money/03-micro-tools/) — the product itself: idea, build, Lemon Squeezy checkout
2. [devops/02-docker-deep/](../devops/02-docker-deep/) — containerize it
3. [devops/03-cicd-forge/](../devops/03-cicd-forge/) — automate test/scan/build/release
4. [devops/07-gitops/](../devops/07-gitops/) — git-only deploys, promotion via PR
5. [proxmox/08-k8s-on-proxmox/](../proxmox/08-k8s-on-proxmox/) — the cluster it runs on
6. [devops/08-observability/](../devops/08-observability/) — traces, metrics, logs, SLOs

**Acceptance criteria:**
- The tool is payment-capable (a real Lemon Squeezy checkout completes end-to-end, test mode or live) and reachable over HTTPS on a real domain.
- Every deployment to every environment happened through a git merge — no manual `kubectl apply`, no manual `docker push` to prod, no console clicks. Prove it with ArgoCD sync history and git log, not memory.
- Grafana dashboards show real traffic hitting the live tool: request rate, error rate, latency, and at least one trace for a real request captured end-to-end.

## Capstone B — Company Private Cloud

The executable mission for this capstone is [proxmox/10-capstone-private-cloud/](../proxmox/10-capstone-private-cloud/) — go there for the full requirements spec, request-file schema, pipeline design, and acceptance checklist. This entry just states why it counts as a capstone: it turns three tracks' worth of Proxmox, IaC, and GitOps skill into a self-service platform that has direct value to your actual employer, not just to your own lab.

This doubles as a portfolio piece: it is the one artifact in this repo built on real company hardware, solving a real platform problem (self-service provisioning without waiting on the admin), with a git-based audit trail you can walk a hiring manager or your own manager through.

**Acceptance criteria:**
- A teammate opens a pull request against the request repo with a VM (or namespace) request file, gets a plan posted back as a PR comment, merges it, and receives their working VM — with zero admin intervention from you at any point in the flow.
- Full audit trail of the provisioning is the git history itself: no side-channel Slack messages or manual notes required to reconstruct who requested what and when.
