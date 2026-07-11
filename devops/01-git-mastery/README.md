# Mission 01 — Git Mastery

**Track:** devops · **Difficulty:** 💀💀 · **Time:** 4-6h
**Prerequisites:** none

## Goal

Master the git operations real teams depend on — rewriting history safely, finding bugs by bisection, enforcing quality before code lands, and standing up your first CI run. This mission builds no application code; it builds the git and workflow discipline every later devops mission assumes you already have. By the end you can rescue a mangled repo, pin down the exact commit that broke something, block bad commits before they're made, and watch a green check appear on GitHub Actions.

## Skills gained

- Interactive rebase: squash, reword, reorder, edit, and `--onto` for surgically moving commits between branches
- `git bisect run` with an automated test script to binary-search for a bug-introducing commit
- Reflog rescue: recovering commits after a hard reset or a branch you thought you lost
- Pre-commit framework: installing hooks that block bad commits (shellcheck, whitespace, branch protection) before they happen
- Trunk-based development flow and configuring branch protection on GitHub
- Git worktrees for working on two branches at once without stashing or cloning twice
- Writing and reading your first GitHub Actions workflow (lint job on push/PR)

## Deliverables

- [ ] A mangled playground repo rescued back to a clean, correct history
- [ ] The exact bug-introducing commit found via `git bisect run` (not by eye)
- [ ] Pre-commit hooks installed and demonstrably blocking a bad commit
- [ ] A first GitHub Actions workflow running and showing a green check on a real push

## Start

Open a Claude Code session in this folder and say: `start devops/01`. Follow GUIDE.md.
