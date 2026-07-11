# Guide — Mission 03: CI/CD Forge

This mission builds one workflow file incrementally, phase by phase, on the shiplog repo from Mission 02 (`devops/shiplog/`, a FastAPI URL-shortener with a Postgres backend, image published to `ghcr.io`). Every phase adds a job or a block to the same `ci.yml`, so by Phase 3 you have a complete test → scan → build → push pipeline, and Phase 4 adds a second workflow for releases.

Machine tags used below: **[REPO]** = a shell in your local clone of `devops/shiplog` (bash or PowerShell, your choice — commands shown are POSIX but translate directly), **[GITHUB]** = the GitHub web UI or `gh` CLI acting on the repo, **[HOST]** = Windows PowerShell (admin) on your Hyper-V host, **[RUNNER-VM]** = bash inside the Ubuntu lab VM you build in Phase 5.

Replace `<owner>` in every command with your actual GitHub username or org, and `<repo>` with `shiplog` (or the full `devops-shiplog` name if you named the GitHub repo that way).

---

## Phase 0 — Setup check

**[REPO]** — confirm the shiplog repo from Mission 02 exists, is pushed to GitHub, and its test suite is green locally before you wire any of this into CI:

```bash
cd devops/shiplog
git remote -v
```

Expected: an `origin` line pointing at `https://github.com/<owner>/<repo>.git` (or the SSH equivalent) for both `fetch` and `push`. If this only exists locally, push it now — Actions needs a GitHub-hosted repo to run against.

**[REPO]** — confirm the app's test suite and Dockerfile are present:

```bash
ls requirements.txt Dockerfile tests/
```

Expected: `requirements.txt` and `Dockerfile` listed, and `tests/` shows at least one `test_*.py` file.

**[REPO]** — run the tests locally once, so you know a red CI run later means the pipeline caught something real, not a missing dependency:

```bash
pip install -r requirements.txt pytest
pytest -q
```

Expected: `N passed` with no failures.

**[GITHUB]** — confirm `gh` is authenticated against this repo:

```bash
gh auth status
gh repo view <owner>/<repo> --json name,visibility
```

Expected: `Logged in to github.com` and a JSON blob showing `"name": "<repo>"`. Note `"visibility"` — it must be `PRIVATE` for Phase 5's self-hosted runner to be safe (see the security note there).

**Checkpoint:** local tests pass, `origin` points at a real GitHub repo, `gh` is authenticated. Do not continue until all three are true.

---

## Phase 1 — Test job: pytest matrix + pip caching

**[REPO]** — create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip
          cache-dependency-path: requirements.txt

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run tests
        run: pytest -v --cov=app --cov-report=term-missing
```

`cache: pip` plus `cache-dependency-path` hashes `requirements.txt` and reuses the pip cache directory across runs whenever that hash hasn't changed — the matrix's two jobs each get their own cache key because `setup-python` folds `python-version` into it automatically.

**[REPO]** — commit and push on a branch, then open a PR:

```bash
git checkout -b ci/pipeline
git add .github/workflows/ci.yml
git commit -m "ci: add pytest matrix with pip caching"
git push -u origin ci/pipeline
gh pr create --title "ci: pipeline foundation" --body "Adds test matrix" --base main
```

Expected: `gh pr create` prints the PR URL.

**Checkpoint:**

```bash
gh pr checks ci/pipeline
```

Expected: two rows, `test (3.11)` and `test (3.12)`, both `pass`. Push a second commit and rerun the command — the second run's "Install dependencies" step should complete noticeably faster and its log should show `cache hit` under the `setup-python` step, proving the cache worked.

---

## Phase 2 — Trivy scan job gating merge

**[REPO]** — add a `scan` job to the same `ci.yml`, right after `jobs:` alongside `test`:

```yaml
  scan:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trivy filesystem scan
        uses: aquasecurity/trivy-action@0.28.0
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
          exit-code: "1"
          format: table
