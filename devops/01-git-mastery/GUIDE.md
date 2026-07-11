# Guide — Mission 01: Git Mastery

Everything in this mission runs on your laptop in a throwaway **playground repo** — it has nothing to do with `shiplog` yet (that gets built in mission 02). The point here is pure git and workflow muscle memory: you'll mangle a repo on purpose and fix it, hunt a bug with bisection instead of eyeballing diffs, and wire up the quality gates every later mission assumes are already in place.

Conventions used below:

- All commands run in a plain bash shell (Git Bash, WSL, or macOS/Linux terminal).
- `<owner>/<repo>` means substitute your own GitHub username and a repo name you choose (e.g. `git-mastery-playground`).
- Where git output includes a commit hash, yours will differ from any example shown — match the *shape* of the output, not the literal hex.

---

## Phase 0 — Playground setup

You need a repo with real history to practice on: enough commits to make rebase and bisect meaningful, and one commit in the middle that quietly breaks something.

Save this as `seed-playground.sh` and run it with `bash seed-playground.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$HOME/playground/git-mastery"
rm -rf "$REPO_DIR"
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"
git init -q -b main
git config user.email "you@example.com"
git config user.name "You"

# Commit 1: the seed
cat > slug.py <<'EOF'
def make_slug(url: str, length: int = 6) -> str:
    import hashlib
    digest = hashlib.sha256(url.encode()).hexdigest()
    return digest[:length]
EOF
git add slug.py
git commit -q -m "feat: initial slug generator"

# Commits 2-14: routine churn, all correct
for i in $(seq 2 14); do
  echo "# revision marker $i" >> slug.py
  git add slug.py
  git commit -q -m "chore: refine slug generator (rev $i)"
done

# Commit 15: a real, correct feature
cat > slug.py <<'EOF'
def make_slug(url: str, length: int = 6) -> str:
    import hashlib
    if length < 1:
        raise ValueError("length must be >= 1")
    digest = hashlib.sha256(url.encode()).hexdigest()
    return digest[:length]
EOF
git add slug.py
git commit -q -m "feat: validate requested slug length"

# Commits 16-17: more churn, still correct
for i in 16 17; do
  echo "# note $i" >> slug.py
  git add slug.py
  git commit -q -m "docs: annotate slug generator (rev $i)"
done

# Commit 18: THE BUG, disguised as an innocent refactor
cat > slug.py <<'EOF'
def make_slug(url: str, length: int = 6) -> str:
    import hashlib
    if length < 1:
        raise ValueError("length must be >= 1")
    digest = hashlib.sha256(url.encode()).hexdigest()
    return digest[:length - 1]
EOF
git add slug.py
git commit -q -m "refactor: tidy up slug truncation logic"

# Commits 19-30: churn continues on top of the bug, unrelated to it
for i in $(seq 19 30); do
  echo "# churn $i" >> slug.py
  git add slug.py
  git commit -q -m "chore: misc cleanup (rev $i)"
done

echo "Total commits: $(git log --oneline | wc -l)"
```

Expected output (last line):

```
Total commits: 30
```

**Checkpoint:** `cd ~/playground/git-mastery && git log --oneline | wc -l` prints `30`, and `git log --oneline | tail -1` shows `feat: initial slug generator` as the very first commit.

---

## Phase 1 — Interactive rebase

All work in this phase happens on feature branches, never on `main` directly.

**Make a messy branch:**

```bash
cd ~/playground/git-mastery
git checkout -b feature/slug-prefix

echo "# stub: add prefix support" >> slug.py
git add slug.py
git commit -m "wip"

cat >> slug.py <<'EOF'

def make_slug_with_prefix(url: str, prefix: str, length: int = 6) -> str:
    return f"{prefix}-{make_slug(url, length)}"
EOF
git add slug.py
git commit -m "wip: prefix func"

echo "# fx typo in comment above" >> slug.py
git add slug.py
git commit -m "fx typo"

echo "# add a docstring later" >> slug.py
git add slug.py
git commit -m "add docstring"
```

You now have 4 sloppy commits on top of `main`. Clean them up:

```bash
git rebase -i main
```

Your editor opens a list of 4 `pick` lines, oldest first (`wip`, `wip: prefix func`, `fx typo`, `add docstring`). Edit the plan so you:

1. Change the second line's `pick` to `squash` (folds `wip: prefix func` into `wip`).
2. Change the first line's `pick` to `reword` so you can rename the combined commit to `feat: add prefixed slug support` when prompted.
3. Reorder so `add docstring` comes right after the reworded feature commit, and `fx typo` comes last.
4. Change `fx typo`'s `pick` to `edit`.

Save and close. Git stops on the `edit` commit. Fix the actual typo and amend:

```bash
git commit --amend -m "fix: correct typo in slug.py comment"
git rebase --continue
```

**Checkpoint:**

```bash
git log --oneline main..feature/slug-prefix
```

Expected: exactly 3 commits, oldest to newest something like:

```
a1b2c3d feat: add prefixed slug support
e4f5g6h add docstring
i7j8k9l fix: correct typo in slug.py comment
```

Three clean, well-named commits — not four sloppy ones. Do not continue until reordering, squashing, rewording, and editing have each visibly changed the log.

**The `--onto` case.** Branch a test-only branch off your (still messy in spirit) feature branch:

```bash
git checkout -b feature/prefix-tests feature/slug-prefix
cat > test_slug.py <<'EOF'
from slug import make_slug_with_prefix

def test_prefix():
    assert make_slug_with_prefix("https://example.com", "usr").startswith("usr-")
EOF
git add test_slug.py
git commit -m "test: add slug prefix tests"
```

You decide the tests should ship independently of the prefix feature (which isn't ready yet) — you want just the test commit, replayed directly onto `main`, without carrying `feature/slug-prefix`'s commits along:

```bash
git rebase --onto main feature/slug-prefix feature/prefix-tests
```

**Checkpoint:**

```bash
git log --oneline main..feature/prefix-tests
```

Expected: exactly 1 commit (`test: add slug prefix tests`) — the prefix-feature commits are gone from this branch's view because `--onto` replayed only what was unique to `feature/prefix-tests` past `feature/slug-prefix`, directly on top of `main`.

---

## Phase 2 — `git bisect run`

Switch back to `main`, where the disguised bug from Phase 0 (commit 18) is waiting.

Save this as `test-slug.sh` **one directory above the repo** (`~/playground/test-slug.sh`) so it survives every checkout bisect performs:

```bash
#!/usr/bin/env bash
set -e
python3 - <<'PY'
from slug import make_slug
result = make_slug("https://example.com/very/long/path", 8)
assert len(result) == 8, f"expected length 8, got {len(result)} ({result!r})"
print("OK: slug length correct")
PY
```

```bash
chmod +x ~/playground/test-slug.sh
cd ~/playground/git-mastery
git checkout main
```

Find your known-good starting point and start the bisect:

```bash
FIRST_COMMIT=$(git log --oneline | tail -1 | cut -d' ' -f1)
git bisect start
git bisect bad HEAD
git bisect good "$FIRST_COMMIT"
```

Expected output after `git bisect good`: git reports roughly how many commits remain and how many steps it'll take, e.g. `Bisecting: 14 revisions left to test after this (roughly 4 steps)`.

Now let git do the searching:

```bash
git bisect run bash ~/playground/test-slug.sh
```

**Checkpoint:** the run ends with a block naming the exact bad commit, e.g.:

```
<hash> is the first bad commit
commit <hash>
    refactor: tidy up slug truncation logic
```

The named commit must be the "refactor: tidy up slug truncation logic" commit — not any commit before or after it. Clean up:

```bash
git bisect reset
```

---

## Phase 3 — Reflog rescue

Simulate the disaster teams eventually cause themselves.

```bash
git checkout main
echo "def cache_lookup(): pass" >> slug.py
git add slug.py
git commit -m "feat: add cache layer stub"
```

Now blow it away like someone who reset one commit too many:

```bash
git reset --hard HEAD~1
```

Expected output: something like `HEAD is now at <hash> refactor: tidy up slug truncation logic` (or whatever commit was previously below the one you just lost) — note `cache_lookup` is gone from `slug.py` and `git log` no longer shows the commit.

Recover it. First, find where it went:

```bash
git reflog
```

Expected: a line like `<hash> HEAD@{1}: commit: feat: add cache layer stub` — the commit still exists, it's just unreachable from any branch right now.

Bring it back:

```bash
git reset --hard HEAD@{1}
```

**Checkpoint:**

```bash
git log --oneline -1
grep cache_lookup slug.py
```

Expected: the log's top line is `feat: add cache layer stub` again, and `grep` finds the `cache_lookup` line. The reflog entry is your safety net — nothing is truly gone until git garbage-collects unreachable commits, which takes weeks by default.

---

## Phase 4 — Pre-commit hooks

Install the framework:

```bash
pip install pre-commit
pre-commit --version
```

Expected output: a version string, e.g. `pre-commit 3.7.1`.

Save this as `.pre-commit-config.yaml` in the repo root:

```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: no-commit-to-branch
        args: ["--branch", "main"]

  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.10.0.1
    hooks:
      - id: shellcheck
```

Install the git hook:

```bash
git add .pre-commit-config.yaml
git commit -m "chore: add pre-commit config"
```

Wait — that commit itself just landed on `main`, which `no-commit-to-branch` should now prevent for *future* commits. Register the hook properly:

```bash
pre-commit install
```

Expected output: `pre-commit installed at .git/hooks/pre-commit`.

Now trigger it. First, a direct commit to `main` (should be blocked):

```bash
echo "# another note" >> slug.py
git add slug.py
git commit -m "docs: note directly on main"
```

Expected output: the `no-commit-to-branch` hook fails and prints something like `Don't commit to branch...`, and the commit does **not** happen — `git log --oneline -1` still shows your previous commit.

Second, a shellcheck violation on a feature branch (should also be blocked):

```bash
git checkout -b chore/deploy-script
cat > deploy.sh <<'EOF'
#!/usr/bin/env bash
NAME=$1
echo Deploying $NAME
EOF
git add deploy.sh
git commit -m "chore: add deploy script"
```

Expected output: the `shellcheck` hook fails, reporting something like `SC2086: Double quote to prevent globbing and word splitting` on the `echo Deploying $NAME` line, and the commit is rejected.

**Checkpoint:** both attempted commits above were blocked — confirm with `git log --oneline -3` on each branch and see that neither the "note directly on main" nor the unquoted `deploy.sh` ever entered history. Fix `deploy.sh` (quote the variable) and confirm the same commit now succeeds.

---

## Phase 5 — Trunk-based flow + branch protection

**The flow, in one paragraph:** `main` is always deployable. Nobody commits to it directly (Phase 4 now enforces that locally). Every change is a short-lived branch, opened as a pull request within a day or two, reviewed, and merged — no long-lived `develop` or `release` branches accumulating drift. Small, frequent merges beat big, rare ones because they keep conflicts small and bisectable.

Create the real GitHub repo for this playground (needs `gh auth login` done once beforehand):

```bash
gh repo create <owner>/git-mastery-playground --private --source=. --remote=origin --push
```

Expected output: a line ending in the new repo's URL, and your local `main` now tracks `origin/main`.

**Branch protection via the web UI:**

1. Go to `https://github.com/<owner>/git-mastery-playground/settings/branches`.
2. Click **Add branch protection rule**, target pattern `main`.
3. Enable **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** (you'll pick the lint check once Phase 7 creates it).
5. Save changes.

**The same thing via `gh` CLI**, so it's scriptable and repeatable. Save this as `protection.json`:

```json
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null
}
```

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/<owner>/git-mastery-playground/branches/main/protection" \
  --input protection.json
```

Expected output: a JSON blob echoing back the protection settings you just set, including `"enforce_admins": {"enabled": true}`.

**Checkpoint:**

```bash
gh api repos/<owner>/git-mastery-playground/branches/main/protection --jq '.enforce_admins.enabled'
```

Expected: `true`. Try pushing a commit directly to `origin/main` and confirm GitHub rejects it — a pull request is now the only way in.

---

## Phase 6 — Worktrees

You're mid-way through `feature/slug-prefix` and need to fix an urgent bug on `main` without stashing your in-progress work or cloning the repo again.

```bash
cd ~/playground/git-mastery
git worktree add ../git-mastery-hotfix main
```

Expected output: something like `Preparing worktree (checking out 'main')` followed by an `HEAD is now at ...` line.

```bash
cd ../git-mastery-hotfix
echo "# hotfix applied" >> slug.py
git add slug.py
git commit -m "fix: urgent hotfix on main"
```

Your original working directory (`~/playground/git-mastery`) is completely untouched — check it in another terminal or with `git -C ~/playground/git-mastery status`; your `feature/slug-prefix` changes are exactly where you left them.

**Checkpoint:**

```bash
git worktree list
```

Expected: two rows, one for each directory, each pinned to a different branch (`main` in the hotfix worktree, your feature branch in the original). Clean up when done:

```bash
cd ~/playground/git-mastery
git worktree remove ../git-mastery-hotfix
```

---

## Phase 7 — First GitHub Actions workflow

Save this as `.github/workflows/lint.yml`:

```yaml
name: Lint

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Check out code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install flake8
        run: pip install flake8

      - name: Lint Python
        run: flake8 --max-line-length=100 .

      - name: Install shellcheck
        run: sudo apt-get update && sudo apt-get install -y shellcheck

      - name: Lint shell scripts
        run: shellcheck deploy.sh
```

Add, commit (through a branch, since `main` is now protected), and open a PR:

```bash
git checkout -b ci/add-lint-workflow
git add .github/workflows/lint.yml
git commit -m "ci: add lint workflow"
git push -u origin ci/add-lint-workflow
gh pr create --title "ci: add lint workflow" --body "First Actions workflow." --base main
```

Expected output from `gh pr create`: a line with the new PR's URL.

Watch the run:

```bash
gh run watch
```

Expected output: live-updating job status lines, ending in `✓ lint` and an overall `✓ Lint` conclusion.

**Checkpoint:**

```bash
gh run list --limit 1
```

Expected: a row showing `completed` / `success` for the `Lint` workflow. Merge the PR once the check is green:

```bash
gh pr merge --merge --delete-branch
```

The green check on this PR is your deliverable — screenshot or note the run URL from `gh run view`.

---

## Break-fix drills

Diagnose before you ask for hints. State the symptom, form a hypothesis, test it — then open the hint if you're stuck.

**Drill 1 — Detached HEAD with unpushed commits**

```bash
cd ~/playground/git-mastery
git checkout HEAD~3
echo "# work done in detached HEAD" >> slug.py
git add slug.py
git commit -m "feat: work done while detached"
git checkout main
```

You just "lost" that commit the way people do when they check out a tag or an old commit to poke around, then forget they're not on a branch. Get it back onto a real branch without retyping the change.

**Drill 2 — Rebase gone wrong mid-flight**

```bash
git checkout feature/slug-prefix
echo "conflicting change" > slug.py
git add slug.py
git commit -m "commit that will conflict"
git rebase main
```

This will stop with a conflict. You now have two live options — `git rebase --abort` or resolve-and-`--continue`. Decide which is correct for a conflict this trivial versus one where you'd need to preserve careful in-progress edits, and justify the choice before running either command.

**Drill 3 — Force-push clobbered a teammate's work**

```bash
git checkout main
git reset --hard HEAD~2
git push --force origin main
```

You've just simulated overwriting shared history — in real life this would erase a teammate's pushed commits from `origin/main`. Figure out how to recover the "lost" commits using either your local reflog (if you still have them locally) or the remote's own history, and restore `origin/main` to where it should be.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: `git reflog` shows every HEAD movement, including the commit you made while detached — a branch is just a movable pointer to a hash.
- Drill 2: check `git status` during the conflict — it tells you exactly which files need resolving and reminds you of both escape hatches in its own output.
- Drill 3: if you force-pushed from the same machine that made the original commits, your local reflog still has them even though `origin/main` doesn't — GitHub also keeps a server-side reflog-like event log for a short time.

</details>

---

## Prove-it challenge

You're handed (well — you build, then treat as handed-to-you) a repo in this state: a tangled merge history from two branches that both touched `main` out of order, a commit that got lost somewhere in the tangle, and — five commits back from the tip — a commit that accidentally added a file containing `API_KEY=sk-live-1234567890abcdef`.

Build that scenario yourself first (merge two diverging branches with conflicting merges, `reset --hard` away a commit mid-process to lose it, and commit a fake secret 5 commits before the tip), then deliver:

1. Clean, linear (or intentionally merged, but *understood*) history with no tangle left unexplained.
2. The lost commit restored and present in `main`'s history.
3. The secret fully purged from **every** commit in history (not just removed from the tip) using `git filter-repo`, followed by a force-push and a rotated (fake) credential noted in your commit message as "rotated."

```bash
pip install git-filter-repo
git filter-repo --path secrets.env --invert-paths
```

Expected output: `git filter-repo` reports it rewrote every commit touching `secrets.env`, and rewrites `HEAD` to a fresh set of hashes.

**Checkpoint:**

```bash
git log --all --oneline -- secrets.env
```

Expected: empty output — no commit, anywhere in history, still references the file.

<details>
<summary>Hints (open only when stuck)</summary>

- Losing the commit: the same trick as Drill 1 — cause it with a `reset --hard` at the wrong moment, recover it with `git reflog` before you do anything else.
- Purging the secret: `filter-repo` rewrites hashes for every commit after the one it touches — expect the remote to reject a plain push afterward; you'll need `--force` and everyone else will need to re-clone.

</details>

---

## Done when

- [ ] Playground repo seeded with 30 commits, one of them a disguised bug (Phase 0)
- [ ] A feature branch cleaned up with squash, reword, reorder, and edit in one `rebase -i` session, plus a working `--onto` replay (Phase 1)
- [ ] `git bisect run` names the exact bug-introducing commit without you reading a single diff by eye (Phase 2)
- [ ] A hard-reset "disaster" fully recovered via `git reflog` (Phase 3)
- [ ] Pre-commit hooks installed and caught blocking both a direct commit to `main` and a shellcheck violation (Phase 4)
- [ ] Branch protection live on `main` via both the GitHub web UI and `gh api` (Phase 5)
- [ ] A second worktree used to fix `main` without disturbing in-progress feature work (Phase 6)
- [ ] A GitHub Actions lint workflow merged with a green check on a real PR (Phase 7)
- [ ] All three break-fix drills resolved with a stated diagnosis before the fix
- [ ] Prove-it repo delivered with tangled history resolved, lost commit restored, and secret fully purged via `git filter-repo`
