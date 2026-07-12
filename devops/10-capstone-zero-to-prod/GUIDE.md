# Guide — Mission 10: Capstone: Zero-to-Prod

This is the capstone. **Guides are closed.** No phase-by-phase instructions below — you have already built every one of these pieces once, in Missions 01-09, in your own repos. This document states requirements and acceptance criteria only. Your own notes, your own Terraform/Helm/Ansible/CI artifacts from those missions, and standard tool documentation are fair game. A step-by-step walkthrough is not, because the entire point of this mission is finding out whether the previous nine actually taught you a platform or nine disconnected exercises.

## Rules

- Start from a genuinely empty directory. No copy-pasting whole configs from earlier missions — you may reuse and adapt patterns you already understand, but you write them fresh.
- Log your start time before you begin and your finish time when the acceptance checklist is fully green. Target: **8 hours or less**, in one focused session.
- `make bootstrap` and `make destroy` are mandatory entrypoints — a stranger should only ever need to run those two commands plus `git clone`.

## Requirements

**1. One-command bootstrap.** From the empty directory, `make bootstrap` must produce, unattended:
- A `kind` cluster (reuse your Mission 04 config pattern)
- ArgoCD installed into it, managing itself and everything else through an app-of-apps root Application (Mission 07 pattern) — after bootstrap, no component in the cluster should have been `kubectl apply`-ed by hand except the one root Application
- shiplog (Mission 02/05's Helm chart) deployed to a `dev` environment and fully `Synced`/`Healthy` in ArgoCD

**2. CI/CD on a fresh repo.** A new GitHub repository (not a fork of an earlier mission's repo) wired with:
- PR checks — test + scan, per Mission 03
- A release workflow that builds, scans, and publishes an image to a registry on tag push
- An automated GitOps tag-bump PR against your bootstrap repo's `dev` values, opened by CI on release (Mission 07's CI-to-GitOps bridge), which ArgoCD picks up and syncs with zero manual `kubectl` involvement

**3. Observability, deployed the GitOps way.** The Mission 08 stack (metrics, Tempo, Loki, Grafana) must be deployed as an ArgoCD-managed Application alongside shiplog — not a one-off `helm install` run by hand outside the GitOps flow. It must produce, and you must be able to show:
- A live RED dashboard for shiplog with real traffic on it
- A live SLO burn-rate alert (Mission 08's rules), provably wired to notify somewhere (even if that's a local webhook receiver for this exercise)

**4. Full teardown.** `make destroy` removes every piece of what `make bootstrap` created — cluster included. Prove idempotency: run `make destroy && make bootstrap` a second time and reach the identical working state with no manual cleanup in between.

**5. A README a stranger could run.** Assume the reader has the tool prerequisites installed (kind, kubectl, helm, terraform, argocd CLI, gh CLI) and nothing else — no context from you, no Slack messages, no "ask me if it breaks." If a step needs a secret or a token, the README says exactly where to get it and where to put it.

## Acceptance checklist

Run these in order against your own bootstrap. Every one must produce the stated result before you can call the capstone done.

1. `rm -rf *` in a scratch directory, confirm it's empty — `ls -la` shows nothing but `.` and `..`
2. `git clone <your-new-repo>` succeeds and `make bootstrap` runs with zero manual intervention
3. `kind get clusters` shows your cluster
4. `kubectl get pods -n argocd` — all Running
5. `argocd app list` shows a `root` Application plus its children (shiplog-dev, observability, etc.), all `Synced`/`Healthy`
6. `kubectl get pods -n shiplog` — all Running, and `curl` against the shiplog service returns a real response (not a connection error)
7. `git log -1` on your bootstrap repo shows the root Application was the only object ever committed and applied by hand — everything else arrived via ArgoCD sync
8. A code change pushed to your CI repo triggers: tests → scan → build → tagged release, with no manual step
9. The release automatically opens a PR against the bootstrap repo bumping the `dev` image tag
10. Merging that PR causes ArgoCD to sync the new image into the cluster within its configured sync interval, with no `kubectl apply` from you
11. `kubectl get pods -n observability` — Prometheus, Grafana, Tempo, Loki all Running, and all deployed as ArgoCD-managed Applications (`argocd app list` shows them, not `helm list` showing manual releases)
12. Grafana's RED dashboard for shiplog shows real, non-zero request data
13. The SLO burn-rate `PrometheusRule` exists and you can show it evaluating (Prometheus UI, Alerts tab) against real or synthetic traffic
14. `make destroy` removes the kind cluster — `kind get clusters` shows nothing afterward
15. A second `make bootstrap` immediately after `make destroy` reaches steps 3-13 again with identical results
16. The README, read cold with no other context, describes every prerequisite tool and every secret/token needed, with exact sourcing instructions for each
17. Total elapsed time from step 2 to step 13 first passing is logged and is ≤ 8 hours
18. `git log` on the CI repo and the bootstrap repo together forms a complete, readable audit trail of every change that reached the cluster
19. No component in the running cluster was ever touched by a bare `kubectl apply`, `kubectl edit`, or `kubectl patch` after initial bootstrap — verify by re-reading your own terminal history for the session
20. You can state, without checking anything, which of the 9 prior missions each piece of this capstone came from — if you can't, that piece wasn't actually learned, it was assembled

## Reflection

After the acceptance checklist is green, write a short `reflection.md`:

- What did you have to look up or re-derive that you expected to remember cold from Missions 01-09?
- Which piece took the longest, and was that time spent on genuine complexity or on friction that a reusable module/template would have removed?
- If you were to extract this capstone into a reusable "platform starter" template for the next project you build, what would go in it verbatim, and what would need to change per-project?

This reflection is the seed of a personal platform-template repo — a natural next step once this capstone is done, but out of scope for the capstone itself.

## Done when

- [ ] All 20 acceptance checklist items pass, in order, on a genuinely fresh clone
- [ ] Total time from empty directory to fully green checklist is logged and ≤ 8 hours (or honestly logged as over, with reflection on why)
- [ ] `reflection.md` is written and answers all three prompts above
- [ ] `make destroy` followed by `make bootstrap` reproduces the identical state with no manual intervention