```

`exit-code: "1"` is what makes this a gate: the job fails (not just warns) the moment a CRITICAL or HIGH finding shows up, instead of only printing a report.

**[GITHUB]** — make `scan` (and `test`) required status checks so a red scan physically blocks the merge button, not just embarrasses you in the PR timeline:

```bash
gh api repos/<owner>/<repo>/branches/main/protection \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -f required_status_checks[strict]=true \
  -f 'required_status_checks[contexts][]=test (3.11)' \
  -f 'required_status_checks[contexts][]=test (3.12)' \
  -f 'required_status_checks[contexts][]=scan' \
  -f enforce_admins=true \
  -f required_pull_request_reviews=null \
  -f restrictions=null
```

Expected: JSON response echoing back the `required_status_checks` block you set.

**[REPO]** — prove the gate works by pinning the Dockerfile's base image to a known-old tag with published CVEs (adjust to whatever base image Mission 02 used, e.g. `python:3.11.4-slim` instead of a current patch release), commit, push:

```bash
git commit -am "test: pin to vulnerable base image on purpose"
git push
gh pr checks ci/pipeline --watch
```

Expected: `scan` shows `fail`, and the PR page shows "Merging is blocked — Required statuses must pass."

**[REPO]** — revert the pin, push the fix:

```bash
git revert --no-edit HEAD
git push
```

**Checkpoint:**

```bash
gh pr checks ci/pipeline
```

Expected: `test (3.11)`, `test (3.12)`, and `scan` all `pass`, and the PR page now shows the merge button enabled.

---

## Phase 3 — Build and push to ghcr.io with sha + semver tags

**[REPO]** — widen the trigger to also fire on version tags, and add a `build-push` job that only runs on pushes (not PRs), gated on both prior jobs:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
    tags: ["v*.*.*"]

jobs:
  test:
    # ...unchanged from Phase 1...

  scan:
    # ...unchanged from Phase 2...

  build-push:
    needs: [test, scan]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to ghcr.io
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/shiplog
          tags: |
            type=sha,prefix=,format=short
            type=semver,pattern={{version}}
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

Tag behavior: every push to `main` produces a `sha-<shortsha>` tag and moves `latest`; a pushed `vX.Y.Z` tag additionally produces the matching semver tag (`type=semver` only resolves on tag refs, so it's a no-op on plain branch pushes).

**[REPO]** — merge the PR from Phase 2 now that checks are green:

```bash
gh pr merge ci/pipeline --squash --delete-branch
```

**Checkpoint:**

```bash
gh run list --workflow=ci.yml --branch main --limit 1
gh api /user/packages/container/shiplog/versions --jq '.[0].metadata.container.tags'
```

Expected: the run shows `completed` / `success`, and the second command lists a tag array containing something like `["sha-abcd123", "latest"]`.

---

## Phase 4 — Release workflow with auto-changelog

**[REPO]** — add a second workflow, `.github/workflows/release.yml`, triggered only by version tags:

```yaml
name: Release

on:
  push:
    tags: ["v*.*.*"]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Create GitHub release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
          body: |
            Image: `ghcr.io/${{ github.repository_owner }}/shiplog:${{ github.ref_name }}`
```

`fetch-depth: 0` matters here — `generate_release_notes` diffs against the previous tag to build the changelog, and a shallow clone hides that history.

**[REPO]** — cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

**Checkpoint:**

```bash
gh release view v0.1.0
```

Expected: a release body with an auto-generated "What's Changed" section listing the merged PRs since the repo's first commit, plus your `Image:` line pointing at the ghcr.io tag. Confirm the image tag actually exists:

```bash
gh api /user/packages/container/shiplog/versions --jq '.[].metadata.container.tags' | grep v0.1.0
```

Expected: `v0.1.0` printed.

---

## Phase 5 — Self-hosted runner

**Security note before you touch this phase:** never register a self-hosted runner on a public repository, and never on a repo that accepts forked-repo pull requests. A workflow triggered by a fork PR runs with attacker-controlled code, and on a self-hosted runner that code executes on a machine you own with a token scoped to your repo — this is a well-known supply-chain attack path. Confirm your shiplog repo is **private** (you checked this in Phase 0) and keep it that way for as long as the runner is registered.

**[HOST]** — create the Ubuntu 24.04 lab VM. Use Hyper-V's default (NAT'd, internet-facing) switch since this runner needs outbound access to `github.com` and `ghcr.io`, not the isolated internal switch used by other tracks' labs:

```powershell
New-VM -Name "devops-runner1" -MemoryStartupBytes 4GB -Generation 2 -SwitchName "Default Switch" -NewVHDPath "D:\HyperV\devops-runner1\disk.vhdx" -NewVHDSizeBytes 40GB
Set-VMProcessor -VMName "devops-runner1" -Count 2
Start-VM -Name "devops-runner1"
```

Expected: no errors; `Get-VM devops-runner1` shows `State : Running` a moment later. Install Ubuntu 24.04 Server through the console (or clone from a template if you built one in an earlier mission), then SSH in for the rest of this phase.

**[RUNNER-VM]** — install Docker (the runner needs it to execute `build-push`):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in for the group change to take effect. Confirm:

```bash
docker run --rm hello-world
```

Expected: `Hello from Docker!`.

**[GITHUB]** — get a registration token for the repo (valid for one hour):

```bash
gh api -X POST repos/<owner>/<repo>/actions/runners/registration-token --jq .token
```

Expected: a long token string. Copy it.

**[RUNNER-VM]** — create a dedicated user, download and configure the runner (check the [releases page](https://github.com/actions/runner/releases) for the current version if `2.319.1` has moved on):

```bash
sudo useradd -m -s /bin/bash ghrunner
sudo usermod -aG docker ghrunner
sudo su - ghrunner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-x64-2.319.1.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/<owner>/<repo> --token <token-from-previous-step> \
  --labels lab --name devops-runner1 --unattended
