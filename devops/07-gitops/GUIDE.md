# Mission 07 Guide — GitOps

This guide is not a script to paste blindly. Read each phase, run the commands, and actually look at the output before moving on — every phase ends in a checkpoint that proves you understand what happened, not just that a command exited zero.

## Starting point

You're carrying two things forward: the shiplog Helm chart you authored in Mission 05 (`chart/` with its `values-dev.yaml`/`values-staging.yaml`/`values-prod.yaml`, an HPA, a PDB, and a Postgres StatefulSet), and the CI pipeline from Mission 03 (`ci.yml` building and pushing `ghcr.io/<owner>/shiplog`, `release.yml` cutting a GitHub release on every `vX.Y.Z` tag). Confirm both are still in working order:

```bash
helm lint chart/
```
Expected output: `1 chart(s) linted, 0 chart(s) failed.`

```bash
gh workflow list
```
Expected output: `CI` and `Release` both listed as `active`.

```bash
kind get clusters
kubectl get ns
```
Expected output: your kind cluster listed, and namespaces `shiplog-dev`, `shiplog-staging`, `shiplog-prod` present from Mission 05 (recreate them now if you tore the cluster down between missions — this guide assumes they exist).

**A second git repo.** Everything in this mission lives in a repo that is *not* the shiplog application repo. Create `shiplog-gitops` now (locally and on GitHub, pushed, empty except a `README.md`) — the application repo holds source code and the Dockerfile; this new repo holds nothing but Kubernetes/Helm manifests and values. That separation is the entire point of GitOps: the thing ArgoCD watches is not the thing CI builds.

```bash
gh repo create <owner>/shiplog-gitops --private --clone
cd shiplog-gitops
```
Expected output: a fresh local clone, `origin` pointing at `github.com/<owner>/shiplog-gitops`.

---

## Phase 1 — gitops repo layout

One chart, reused unmodified, plus one values file per environment. No copy-pasted templates, no per-environment forks of `deployment.yaml` — exactly the argument Mission 05 made for Helm, now applied across repos instead of just across `--set` flags.

```
shiplog-gitops/
├── apps/
│   └── shiplog/
│       ├── base/                    # the Mission 05 chart, verbatim
│       │   ├── Chart.yaml
│       │   ├── values.yaml
│       │   └── templates/
│       │       ├── _helpers.tpl
│       │       ├── deployment.yaml
│       │       ├── service.yaml
│       │       ├── ingress.yaml
│       │       ├── secret.yaml
│       │       ├── hpa.yaml
│       │       ├── pdb.yaml
│       │       └── tests/
│       │           └── test-connection.yaml
│       └── envs/
│           ├── dev/
│           │   └── values.yaml      # was values-dev.yaml in Mission 05
│           ├── staging/
│           │   └── values.yaml      # was values-staging.yaml
│           └── prod/
│               └── values.yaml      # was values-prod.yaml
└── argocd/
    ├── root.yaml                    # app-of-apps, Phase 3
    ├── shiplog-dev.yaml             # Phase 2
    ├── shiplog-staging.yaml         # Phase 3
    └── shiplog-prod.yaml            # Phase 3
```

Copy the chart across, unmodified:

```bash
cp -r ../shiplog/chart/. apps/shiplog/base/
mkdir -p apps/shiplog/envs/dev apps/shiplog/envs/staging apps/shiplog/envs/prod
cp ../shiplog/chart/values-dev.yaml apps/shiplog/envs/dev/values.yaml
cp ../shiplog/chart/values-staging.yaml apps/shiplog/envs/staging/values.yaml
cp ../shiplog/chart/values-prod.yaml apps/shiplog/envs/prod/values.yaml
```

Confirm the chart still renders identically from its new home before you commit anything:

```bash
helm template apps/shiplog/base -f apps/shiplog/envs/dev/values.yaml | head -20
```
Expected output: a rendered Deployment with `replicas: 1` (dev's replica count from Mission 05) — proof the move didn't break template resolution.

**Checkpoint:**
```bash
git add apps/
git commit -m "gitops: import shiplog chart and per-env values from mission 05"
git push
```
Expected output: the push succeeds, and `apps/shiplog/base/templates/` on GitHub shows the exact same templates you wrote in Mission 05 — this repo now holds a complete, independent copy of "how shiplog gets deployed," decoupled from the application repo entirely.

---

## Phase 2 — ArgoCD on kind, CLI login, first Application

Install the standard (non-HA) manifests — plenty for a kind lab cluster:

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd rollout status deploy/argocd-server --timeout=180s
```
Expected output: `deployment "argocd-server" successfully rolled out`.

Port-forward the API/UI (leave this running in its own terminal):

```bash
kubectl -n argocd port-forward svc/argocd-server 8080:443
```

Grab the auto-generated admin password and log in with the CLI:

```bash
argocd admin initial-password -n argocd
argocd login localhost:8080 --username admin --password <password-from-above> --insecure
```
Expected output: `'admin' logged in successfully` and `Context 'localhost:8080' updated`.

Open `https://localhost:8080` in a browser, accept the self-signed cert warning, and log in with the same credentials — you'll use both the UI and the CLI throughout this mission; neither is optional, they show different things (the UI's resource tree is the fastest way to see *what* ArgoCD manages, the CLI is what you script and screen-record).

**First Application, pointing at dev.** This one is manual-sync on purpose — you're proving the mechanism works before you hand it automation:

`argocd/shiplog-dev.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shiplog-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  sources:
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      path: apps/shiplog/base
      helm:
        releaseName: shiplog-dev
        valueFiles:
          - $values/apps/shiplog/envs/dev/values.yaml
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: shiplog-dev
  syncOptions:
    - CreateNamespace=true
```

This is a **multi-source Application**: the first source is the chart itself (`apps/shiplog/base`), the second source is a bare reference (`ref: values`) to the same repo used purely so the first source's `valueFiles` can point *outside* the chart directory with `$values/...`. Without the second source, `valueFiles` can only resolve paths inside `apps/shiplog/base` — and duplicating the chart per environment is exactly what Helm was supposed to stop you from doing.

```bash
kubectl apply -f argocd/shiplog-dev.yaml -n argocd
argocd app sync shiplog-dev
```
Expected output: a stream of resources being created (`Deployment`, `Service`, `Ingress`, `Secret`, `HorizontalPodAutoscaler`, `PodDisruptionBudget`), ending `Name: shiplog-dev ... Sync Status: Synced ... Health Status: Healthy`.

**Checkpoint:**
```bash
argocd app get shiplog-dev
kubectl get pods -n shiplog-dev
```
Expected output: `argocd app get` reports `Synced` / `Healthy`; `kubectl get pods` shows shiplog's pods `Running` and `1/1 Ready` in `shiplog-dev` — deployed without a single `helm install` or `kubectl apply -f deployment.yaml` typed by you. ArgoCD did the applying; you did the `git push`.

---

## Phase 3 — app-of-apps: one root Application manages all three

Right now you'd need to hand-apply three more Application manifests (staging, prod, and re-applying dev after any change to its own YAML). The app-of-apps pattern turns "apply N Application manifests" into "apply one root Application whose job is managing the other N."

`argocd/shiplog-staging.yaml` and `argocd/shiplog-prod.yaml` — same shape as dev, different `metadata.name`, `destination.namespace`, and `valueFiles` target:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shiplog-staging
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  sources:
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      path: apps/shiplog/base
      helm:
        releaseName: shiplog-staging
        valueFiles:
          - $values/apps/shiplog/envs/staging/values.yaml
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: shiplog-staging
  syncOptions:
    - CreateNamespace=true
```

(Copy this for `shiplog-prod.yaml`, swapping every `staging` for `prod`.)

`argocd/root.yaml` — the app-of-apps root, watching the `argocd/` directory itself and excluding its own manifest so it doesn't try to manage itself:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/<owner>/shiplog-gitops.git
    targetRevision: main
    path: argocd
    directory:
      recurse: false
      exclude: root.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Commit everything, then apply only `root.yaml` by hand — this is the last manifest you ever `kubectl apply` yourself in this mission:

```bash
git add argocd/
git commit -m "gitops: app-of-apps root managing dev/staging/prod"
git push
kubectl apply -f argocd/root.yaml -n argocd
```
Expected output: `application.argoproj.io/root created`.

**Checkpoint:**
```bash
argocd app list
```
Expected output: four rows — `root`, `shiplog-dev`, `shiplog-staging`, `shiplog-prod` — all `Synced`/`Healthy`. `root` created `shiplog-staging` and `shiplog-prod` for you from the manifests sitting in `argocd/`; you never ran `kubectl apply -f argocd/shiplog-staging.yaml` directly. From here on, adding a fourth environment means adding a fourth YAML file to `argocd/` and pushing — `root`'s `automated` sync picks it up on its own.

---

## Phase 4 — sync policies: auto for dev, manual for prod, and proving self-heal

Right now all three child Applications sync manually (they inherited no `syncPolicy` from Phase 2/3 — only `root` itself is automated). Fix that deliberately, per environment, because "auto-sync everywhere" is exactly the mistake that turns a bad prod values change into an unattended prod rollout.

Edit `argocd/shiplog-dev.yaml` and `argocd/shiplog-staging.yaml`, adding to `spec`:

```yaml
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Leave `argocd/shiplog-prod.yaml` with no `syncPolicy.automated` block at all — prod stays sync-manual, meaning a merged change to `apps/shiplog/envs/prod/values.yaml` sits `OutOfSync` until someone explicitly runs `argocd app sync shiplog-prod`.

```bash
git add argocd/shiplog-dev.yaml argocd/shiplog-staging.yaml
git commit -m "gitops: auto-sync dev and staging, keep prod manual"
git push
```
`root`'s own `automated` sync (Phase 3) notices this change to the Application manifests within a few minutes, or force it immediately:
```bash
argocd app sync root
```

**Prune + self-heal demo.** Delete a live Deployment out from under ArgoCD and watch it come back without you touching it again:

```bash
kubectl delete deployment shiplog-dev -n shiplog-dev
argocd app get shiplog-dev --hard-refresh
kubectl get deployment -n shiplog-dev -w
```
Expected output: for a moment `kubectl get deployment` returns nothing, `argocd app get` reports the app `OutOfSync` (missing resource); within seconds the `--hard-refresh` triggers reconciliation, `selfHeal: true` fires, and the Deployment reappears — pods go `ContainerCreating` → `Running` again, with no `kubectl apply` or `helm install` from you. Ctrl+C the watch once you see it back.

**Checkpoint:** you can point at `argocd app get shiplog-dev` showing `Synced`/`Healthy` again and state, from having watched it happen, what `selfHeal: true` actually did differently than a plain `automated` sync would have (`automated` alone reacts to *git* changes; `selfHeal` additionally reacts to *live cluster* drift away from git, which is what just happened here — nobody touched git, the Deployment was deleted directly against the cluster).

---

## Phase 5 — sealed-secrets and the kubeseal workflow

The chart's `templates/secret.yaml` from Mission 05 renders a plaintext `Secret` straight from `.Values.postgres.password` — fine for a lab, disqualifying for a git repo you ever intend to make shareable. Replace it with a `SealedSecret` that's safe to commit because only the cluster's controller (holding the private key) can ever decrypt it.

**Install the controller:**

```bash
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/controller.yaml
kubectl -n kube-system rollout status deploy/sealed-secrets-controller
```
Expected output: `deployment "sealed-secrets-controller" successfully rolled out`.

**Install the `kubeseal` CLI** (Linux example; grab the matching asset for your OS from the [releases page](https://github.com/bitnami-labs/sealed-secrets/releases) if you're not on Linux):

```bash
curl -Lo kubeseal.tar.gz https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/kubeseal-0.27.3-linux-amd64.tar.gz
tar -xvzf kubeseal.tar.gz kubeseal
sudo install -m 755 kubeseal /usr/local/bin/kubeseal
kubeseal --version
```
Expected output: a version string matching the controller (`0.27.3`).

**Stop the chart from templating its own Secret.** Guard `apps/shiplog/base/templates/secret.yaml` behind a new values flag:

```yaml
{{- if not .Values.externalSecret }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "shiplog.fullname" . }}-secret
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
type: Opaque
stringData:
  DATABASE_URL: "postgresql://shiplog:{{ required "postgres.password must be set — no default is safe here" .Values.postgres.password }}@{{ .Release.Name }}-postgres.{{ .Release.Namespace }}.svc.cluster.local:5432/shiplog"
  LOG_LEVEL: {{ .Values.logLevel | default "info" | quote }}
{{- end }}
```

Add the flag to `apps/shiplog/base/values.yaml`, default `false` (nothing changes for anyone who hasn't opted in):

```yaml
externalSecret: false
```

Set it `true` in `apps/shiplog/envs/dev/values.yaml` — dev's DB secret will now come from a `SealedSecret` committed alongside it, not from `postgres.password` in this file. Delete the `postgres.password` line from `envs/dev/values.yaml` entirely; it's dead weight once `externalSecret: true` skips the template that reads it.

**Seal the real secret, client-side, without ever writing plaintext to disk in this repo:**

```bash
kubectl create secret generic shiplog-dev-secret -n shiplog-dev \
  --dry-run=client \
  --from-literal=DATABASE_URL='postgresql://shiplog:a-real-password-here@shiplog-dev-postgres.shiplog-dev.svc.cluster.local:5432/shiplog' \
  --from-literal=LOG_LEVEL='info' \
  -o yaml > /tmp/shiplog-dev-secret-plain.yaml

kubeseal --controller-namespace kube-system --controller-name sealed-secrets-controller \
  --format yaml < /tmp/shiplog-dev-secret-plain.yaml > apps/shiplog/envs/dev/sealed-secret.yaml

rm /tmp/shiplog-dev-secret-plain.yaml
```
Expected output: `apps/shiplog/envs/dev/sealed-secret.yaml` contains `kind: SealedSecret` with an `encryptedData` block of base64 ciphertext — no plaintext password anywhere in the file. The name (`shiplog-dev-secret`) and namespace (`shiplog-dev`) baked into that manifest matter: `kubeseal`'s default scope binds the ciphertext to exactly that name *and* namespace, so this file only ever decrypts into `shiplog-dev-secret` inside `shiplog-dev` — copying it to another namespace or renaming it produces a `SealedSecret` the controller refuses to unseal (this is Break-fix Drill 2 below).

Wire the SealedSecret into ArgoCD's dev Application as a plain-manifest resource alongside the Helm source — add a third entry to `argocd/shiplog-dev.yaml`'s `sources`:

```yaml
    - repoURL: https://github.com/<owner>/shiplog-gitops.git
      targetRevision: main
      path: apps/shiplog/envs/dev
      directory:
        include: "sealed-secret.yaml"
```

Commit and let dev's auto-sync pick it up:

```bash
git add apps/shiplog/base/templates/secret.yaml apps/shiplog/base/values.yaml \
        apps/shiplog/envs/dev/values.yaml apps/shiplog/envs/dev/sealed-secret.yaml \
        argocd/shiplog-dev.yaml
git commit -m "gitops(dev): replace templated Secret with sealed-secrets"
git push
```

**Checkpoint:**
```bash
kubectl get sealedsecret -n shiplog-dev
kubectl get secret shiplog-dev-secret -n shiplog-dev -o jsonpath='{.data.DATABASE_URL}' | base64 -d
argocd app get shiplog-dev
```
Expected output: the `SealedSecret` object exists, the controller has decrypted it into a real `Secret` named `shiplog-dev-secret` whose `DATABASE_URL` matches what you sealed, and `argocd app get shiplog-dev` still reports `Synced`/`Healthy` — the chart's Deployment reads the same secret name it always did, it just no longer comes from a value in git.

---

## Phase 6 — CI-driven image bumps: release → auto PR → promotion PRs

This is where Mission 03's pipeline stops being "build and push an image" and starts being "build, push, and propose the deploy." Nobody — not even a workflow with `GITHUB_TOKEN` — pushes straight to `main` on the gitops repo. Every image bump is a PR.

**A cross-repo token.** `GITHUB_TOKEN` is scoped to the repo the workflow runs in (shiplog's app repo) and cannot open a PR against `shiplog-gitops`. Create a fine-grained PAT scoped to `shiplog-gitops` only (`Contents: Read and write`, `Pull requests: Read and write`), then store it as a secret in the **app repo** (the one running the workflow):

```bash
gh secret set GITOPS_PAT --repo <owner>/shiplog --body "<the-fine-grained-PAT>"
```
Expected output: `gh secret list --repo <owner>/shiplog` shows `GITOPS_PAT` with an `Updated` timestamp.

**Extend `release.yml`** (the Mission 03 workflow that already fires on `vX.Y.Z` tags) with a second job that checks out the gitops repo, bumps dev's image tag with `yq`, and opens a PR:

```yaml
  gitops-bump-dev:
    needs: release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout gitops repo
        uses: actions/checkout@v4
        with:
          repository: <owner>/shiplog-gitops
          token: ${{ secrets.GITOPS_PAT }}
          path: gitops

      - name: Install yq
        uses: mikefarah/yq@v4.44.3

      - name: Bump dev image tag
        working-directory: gitops
        env:
          IMAGE_TAG: ${{ github.ref_name }}
        run: |
          yq -i '.image.tag = strenv(IMAGE_TAG)' apps/shiplog/envs/dev/values.yaml
          cat apps/shiplog/envs/dev/values.yaml

      - name: Open PR against gitops repo
        uses: peter-evans/create-pull-request@v7
        with:
          token: ${{ secrets.GITOPS_PAT }}
          path: gitops
          commit-message: "chore(dev): bump shiplog image to ${{ github.ref_name }}"
          branch: bump-dev-${{ github.ref_name }}
          title: "Bump dev image to ${{ github.ref_name }}"
          body: |
            Automated bump from the release workflow.
            Image: `ghcr.io/${{ github.repository_owner }}/shiplog:${{ github.ref_name }}`
          base: main
```

`strenv(IMAGE_TAG)` reads the `IMAGE_TAG` env var as a string inside the `yq` expression — this is `yq`'s answer to safely interpolating a shell variable into a YAML edit without accidentally letting `${{ github.ref_name }}` land unescaped inside the expression string itself.

Commit this to the **app repo's** `release.yml`, then cut a real tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

**Checkpoint:**
```bash
gh pr list --repo <owner>/shiplog-gitops
```
Expected output: an open PR titled `Bump dev image to v0.2.0`, with a diff touching exactly one line — `apps/shiplog/envs/dev/values.yaml`'s `image.tag`. Review and merge it:
```bash
gh pr merge bump-dev-v0.2.0 --repo <owner>/shiplog-gitops --squash
```
Dev's `automated` sync (Phase 4) picks up the merge on its own — confirm with `argocd app get shiplog-dev` showing the new tag in its synced revision, no `kubectl` or `helm` involved.

**Promotion = a PR, not a pipeline.** Once dev has run the new tag long enough to trust it, promoting to staging is copying the *proven* tag from dev's values into staging's — nothing more:

```bash
git checkout -b promote-staging-v0.2.0
yq -i '.image.tag = load("apps/shiplog/envs/dev/values.yaml").image.tag' apps/shiplog/envs/staging/values.yaml
git add apps/shiplog/envs/staging/values.yaml
git commit -m "promote: staging to $(yq '.image.tag' apps/shiplog/envs/dev/values.yaml)"
git push -u origin promote-staging-v0.2.0
gh pr create --title "Promote staging to v0.2.0" --body "Promoting the tag validated in dev." --base main
```

Staging's `automated` sync applies it the moment that PR merges. Repeat the exact same pattern — a new branch, the same `yq load(...)` line pointed at `envs/prod/values.yaml`, a PR — to promote to prod. Prod stays `syncPolicy`-manual (Phase 4), so merging that PR only makes prod `OutOfSync`; someone still has to run `argocd app sync shiplog-prod` deliberately.

**Checkpoint:** `git log --oneline -- apps/shiplog/envs/dev/values.yaml apps/shiplog/envs/staging/values.yaml apps/shiplog/envs/prod/values.yaml` shows three separate, human-reviewed commits — one automated (dev), two promotion PRs (staging, prod) — and every one of them is a PR merge, never a direct push.

---

## Phase 7 — sync waves and a PreSync database-migration hook

shiplog's Postgres schema needs migrations run *before* the new app pods start talking to it, not after. Argo runs `PreSync` hooks before the rest of the sync, and `sync-wave` orders resources within a phase — combine both so the migration Job finishes before the Deployment even begins rolling.

`apps/shiplog/base/templates/db-migrate-job.yaml`:

```yaml
{{- if .Values.migration.enabled }}
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "shiplog.fullname" . }}-db-migrate-{{ .Values.image.tag | trunc 12 }}
  labels:
    {{- include "shiplog.labels" . | nindent 4 }}
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
    argocd.argoproj.io/sync-wave: "-1"
spec:
  backoffLimit: 2
  template:
    metadata:
      labels:
        {{- include "shiplog.selectorLabels" . | nindent 8 }}
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          command: ["python", "-m", "alembic", "upgrade", "head"]
          envFrom:
            - secretRef:
                name: {{ include "shiplog.fullname" . }}-secret
{{- end }}
```

Add the flag to `apps/shiplog/base/values.yaml`:

```yaml
migration:
  enabled: true
```

The `-{{ .Values.image.tag | trunc 12 }}` suffix on the Job's name matters: Kubernetes Jobs are immutable, so reusing the same name across two releases with two different image tags would fail to apply the second time. Baking the tag into the name gives every release its own Job, and `hook-delete-policy: HookSucceeded` cleans up the previous one once it's done its job.

```bash
git add apps/shiplog/base/templates/db-migrate-job.yaml apps/shiplog/base/values.yaml
git commit -m "gitops: PreSync db-migration hook, sync-wave -1"
git push
argocd app sync shiplog-dev
```

**Checkpoint:**
```bash
argocd app history shiplog-dev
kubectl get jobs -n shiplog-dev
```
Expected output: `argocd app history` shows a new sync entry, and watching `argocd app sync shiplog-dev` live (or the UI's resource tree) shows the migration Job's pod complete (`Completed`) *before* the Deployment's new ReplicaSet's pods go `Running` — the `PreSync` phase gate, not luck, is what enforced that order. If the Job fails, the whole sync stops there and the Deployment never gets touched — exactly the point of a pre-flight migration gate.

---

## Phase 8 — rollback: a bad release, `git revert`, and self-heal syncing it back

**Ship something broken to dev on purpose.** Bump dev's tag to one that crashes on boot (any tag whose image doesn't exist, or a real tag where you've temporarily broken the app's startup command — pick whichever you can reproduce):

```bash
yq -i '.image.tag = "v0.2.0-broken"' apps/shiplog/envs/dev/values.yaml
git add apps/shiplog/envs/dev/values.yaml
git commit -m "chore(dev): bump to v0.2.0-broken"
git push
```
Expected output: within moments, dev's `automated` sync applies it, and `kubectl get pods -n shiplog-dev` shows `ImagePullBackOff` or `CrashLoopBackOff` — a real bad deploy, driven entirely by git, with zero `kubectl` on your part.

**Roll it back the GitOps way:**

```bash
git log --oneline -3
git revert --no-edit <the-broken-commit-sha>
git push
```
Expected output: dev's `automated` sync (or a `--hard-refresh` if you don't want to wait for the poll interval) applies the revert commit and the Deployment rolls back to the last-known-good tag on its own.

**Checkpoint:**
```bash
argocd app history shiplog-dev
kubectl get pods -n shiplog-dev
git log --oneline -3
```
Expected output: `argocd app history` shows two consecutive sync revisions — the broken one, then the revert — matching two consecutive `git log` commits; pods are back to `Running`/`Ready`. Everything you'd need to explain "what happened and how it got fixed" is sitting in these two commands, nothing lives only in your memory of what you clicked.

**Written note — `git revert` vs. `kubectl rollout undo`:** `kubectl rollout undo` works directly against the Deployment's own revision history stored in-cluster (via ReplicaSet annotations) — fast, but it changes nothing in git. On a `selfHeal: true` Application like dev, that's actively dangerous: the moment ArgoCD's next reconciliation runs, it sees the live Deployment no longer matches what git says (git still says the broken tag), and self-heal *reverts your manual rollback back to the broken state* — you'd be fighting your own automation. `git revert` fixes the actual source of truth, so self-heal enforces the correction instead of undoing it. The lesson generalizes past this one command: on a GitOps-managed environment, any fix that isn't a git commit is a fix that self-heal will eventually erase.

---

## Break-fix drills

Do these for real — break it, watch it fail, diagnose with the tools above, fix it, confirm the fix. No solutions given on purpose.

### Drill 1 — app stuck `OutOfSync` in an endless loop

<details>
<summary>Setup</summary>

Dev's shiplog Deployment carries the HPA you built in Mission 05. Generate load against it (the k6 script from Mission 05 works) so the HPA scales `spec.replicas` away from whatever `replicaCount` is committed in `apps/shiplog/envs/dev/values.yaml`. Watch `argocd app get shiplog-dev` and `kubectl get hpa -n shiplog-dev` at the same time.
</details>

Expected symptom: `shiplog-dev` flips between `Synced` and `OutOfSync` repeatedly, never settling, and `kubectl get deployment shiplog-dev -n shiplog-dev -o jsonpath='{.spec.replicas}'` keeps changing even though nobody edited `values.yaml` — `selfHeal: true` is fighting the HPA, resetting `replicas` back to the committed value every time the HPA scales it away, and the HPA scales it right back.

<details>
<summary>Hint</summary>
This is a documented, common ArgoCD failure mode — a controller other than ArgoCD (here, the HPA; in other shops, a mutating webhook or an in-cluster defaulting controller) legitimately owns a field that ArgoCD is also diffing against git. The fix isn't disabling `selfHeal` — it's telling ArgoCD's diff engine to stop caring about that one field on that one resource kind. Look at the `Application` spec's `spec.ignoreDifferences` block: a `group`/`kind` selector plus a `jsonPointers` (or `jqPathExpressions`) entry targeting `/spec/replicas` on the Deployment stops the false diff without touching the HPA's ability to scale anything.
</details>

### Drill 2 — a sealed secret won't decrypt

<details>
<summary>Setup</summary>

Copy `apps/shiplog/envs/dev/sealed-secret.yaml` to a new file for staging, changing only `metadata.namespace` (and maybe `metadata.name`) to staging's values, without re-running `kubeseal`. Wire it into `argocd/shiplog-staging.yaml` the same way dev's is wired in, commit, push, sync.
</details>

Expected symptom: the `SealedSecret` object exists in `shiplog-staging`, but no corresponding `Secret` ever appears — `kubectl get secret -n shiplog-staging` never shows it, and the app's pods sit in `CrashLoopBackOff` on a missing/empty env var.

<details>
<summary>Hint</summary>
Check the controller's own logs (`kubectl logs -n kube-system deploy/sealed-secrets-controller`) and `kubectl describe sealedsecret <name> -n shiplog-staging` for events — the controller will tell you plainly that it couldn't unseal the data. `kubeseal`'s default scope (`strict`) encrypts the namespace and name into the ciphertext itself as part of the AAD (additional authenticated data), specifically so a `SealedSecret` can't be copy-pasted into a different namespace or renamed and still decrypt — that's a security feature, not a bug. The fix is re-running the actual `kubeseal` command against the real plaintext, targeted at staging's namespace and secret name, not editing YAML fields on an already-sealed file.
</details>

### Drill 3 — an Application deleted with cascade

<details>
<summary>Setup</summary>

```bash
argocd app delete shiplog-staging --cascade
```
</details>

Expected symptom: not just the `Application` object disappears — every resource it managed in `shiplog-staging` (Deployment, Service, Ingress, HPA, PDB, the synced `Secret` from its `SealedSecret`) is deleted too, because cascade delete prunes everything the Application owns before removing the Application itself. `kubectl get all -n shiplog-staging` comes back nearly empty.

<details>
<summary>Hint</summary>
First, be precise about what actually died: the *Application object* and every *live cluster resource* it was managing. What did **not** die: the `argocd/shiplog-staging.yaml` manifest sitting in your gitops repo, or the `apps/shiplog/envs/staging/` values and sealed secret — none of that was ever inside the cluster, it's still in git exactly as committed. Recovery is therefore not "reconstruct staging from memory," it's "the root app-of-apps (Phase 3) is `automated`, so the moment it reconciles it notices `argocd/shiplog-staging.yaml` is still declared and no longer has a matching `Application` object, and recreates it" — force that reconciliation rather than waiting, and watch the newly recreated `Application` sync the whole environment back from the exact same git state that was there before. If you'd deleted `root` too, the fix is `kubectl apply -f argocd/root.yaml -n argocd` once, by hand — still not `kubectl apply` on any of shiplog's own resources.
</details>

---

## Prove-it: the full journey, zero `kubectl`

Starting from a real code change in the shiplog **application** repo, demonstrate the entire path to prod with `kubectl` never once used to deploy, scale, or edit any shiplog resource:

1. Make a real code change in `devops/shiplog` (a small, visible one — a version string, a new field on `/healthz`'s response). Commit, push, merge through the Mission 03 pipeline (tests + scan + build-push all green).
2. Tag a release (`vX.Y.Z`). Show `release.yml` firing, the GitHub release appearing, and Phase 6's `gitops-bump-dev` job opening a PR against `shiplog-gitops`.
3. Merge that PR. Show dev's `automated` sync picking up the new tag with zero manual sync command.
4. Open and merge the staging promotion PR (Phase 6's `yq load(...)` pattern). Show staging's `automated` sync applying it.
5. Open and merge the prod promotion PR. Since prod is sync-manual (Phase 4), run `argocd app sync shiplog-prod` — this is the one ArgoCD *command* allowed in the whole journey, and it's still not `kubectl`.

Acceptance criteria: every step above is evidenced by exactly two sources — `argocd app history <name>` for each of the three environments, and `git log` (app repo + gitops repo) — with no other tool or memory required to reconstruct what happened. If proving any step required you to run `kubectl apply`, `kubectl edit`, `kubectl scale`, `kubectl set image`, or `helm install`/`upgrade` directly against a shiplog resource, that step isn't done — find the gap and close it before you call this finished.

---

## Done when

- [ ] `shiplog-gitops` repo exists with `apps/shiplog/{base,envs/dev,envs/staging,envs/prod}`, the Mission 05 chart copied in unmodified, and per-environment values files
- [ ] ArgoCD installed on the kind cluster; UI and CLI login both work
- [ ] An app-of-apps `root` Application manages `shiplog-dev`, `shiplog-staging`, and `shiplog-prod` — only `root.yaml` was ever `kubectl apply`-ed by hand
- [ ] Dev and staging are `syncPolicy.automated` with `prune`/`selfHeal`; prod is sync-manual; self-heal demonstrated live by deleting a Deployment and watching it return
- [ ] sealed-secrets controller installed; dev's DB secret exists in git only as a `SealedSecret`, decrypts correctly, and the chart's own templated Secret is skipped via `externalSecret: true`
- [ ] `release.yml` extended so a tagged release opens a real PR against the gitops repo bumping dev's image tag (`yq` + `peter-evans/create-pull-request`), proven with a real tag push
- [ ] Staging and prod promotions demonstrated as PRs copying a proven tag forward, not as separate deploy tooling
- [ ] A `PreSync` db-migration Job with `sync-wave: "-1"` proven to complete before the app Deployment rolls
- [ ] A deliberately bad dev release rolled back via `git revert`, ArgoCD syncing the fix back automatically, plus the written `git revert` vs. `kubectl rollout undo` comparison
- [ ] All three break-fix drills solved by diagnosis, hints unopened until stuck
- [ ] Prove-it: the full code-change → release → auto-PR → promotion journey completed with zero `kubectl` used to deploy, scale, or edit any shiplog resource, evidenced entirely by `argocd app history` and `git log`
