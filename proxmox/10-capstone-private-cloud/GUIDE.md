# Guide — Mission 10: Capstone: Private Cloud

**Guides are closed for this mission.** There is no Phase 1 / Phase 2 walkthrough below, and there is no hints section at the bottom. You have already built a self-hosted runner (devops/03), written Terraform against this exact cluster with this exact token (proxmox/03), segmented lab networking with SDN (proxmox/07), stood up a k3s cluster on Proxmox (proxmox/08), wired monitoring into it (proxmox/09), and handed deployment authority to ArgoCD with CI-opened PRs (devops/07). Everything this capstone needs is a recombination of those artifacts, not a new technology. What follows is a requirements spec and an acceptance checklist — how you assemble the pieces is yours to decide, the same way it would be if a real team asked you to build this.

## Ground rules

- This runs on the real cluster, under the safety contract in `proxmox/README.md` — the `learning` pool, VMIDs `9000-9999`, `vmbr-lab`, the `learn@pve!tf` token, the `learning` tag on everything. Nothing about "capstone" suspends that contract.
- Reuse, don't recreate. The Terraform provider config, modules, and state discipline from proxmox/03; the runner registration from devops/03; the ArgoCD app-of-apps and CI-opens-PR pattern from devops/07 — pull these forward. Rebuilding any of them from scratch is time spent proving you can copy a guide, not time spent proving you built a platform.
- Log a start time and a finish time. Target: 2-3 burst days, not one continuous sitting — this mission has a scheduled workflow in it (auto-expiry) that needs real calendar time to prove itself, not just wall-clock hours.
- The two request paths (VM, namespace) share one pipeline shape: validate → plan → comment (PR) → apply → comment (merge). Build the shape once, conceptually, even though the two backends are different tools.

## Requirement 1 — Request format

Every infrastructure ask is a file under `requests/`, reviewed like code because it is code. Two schemas, two prefixes.

**`requests/vm-<name>.yaml`** — a VM request:

```yaml
name: web-demo          # must match the filename: requests/vm-web-demo.yaml
size: S                 # S | M | L — see mapping table below
image: tpl-ubuntu2404    # must reference a template that actually exists (VMID 9000, or a Packer-built descendant from proxmox/03)
owner: jdoe              # a real identity — GitHub username or company email, your call, but pick one and enforce it
expiry: 2026-08-15       # ISO date, required, must be in the future at PR-open time
```

Size maps to resources — no request specifies vCPU/RAM/disk directly, only a size letter:

| Size | vCPU | RAM | Disk |
|------|------|-----|------|
| S | 1 | 2 GB | 20 GB |
| M | 2 | 4 GB | 40 GB |
| L | 4 | 8 GB | 80 GB |

**`requests/ns-<name>.yaml`** — a namespace request:

```yaml
namespace: team-reporting   # must match the filename: requests/ns-team-reporting.yaml
cpu: "2"                    # quota, in Kubernetes CPU units (matches ResourceQuota's spec.hard["requests.cpu"] / limits.cpu)
memory: "4Gi"                # quota, matches ResourceQuota's spec.hard["requests.memory"] / limits.memory
owner: jdoe
```

Both schemas get validated by a machine, not eyeballed by a reviewer: a JSON Schema (or an equivalent `pydantic`/`cerberus` model, your call) checked in alongside the workflows, run as the first job in the PR pipeline. Malformed YAML, missing fields, or a `size` value outside `S`/`M`/`L` fails that job before Terraform is ever invoked.

## Requirement 2 — the pipeline