```

Expected: `./config.sh` ends with `√ Settings Saved.`

**[RUNNER-VM]** — install as a systemd service instead of running it in a foreground terminal, so it survives reboots and logouts:

```bash
sudo ./svc.sh install ghrunner
sudo ./svc.sh start
```

Expected: `svc.sh start` prints `Started actions.runner.<owner>-<repo>.devops-runner1.service`. Confirm with systemd directly:

```bash
sudo systemctl status actions.runner.*.service --no-pager
```

Expected: `Active: active (running)`.

**[GITHUB]** — confirm the runner registered and is idle:

```bash
gh api repos/<owner>/<repo>/actions/runners --jq '.runners[] | {name, status, labels: [.labels[].name]}'
```

Expected: `{"name":"devops-runner1","status":"online","labels":["self-hosted","Linux","X64","lab"]}`.

**[REPO]** — route the heaviest job, `build-push`, to this runner by label instead of `ubuntu-latest`:

```yaml
  build-push:
    needs: [test, scan]
    if: github.event_name == 'push'
    runs-on: [self-hosted, linux, lab]
    # ...rest unchanged...
```

**Checkpoint:** push a commit to `main`, then watch the job pick up the lab runner:

```bash
gh run watch $(gh run list --workflow=ci.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: the `build-push` job's log header shows it ran on `devops-runner1`, and `gh api repos/<owner>/<repo>/actions/runners --jq '.runners[0].busy'` reads `true` while it's running and `false` once done.

---

## Phase 6 — Environments: staging and prod

**[GITHUB]** — create both environments, and require a reviewer on `prod`. Look up your own numeric user id first, since the API wants it in the reviewers array:

```bash
UID=$(gh api user --jq .id)
gh api repos/<owner>/<repo>/environments/staging -X PUT
gh api repos/<owner>/<repo>/environments/prod -X PUT \
  -f 'reviewers[][type]=User' -F "reviewers[][id]=$UID"
```

Expected: both calls return JSON with `"name": "staging"` / `"name": "prod"`; the `prod` response includes a `"protection_rules"` array with a `required_reviewers` entry.

**[REPO]** — add deploy placeholder jobs to `ci.yml`, gated behind the environments you just made:

```yaml
  deploy-staging:
    needs: build-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: echo "would deploy ghcr.io/${{ github.repository_owner }}/shiplog:sha-${GITHUB_SHA::7} to staging"

  deploy-prod:
    needs: deploy-staging
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: prod
    steps:
      - name: Deploy to prod
        run: echo "would deploy ghcr.io/${{ github.repository_owner }}/shiplog:${{ github.ref_name }} to prod"
```

These are intentionally just `echo` placeholders — Mission 07 (GitOps) replaces `deploy-prod`'s body with a real ArgoCD sync once that track is built. The point of this phase is the environment gate, not the deploy mechanism.

**Checkpoint:** push to `main` and confirm `deploy-staging` runs automatically with no approval needed:

```bash
gh run list --workflow=ci.yml --branch main --limit 1
```

Expected: `deploy-staging` shows `success` with no pause. Now push a tag and confirm `deploy-prod` stops and waits:

```bash
git tag v0.1.1 && git push origin v0.1.1
gh run list --workflow=ci.yml --limit 1 --json status --jq '.[0].status'
```

Expected: `waiting` — the run is parked on `deploy-prod` pending your review. Approve it from the GitHub UI (Actions → the run → "Review deployments" → check `prod` → Approve), then re-run the same `gh run list` command and confirm it flips to `completed`.

---

## Phase 7 — Least-privilege secrets and permissions

**[REPO]** — set a repo-wide default of no permissions, and let each job in `ci.yml` and `release.yml` declare only what it needs (checkout is read-only and needs nothing beyond `contents: read`; only `build-push` needs `packages: write`; only the `release` job needs `contents: write`). Add this to the top of `ci.yml`, right under `name:`:

```yaml
permissions:
  contents: read
```

`test` and `scan` inherit this and need nothing more. `build-push` already declares its own `packages: write` override from Phase 3 — job-level `permissions:` always wins over the workflow-level default, so this doesn't reopen access for the other jobs. Confirm `release.yml` already has its own `permissions: contents: write` block from Phase 4 (it does — that's the minimum `softprops/action-gh-release` needs to create a release).

