# Mission 03 — CI/CD Forge

**Track:** devops · **Difficulty:** 💀💀💀 · **Time:** 8-12h
**Prerequisites:** Missions 01, 02

## Goal

Build a real pipeline for shiplog: every push runs tests, every PR gets scanned for vulnerabilities before it can merge, every merge to `main` builds and pushes a tagged image to `ghcr.io`, and every version tag cuts a GitHub release with an auto-generated changelog — all without you touching a keyboard once the tag is pushed. You'll also stand up a self-hosted runner in a lab VM and route real work to it, and lock the whole thing down with least-privilege tokens and required reviewers on production deploys. By the end, a pull request with a failing test gets blocked automatically, and a good PR rides all the way to a released, scanned, tagged container image in under five minutes.

## Skills gained

- Writing multi-job GitHub Actions workflows with `needs:`, matrix strategy, and dependency caching
- Matrix testing across Python versions in one workflow run
- Gating merges on a vulnerability scan (trivy) as a required status check
- Image tagging strategy with `docker/metadata-action` (short SHA, semver, `latest`)
- Cutting releases from git tags with auto-generated changelogs (`softprops/action-gh-release`)
- Registering and running a self-hosted GitHub Actions runner as a systemd service, with labels routing specific jobs to it
- Configuring GitHub Environments (`staging`, `prod`) with required reviewers to gate deploys
- Writing a least-privilege `permissions:` block per job instead of relying on the default `GITHUB_TOKEN` scope

## Deliverables

- [ ] A single CI workflow on the shiplog repo running test → scan → build → push on every push/PR, gating merges on green checks
- [ ] A release workflow triggered by version tags that publishes a GitHub release with an auto-generated changelog and a matching semver-tagged image on `ghcr.io`
- [ ] A self-hosted runner registered and running as a systemd service in an Ubuntu lab VM, with a heavy job routed to it by label
- [ ] `staging` and `prod` GitHub Environments configured, `prod` gated by a required reviewer
- [ ] Every job scoped to a minimal `permissions:` block — no job holds more `GITHUB_TOKEN` scope than it needs
- [ ] All 3 break-fix drills solved and diagnosed before hints were opened
- [ ] Prove-it: a PR with a failing test demonstrably blocked from merging; then, after a real fix, a merge-to-tag-to-release flow completed in under 5 minutes with zero manual steps, screen-recorded

## Start

Open a Claude Code session in this folder and say: `start devops/03`. Follow GUIDE.md.
