# Mission 05 — K8s Advanced

**Track:** devops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 04 (K8s Core)

## Goal

Take the raw `kubectl apply` manifests you hand-wrote for shiplog in Mission 04 and turn them into a real, reusable Helm chart — then prove the chart survives contact with load and with a stateful database. By the end of this mission you can package an application once and deploy it correctly to three different environments from the same source, watch it scale itself under real traffic, and trust that its Postgres backend keeps its data through pod restarts and rescheduling. This is the mission where "it works on my cluster" becomes "it works because the chart is the source of truth."

## Skills gained

- Authoring a Helm chart from scratch: `helm create` as a starting skeleton, stripped down and rebuilt into templates that actually match shiplog's Deployment, Service, Ingress, and Secret
- `_helpers.tpl` naming conventions and template functions (`include`, `default`, `required`, `toYaml`, `tpl`)
- Values-driven configuration across dev/staging/prod without duplicating templates — one chart, three value sets
- Config-drift-proofing with a checksum annotation so a ConfigMap/Secret change forces a pod roll, plus `required` guards on values that must never silently default
- `helm template` and `helm diff`-style review before every install; a `helm test` hook that proves the release actually serves traffic
- Horizontal Pod Autoscaler v2 on CPU metrics, backed by `metrics-server` on a kind cluster (which needs a TLS patch kind doesn't ship with by default)
- Load-testing a live service with k6 to trigger real autoscaling, not simulated
- Authoring a production-shaped Postgres StatefulSet: `volumeClaimTemplates`, a headless Service for stable pod DNS, and secret-driven credential init — versus adopting the Bitnami chart, with a reasoned tradeoff
- PodDisruptionBudget semantics and what they actually block during a voluntary node drain
- Kustomize overlays as the second way to manage multi-environment config, and a real opinion on when to reach for it instead of Helm

## Deliverables

- [ ] An authored Helm chart (not `helm create` left untouched) that deploys the whole shiplog stack — app Deployment, Service, Ingress, Secret, and Postgres — across three value-sets (dev/staging/prod)
- [ ] A working HPA that scales shiplog's replica count up under k6-generated CPU load and back down after it, observed live with `kubectl get hpa -w`
- [ ] Postgres running as a proper StatefulSet with persistent, stable storage — pod deletion doesn't lose data, and you can explain (or have built) the Bitnami-chart alternative and why you picked one
- [ ] A written kustomize-vs-helm comparison, backed by having actually built the same three environments both ways
- [ ] All three break-fix drills solved by diagnosis, not by guesswork
- [ ] The prove-it: `helm install shiplog ./chart -f values-prod.yaml` on a fresh kind cluster produces a fully working HTTPS app in one command, no manual edits afterward

## Start

Open a Claude Code session in this folder and say: `start devops/05`. Follow GUIDE.md.
