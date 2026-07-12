# Mission 09 — Cluster Watchtower

**Track:** proxmox · **Difficulty:** 💀💀 · **Time:** 4-6h
**Prerequisites:** Mission 01 (Mission 05 and Mission 06 for full alert coverage — see below)

## Goal

Build real-time monitoring and alerting over the whole Proxmox cluster, not just the lab VMs living inside it. Every mission before this one built something real on the cluster — templates, IaC, storage, backups, HA — and every one of those things can silently break at 3am with nobody watching. By the end, a node dying, a datastore filling up, a backup silently failing, and an HA resource getting stuck in `error` all show up on a dashboard and in your inbox (or Telegram) within seconds of Prometheus noticing, not whenever you next happen to log in and look.

This mission only strictly needs Mission 01 (the cluster, the pool, and the `learn@pve!tf` token all have to exist). Two of the four alert rules built here depend on work from later missions: `BackupTooOld` needs Mission 05's PBS datastore to have something to measure, and `HAResourceError` needs Mission 06's HA stack to have a resource that can even reach an `error` state. Build this mission with whichever of 05/06 you've already completed — the guide calls out exactly which phase needs which prerequisite, and skipping an alert you can't wire up yet is fine; wire it up when you circle back.

## Skills gained

- Deploying `prometheus-pve-exporter` and reading Proxmox cluster state as Prometheus metrics
- Bridging Proxmox Backup Server's REST API into Prometheus with `json_exporter`, including auth headers and JSONPath metric extraction
- Building a cluster-wide Grafana dashboard from scratch, plus importing and adapting a community dashboard
- Writing Alertmanager routing trees with per-severity `group_wait` tuning, and wiring delivery to either SMTP or Telegram
- Writing Prometheus alerting rules that catch node death, storage pressure, silent backup failure, and stuck HA state
- The real difference between failure *detection* (a scrape interval away) and alert *firing* (gated by a debounce window), and why both numbers matter

## Deliverables

- [ ] `prometheus-pve-exporter` and a PBS metrics bridge both scraped successfully by Prometheus, covering every node and the PBS datastore
- [ ] A cluster Grafana dashboard: one imported community dashboard, plus a self-built 6-panel dashboard (per-node CPU/mem, storage usage, VM count by node, backup job age, HA status)
- [ ] Alert rules live for `PVENodeDown`, `StorageAbove80`, `BackupTooOld`, and `HAResourceError`
- [ ] Alert delivery working end-to-end, to either email or Telegram
- [ ] Sub-minute node-down detection demonstrated: a node's exporter target taken down and the resulting alert reaching the delivery channel in under 60 seconds, with a timestamped screenshot to prove it

## Start

Open a Claude Code session in this folder and say: `start proxmox/09`. Follow GUIDE.md.