**[GITHUB]** — demonstrate adding a repo secret with the correct command (this one is optional to actually use, but every real pipeline eventually needs one — a webhook URL is a harmless example):

```bash
gh secret set SLACK_WEBHOOK_URL --body "https://example.invalid/webhook/placeholder"
gh secret list
```

Expected: `gh secret list` shows `SLACK_WEBHOOK_URL` with an `Updated` timestamp — note it never prints the value back, which is the point.

**[REPO]** — wire it into `release.yml` as an optional, non-blocking step so a missing secret never fails the release:

```yaml
      - name: Notify release channel
        if: ${{ env.SLACK_WEBHOOK_URL != '' }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: curl -fsS -X POST -H 'Content-type: application/json' --data "{\"text\":\"shiplog ${{ github.ref_name }} released\"}" "$SLACK_WEBHOOK_URL"
```

**Checkpoint:**

```bash
gh api repos/<owner>/<repo>/actions/permissions --jq .
```

Run a fresh push and confirm the `test` and `scan` jobs' logs show `GITHUB_TOKEN Permissions: contents: read` and nothing else, while `build-push`'s log shows `packages: write` added on top. Every job should list only what it actually uses — nothing should show `write-all` or unused scopes.

---

## Break-fix drills

Diagnose before opening hints. State the symptom, form a hypothesis, test it.

**Drill 1 — cache key never hits**