The self-hosted runner from devops/03 lives inside the lab network (same VLAN as `vmbr-lab`, or a segment SDN'd in Mission 07 that can reach both the Proxmox API and the k3s API server) — it is not a GitHub-hosted runner, because a GitHub-hosted runner has no route to a private cluster's API.

**On pull request** (any change under `requests/`):

1. Validate the changed file against its schema (Requirement 1) and against policy (Requirement 3 — naming, size, expiry).
2. If it's a `vm-*.yaml`, generate or update the corresponding Terraform resource (module call into the Mission 03 `modules/pve-vm` module, or its equivalent) and run `terraform plan`.
3. If it's an `ns-*.yaml`, render the `ResourceQuota` + `LimitRange` (+ `Namespace`) manifests from the request (Requirement 4) and produce a diff — `kubectl diff` against the live cluster, or a `git diff` against the last rendered version, either is acceptable as long as it shows a reviewer what will actually change.
4. Post the plan or diff back as a PR comment, automatically, before any human runs anything by hand. Update the same comment on new commits rather than piling up duplicates.

**On merge to main** (the PR closes via merge, touching `requests/`):

1. Apply — `terraform apply` for VM requests, `kubectl apply` (or a commit into the path ArgoCD watches, if you go the GitOps route for namespaces per Requirement 4) for namespace requests.
2. Post connection details back as a comment on the now-merged PR: for a VM, its IP and how to reach it (not secrets — a public key was already on the template); for a namespace, its name and its enforced quota, confirmed by actually querying the object that now exists, not just echoing back the request file's numbers.

## Requirement 3 — policy gates

- **Naming.** Enforce one convention (e.g. `^[a-z][a-z0-9-]{2,20}$` for both the `name`/`namespace` field and the part of the filename after the prefix) and make the filename and the in-file field agree — a mismatch is a validation failure, not a warning.
- **Expiry is mandatory**, on VM requests, full stop. No expiry field, no plan — the validation job fails before Terraform runs.
- **Size limits without human sign-off.** Pick a default ceiling (e.g. `S` and `M` apply automatically once a request passes validation and gets a normal merge); a request at the ceiling above that (`L`) requires a human-applied label — something like `size-approved` — before the apply job is allowed to run. Wire this as a required check: the merge-triggered apply job checks for the label and fails loudly (not silently skips) if an `L` request lacks it, and the PR-time plan job should already warn that approval is needed before anyone even considers merging.
- **Auto-expiry.** A separate, scheduled workflow (cron — daily is reasonable) reads every `requests/vm-*.yaml`, compares its `expiry` field to the current date, and for anything past due, opens a new PR that removes (or empties) that request file — a teardown PR, labeled distinctly (e.g. `auto-teardown`), with no human triggering it. Merging that PR runs the same apply job in reverse (`terraform destroy` on the now-absent resource, or however your Terraform is structured to interpret "entry removed from the map").

## Requirement 4 — the k8s namespace path

Same shape, different backend, targeting the Mission 08 k3s cluster. Two implementations are both acceptable — pick one and be able to explain why:

- **Direct.** The runner holds a scoped kubeconfig (a service account bound to exactly the permissions needed to create namespaces, `ResourceQuota`, and `LimitRange` objects — not cluster-admin) and the merge-triggered job runs `kubectl apply` directly against the cluster.
- **GitOps.** The merge-triggered job renders the `Namespace` + `ResourceQuota` + `LimitRange` manifests into a path in your Mission 07 GitOps repo that's already a child Application under the app-of-apps root, commits, and lets ArgoCD's own sync pick it up — no `kubectl apply` from the pipeline at all, consistent with the "git is the only place a deployment change is made" rule Mission 07 established.

Either way, the manifests are templated from the request file's `cpu`/`memory` fields, not hand-written per namespace — one Jinja/`envsubst`/Helm-values template, driven by data, the same discipline as Mission 03's `for_each` module.

## Requirement 5 — security notes

- **Network scope.** The runner is registered with a label that marks it lab-only (e.g. `self-hosted, lab`) and its host has no route to anything outside the lab segment — no path to a production VLAN, no path to any node or service that isn't part of this track's `learning` footprint. If you can't state, from the runner's own network config, exactly what it can and can't reach, that's not proven yet.
- **Secrets.** Every credential the pipeline needs — the Proxmox API token secret, the scoped kubeconfig — lives in a GitHub Environment (not a bare repo secret), the same mechanism Mission 03 used for `staging`/`prod` gating. Scope the Environment to the workflow(s) that actually need it.
- **Least privilege, no exceptions.** The Proxmox token this pipeline uses is the exact `learn@pve!tf` token from Mission 01, carrying exactly `LearningRole`'s privileges (extended only the way Mission 03 extended it — one named privilege at a time, granted on the specific ACL path that needs it). This capstone does not mint a broader token "to make the pipeline easier." If the pipeline needs a privilege that role doesn't have, that's a `pveum role modify`, logged and deliberate, not a shortcut to `Administrator`.

## Acceptance checklist

Run these against your own pipeline, on the real cluster. Every item must produce the stated result.

1. A `requests/vm-<name>.yaml` request at size `S` merges, and a real, running VM exists — in the `learning` pool, tagged `learning`, VMID inside `9000-9999` — in under 10 minutes from merge.
2. Opening that same PR, before anyone merges anything, already shows a `terraform plan` posted as an automatic PR comment.
3. A request at size `L` opened without the approval label is blocked — the merge-triggered apply job fails the check or the PR cannot be merged, and the failure names the missing label, not a generic error.
4. The same `L` request, once a human adds the approval label, merges and applies cleanly.
5. A request with a naming violation (mismatched filename/field, disallowed characters) is rejected by the validation job on the PR, with a comment identifying the exact violation, before `terraform plan` ever runs.
6. A request missing the `expiry` field is rejected by the validation job before `terraform plan` ever runs.
7. An expired request auto-opens a teardown PR via the scheduled workflow, with no human triggering it.
8. Merging that teardown PR actually destroys the resource — confirmed against the cluster (`qm list`, not just Terraform's own state) — not merely removed from the request file.
9. A `requests/ns-<name>.yaml` request merges and produces a real namespace on the Mission 08 k3s cluster, with a `ResourceQuota` and `LimitRange` whose values match the request's `cpu`/`memory` fields exactly.
10. The namespace's quota is actually enforced — a pod or deployment that exceeds the `LimitRange` or pushes the namespace over its `ResourceQuota` is rejected by the API server itself, demonstrated live, not just asserted from the YAML.
11. The full audit trail for every object this pipeline ever created is git history alone — `git log` on `requests/` reconstructs who asked for what, when, and why, with no Slack message, verbal approval, or personal note required to fill a gap.
12. The runner's scope is provably lab-only: the Proxmox token it used is confirmed, via `pveum` on the cluster itself, to be the exact Mission 01 least-privilege token, and the runner's network config shows no route to anything outside the lab segment.
13. A change made outside the pipeline (a manual `qm set` or `kubectl edit` against a pipeline-managed object) shows up as drift the next time a PR touches that same resource — proving the pipeline, not hands-on-keyboard, is the actual source of truth going forward.
14. The one-page pitch writeup (below) exists, is fully filled in with real numbers from your own build, and is not a template with blanks left in it.
15. The demo was actually run for a colleague — a real person other than you watched a PR merge and a VM or namespace appear, in real time, and you can state one piece of feedback they gave.

## The pitch

This capstone is the portfolio artifact for this entire track — the thing you put in front of your actual team, not just a checklist you tick privately. Write one page, using this structure, filled with your own real numbers, and use it as the basis for the demo in item 15 above:

**What this replaces.** Name the manual process this pipeline stands in for — who used to get pinged, how a request used to travel (chat message, ticket, hallway conversation), how long it used to take from "I need a VM" to "I have a VM," and how that request used to be tracked (or not tracked at all). Be specific: not "manual VM provisioning was slow," but the actual sequence of steps you're replacing.

**What it cost to build.** Real hours, not an estimate — pull them from your own start/finish logs across proxmox/03, devops/03, devops/07, and this mission. State what already existed and got reused versus what was new work specific to this capstone, so a teammate evaluating "should we invest in this for real" can see the marginal cost of extending it versus the sunk cost of what you'd already built anyway.

**What it saves.** Time-to-provision, before and after, as a real measured number (this is acceptance item 1's under-10-minutes figure). Policy compliance that used to depend on someone remembering the rules and now depends on a machine checking them. An audit trail that used to live in someone's memory and now lives in `git log`. If you can attach any of this to a number your team already cares about (hours per request times requests per month, say), do it — but only with numbers you can actually defend if asked.

**Career note.** This one-pager and the working pipeline behind it are the artifact you show up with when you say "I built a self-service internal platform" in a review, an interview, or a promotion case. Write it like someone who doesn't already know this project will read it cold — because eventually, someone will.

## Done when

- [ ] All 15 acceptance checklist items pass, in order, against the real cluster
- [ ] Both request paths (VM, namespace) have been exercised end to end at least once each, including one deliberate policy-gate rejection per path
- [ ] The scheduled auto-expiry workflow has fired for real, on a request you deliberately let expire, and opened a teardown PR with no manual trigger
- [ ] The one-page pitch is written with real numbers, not placeholders
- [ ] The demo happened, for a real colleague, and their feedback is captured in a line or two
