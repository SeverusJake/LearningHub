# Mission 07 — GitOps

**Track:** devops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 03 (CI/CD Forge), Mission 05 (K8s Advanced)

## Goal

Take the shiplog Helm chart from Mission 05 and the CI pipeline from Mission 03, and hand deployment authority to ArgoCD entirely. From this mission on, `kubectl apply`/`helm install` against dev, staging, or prod is not a thing you do by hand anymore — git is the only place a deployment change is made, ArgoCD is the only thing that talks to the cluster's API server on your behalf, and a rollback is `git revert`, not a frantic `kubectl` session. You'll wire real secrets through sealed-secrets so the git repo stays safe to make public, extend the Mission 03 pipeline so a release opens a pull request instead of touching the cluster directly, and prove environment promotion is just PRs between values files. By the end, you can point at git history and ArgoCD's sync history and reconstruct exactly what's running in prod and why — no tribal knowledge, no "I think someone kubectl-edited that once."

## Skills gained

- Structuring a gitops repo: `apps/shiplog/{base,envs/dev,envs/staging,envs/prod}` built on the Mission 05 Helm chart, one set of templates and per-environment values
- ArgoCD Application manifests, sync policies (automated vs. manual), `prune` and `selfHeal`, and the app-of-apps pattern for managing many Applications from one root
- Watching and proving self-heal: deleting a live Deployment and watching ArgoCD put it back from git, unprompted
- sealed-secrets: installing the controller, the `kubeseal` workflow for turning a real Secret into a `SealedSecret` that's safe to commit, and the namespace/name scoping that makes a sealed secret useless outside its intended target
- Extending the Mission 03 GitHub Actions workflow so a release automatically opens a PR against the gitops repo bumping an image tag (`yq` in-place edit + `peter-evans/create-pull-request`), instead of a workflow job touching the cluster
- Environment promotion modeled as git: a PR copying dev's proven values into staging, then prod — no separate deploy tooling, no manual diffing
- Sync waves and a PreSync hook for a database-migration Job that must finish before the app pods roll
- Rollback via `git revert` and comparing that mental model directly against `kubectl rollout undo`

## Deliverables

- [ ] ArgoCD running on the kind cluster, managing shiplog's dev, staging, and prod environments entirely from an app-of-apps root Application
- [ ] sealed-secrets controller installed; the shiplog DB secret exists in the gitops repo only as a `SealedSecret`, never as plaintext
- [ ] The Mission 03 CI workflow extended so a tagged release opens a real PR against the gitops repo bumping the dev image tag, verified end to end
- [ ] A deliberately bad release rolled back with `git revert`, ArgoCD syncing the cluster back automatically, with argo + git history as the only evidence needed
- [ ] All three break-fix drills solved by diagnosis
- [ ] Prove-it: a full journey — code change → CI release → auto PR into dev → promotion PRs into staging and prod — with zero `kubectl` used for any deploy step, evidenced entirely by `argo app history` and `git log`

## Start

Open a Claude Code session in this folder and say: `start devops/07`. Follow GUIDE.md.