In a Claude session, ask Claude to run this sabotage against your `ci.yml`: change the `cache-dependency-path` line under `actions/setup-python` from `requirements.txt` to `**/requirements-lock.txt` (a file that doesn't exist in this repo), then push. Symptom: every single run, on every matrix leg, logs `Cache not found for input keys: ...` under the `setup-python` step, and "Install dependencies" always takes the full cold-install time even though `requirements.txt` hasn't changed between runs. Diagnose why the hash never matches and fix it — before reading the hint.

**Drill 2 — workflow can't push the package**

Ask Claude, in this session, to remove the `permissions:` block from the `build-push` job (or set it back to whatever the org/repo default is) and push a commit to `main`. Symptom: `docker/login-action` succeeds, `docker/build-push-action` builds the image fine, but the push step fails with a `403 Forbidden` / `denied: installation not allowed to Write Package` error from `ghcr.io`. Diagnose which token scope is missing and where it needs to be declared — before reading the hint.

**Drill 3 — runner offline mid-job**

This one needs the self-hosted runner from Phase 5 up and a real job in flight. Push a commit to `main` to kick off `build-push` on `devops-runner1`, and while `docker/build-push-action` is mid-layer-push, ask Claude to kill the runner service from a separate session:

```bash
sudo systemctl stop actions.runner.*.service
```

Symptom: the job in the Actions UI sits with no new log lines and eventually shows the runner as `offline` in `gh api repos/<owner>/<repo>/actions/runners`. Bring the runner back and get the job to a clean successful state — and check whether re-running the job is actually safe to do repeatedly (what happens to `ghcr.io` if the same tag gets pushed twice, and what happens to the `staging`/`prod` deploy jobs if they run twice) — before reading the hint.

---

## Prove-it challenge

Demonstrate the full loop end to end, screen-recorded, in under 5 minutes measured from the moment you open the failing PR to the moment the tagged release exists with its image on `ghcr.io`.

1. Open a PR against `main` that includes a deliberately failing test (not a scan or lint failure — an actual `assert False` or wrong expected value in an existing test). Show `gh pr checks` reporting the failure and the PR's merge button disabled.
2. Push a fix commit to the same branch. Show `gh pr checks` going green and merge the PR.
3. Immediately push a new version tag (bump the last one from Phase 4/6).
4. Show, without touching anything further: the release workflow firing, `gh release view` showing the new tag with an auto-generated changelog, and the matching image tag present on `ghcr.io` — all without any manual step beyond the tag push and, if `prod`'s deploy queued in this same run, the one required approval click from Phase 6.

Acceptance criteria: the recording shows a real clock (a terminal `date` command at the start and end is enough), the total elapsed time from step 1's PR-open to step 4's release-visible is under 5 minutes, and every artifact (blocked check, green merge, tag, release, image) is visible on screen, not asserted.

---

## Hints

<details>
<summary>Hints for drills and the prove-it challenge (open only when stuck)</summary>

- Drill 1: `cache-dependency-path` is passed straight to `hashFiles()` internally — if the glob matches zero files, the hash is constant garbage and the cache key it produces will never match a real prior run (nor will it ever get populated meaningfully), so every run looks like a cold cache regardless of whether your real dependency file changed. Point the path at a file that actually exists and actually changes when your dependencies change.
- Drill 2: `GITHUB_TOKEN`'s permissions are additive from two places — the repository/organization default (Settings → Actions → General → Workflow permissions) and any `permissions:` block in the workflow or job. If the job-level block is missing, it falls back to the default, which for many orgs/repos is `read` only. The fix belongs in the workflow file, scoped to the one job that needs it, not in the repo-wide default.
- Drill 3: `gh api repos/<owner>/<repo>/actions/runners` tells you the runner's `status` — bring the systemd service back with `sudo systemctl start actions.runner.*.service` and it should pick back up as `online`. Whether re-running the job is safe depends on whether each step is idempotent: `docker build` + `docker push` re-pushing the same tag is safe (it's the same content-addressed layers), but check whether your `deploy-staging`/`deploy-prod` echo steps — or any real deploy logic you eventually put there — would do something unsafe if GitHub Actions decides to retry the whole job after the runner drops out mid-run.
- Prove-it: the timer starts at PR-open in step 1, so do the setup for steps 1-2 (writing the failing test, having the fix ready) before you start the clock — the recording only needs to capture the flow, not your editing time. A pre-staged fix commit ready to `git push` the moment the failure is confirmed is the difference between 90 seconds and 6 minutes here.

</details>

---

## Done when

- [ ] `ci.yml` runs `test` (matrix 3.11/3.12, pip cache confirmed hitting on a second run), `scan` (trivy, gating merge via required status checks), and `build-push` (ghcr.io, sha + semver + latest tags via `docker/metadata-action`) on every push/PR
- [ ] A PR with a real trivy finding was shown blocked from merging, then unblocked after a fix
- [ ] `release.yml` fires on a pushed `vX.Y.Z` tag and produces a GitHub release with an auto-generated changelog and a matching image tag on ghcr.io
- [ ] `devops-runner1` registered as a self-hosted runner via systemd service, labeled `lab`, and the `build-push` job demonstrably ran on it (not `ubuntu-latest`)
- [ ] `staging` and `prod` environments exist; `prod` requires your approval before its deploy job runs; `deploy-staging` runs automatically on every `main` push
- [ ] Every job's `permissions:` block is minimal and verified in its own log output — no job has more `GITHUB_TOKEN` scope than it uses
- [ ] All 3 break-fix drills solved and diagnosed before hints were opened
- [ ] Prove-it recording shows failing-PR-blocked → fix-merged → tag-pushed → release-with-image-visible in under 5 minutes, with a visible clock
