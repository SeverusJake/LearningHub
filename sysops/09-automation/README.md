# Mission 09 — Automation

**Track:** sysops · **Difficulty:** 💀💀💀💀 · **Time:** 12-16h
**Prerequisites:** Mission 01 (Lab Forge), Mission 05 (Service Citadel — nginx), Mission 06 (All-Seeing Eye — node_exporter), Mission 08 (SSH hardening)

## Goal

Every service in this lab so far — the nginx reverse proxy, node_exporter, SSH hardening — was built by hand, one SSH session at a time. That doesn't survive a wiped VM, a new hire, or a second lab. This mission makes the whole lab reproducible from code: a small bash toolkit that passes `shellcheck`, and an Ansible repo that rebuilds the nginx, node_exporter, and SSH-hardening pieces of the lab from three blank template clones with a single command. When this mission is done, destroying a VM is a shrug, not an incident.

## Skills gained

- Writing robust bash: `set -euo pipefail`, `trap` cleanup on exit, `getopts` for flags, a shared logging function
- Passing `shellcheck` cleanly and knowing why each warning class exists
- Ansible fundamentals: inventory (INI, groups), ad-hoc commands, playbooks, idempotency
- Building proper roles: `tasks/`, `handlers/`, `templates/`, `defaults/`, `meta/`
- Jinja2 templating and handler-driven service restarts
- Securing secrets with `ansible-vault` and `--vault-id`
- Using tags and `--check --diff` as a safe, everyday workflow, not just a rescue tool

## Deliverables

- [ ] A bash toolkit (`toolkit/template.sh` skeleton + two rewritten earlier-mission scripts) that passes `shellcheck` with zero warnings
- [ ] An Ansible control node with a working INI inventory (`dns`, `web`, `monitor` groups) and passing ad-hoc `ping`
- [ ] A first playbook proven idempotent: two consecutive runs, second reports `changed=0`
- [ ] Four working roles — `common`, `nginx`, `node_exporter`, `monitoring` — each following the standard role skeleton
- [ ] A templated `nginx.conf.j2` wired to a restart handler
- [ ] Secrets encrypted with `ansible-vault` and referenced via `--vault-id`
- [ ] A `site.yml` that, run against three blank clones of `tpl-ubuntu2404`, brings up the full core lab (nginx on `web`, node_exporter everywhere, Prometheus on `monitor`, SSH hardened everywhere) with one command
- [ ] Both break-fix drills solved and documented
- [ ] Prove-it drill completed: arbitrary config deleted across all three VMs, drift shown with `--check --diff`, then fully restored by one playbook run

## Start

Open a Claude Code session in this folder and say: `start sysops/09`. Follow GUIDE.md.
