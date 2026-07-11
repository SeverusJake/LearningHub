# LearningHub Design

**Date:** 2026-07-12
**Status:** Approved by user (section-by-section review)

## Purpose

A self-directed learning hub built around doing, not reading. Four tracks: SysOps, DevOps, Proxmox, and money-making projects. Each track is a folder of ordered "missions" — hands-on projects with step-by-step guides, ascending difficulty, and deliberate break-fix challenges. The user works missions inside Claude Code sessions with live guidance; the documents are the map and fallback.

## User profile and constraints

- Advanced IT background; comfortable with Linux, git, programming.
- Windows 11 Pro PC, 32GB+ RAM, virtualization capable (Hyper-V native).
- Company Proxmox cluster: 3+ nodes, full admin access. Guardrails still required (company hardware).
- Time: 5+ hours/day or weekend bursts.
- Money projects: global/English market, PayPal available, startup budget up to $50.
- Preference: maximum difficulty and effectiveness; learning through hard projects.

## Structure decision

Chosen approach: **mission-based projects with cross-track capstones** (option B+C).

- Missions within a track are independent — no deadlocks; pick any order, though numbering suggests progression.
- Final capstone missions deliberately link tracks (e.g., a revenue-generating micro-tool deployed via the user's own CI/CD onto the user's own Proxmox Kubernetes cluster).

Rejected alternatives: textbook-style curriculum (too passive); fully integrated saga (single blocker stalls everything).

## Repository layout

```
LearningHub/
├── README.md                  # hub map, how to use, progress dashboard
├── sysops/
│   ├── README.md              # track overview, mission list, skill map
│   └── NN-<mission>/          # README.md + GUIDE.md per mission
├── devops/                    # same pattern
├── proxmox/                   # same pattern
├── money/
│   ├── README.md              # ideas ranked: effort vs revenue vs speed
│   └── NN-<idea>/             # README.md + PLAYBOOK.md + TRACKER.md
├── capstones/
│   └── README.md              # cross-track final projects
└── docs/superpowers/specs/    # design documents
```

## Document formats

**Learning mission folders:**
- `README.md` — goal, difficulty (1–5 skulls), prerequisites, time estimate, skills gained.
- `GUIDE.md` — numbered steps with checkpoints ("verify X before continuing") and **prove-it challenges**: problems stated without answers, hints in a collapsed section at the bottom. The user must solve them to progress.

**Money project folders:**
- `README.md` — business model, platform rules and ToS notes, country-eligibility check steps.
- `PLAYBOOK.md` — exact operating loop: which artifacts the AI generates, which actions the user performs manually.
- `TRACKER.md` — log of date, hours spent, revenue, expenses.

**Difficulty mechanism:** break-fix drills. Guides include sabotage scenarios (executed with AI help in-session) that the user must diagnose and repair, sometimes under a time limit.

## Track designs

### sysops/ — on-PC lab (Hyper-V + Linux VMs)

| # | Mission | Core skills |
|---|---------|-------------|
| 01 | Lab Forge | Hyper-V switches/NAT, VM templates, cloud-init, snapshots |
| 02 | Linux Deep Core | systemd, journald, cgroups, users/sudo, break-fix drills |
| 03 | Storage Wars | LVM, mdadm RAID, ZFS, LUKS encryption, quotas |
| 04 | Network Fortress | VLANs, bonding, nftables, WireGuard, bind9 DNS, Kea DHCP |
| 05 | Service Citadel | nginx + private CA/TLS, Postfix+Dovecot mail, FreeIPA SSO |
| 06 | All-Seeing Eye | Prometheus, Grafana, Alertmanager, Loki, runbooks |
| 07 | Doomsday Drill | restic/borg backups; timed destroy-and-restore exercise |
| 08 | Hardening | CIS benchmark, auditd, SSH lockdown, Lynis score improvement |
| 09 | Automation | advanced bash → Ansible; entire lab rebuilt from playbooks |
| 10 | Capstone: MiniCorp | full company infrastructure from zero, documented, survives a chaos drill |

### devops/ — one real application through the full lifecycle

| # | Mission | Core skills |
|---|---------|-------------|
| 01 | Git Mastery | rebase, bisect, hooks, trunk-based development, Actions basics |
| 02 | Docker Deep | multi-stage builds, compose, image hardening, trivy scanning |
| 03 | CI/CD Forge | GitHub Actions, self-hosted runner, full build/test/scan/release pipeline |
| 04 | K8s Core | kind multi-node, ingress, RBAC, network policies, break-fix |
| 05 | K8s Advanced | authoring Helm charts, HPA, StatefulSet Postgres |
| 06 | IaC | Terraform modules and state, Packer images |
| 07 | GitOps | ArgoCD app-of-apps, sealed-secrets/Vault, dev→prod promotion |
| 08 | Observability | OpenTelemetry, Tempo/Loki/Grafana, SLOs |
| 09 | Chaos + SRE | chaos mesh, k6 load testing, incident postmortems |
| 10 | Capstone: Zero-to-Prod | empty repo → GitOps-managed k8s platform, one-command bootstrap |

### proxmox/ — company cluster, 3+ nodes, full admin

Mission 01 establishes guardrails before anything else: it is company hardware.

| # | Mission | Core skills |
|---|---------|-------------|
| 01 | Recon + Safety Rails | cluster inventory, config backup, dedicated resource pool, isolated bridge/VLAN, non-root API token |
| 02 | Template Factory | VM/LXC templates, cloud-init, qemu-agent, hookscripts, snippets |
| 03 | IaC on Proxmox | Terraform (bpg provider), Packer golden images, Ansible dynamic inventory |
| 04 | Storage Deep | ZFS pools/replication, Ceph (3+ nodes available) |
| 05 | PBS | Proxmox Backup Server, datastores, prune/verify, restore drills |
| 06 | HA + Cluster | corosync, HA groups, live migration |
| 07 | SDN | zones, VNets, VLAN segmentation |
| 08 | K8s on Proxmox | Terraform + cloud-init → k3s cluster; connects to devops GitOps track |
| 09 | Cluster Watchtower | PVE exporter, Grafana dashboards, alerting |
| 10 | Capstone: Private Cloud | self-service platform — VM/namespace provisioned via git pull request |

### money/ — AI-leveraged income experiments

Ground rules stated in every folder: no income is guaranteed; $100–$1000/month is achievable but month-one results vary. Quality-first output only — platforms ban low-effort AI spam. Platform AI-disclosure rules (Amazon KDP, Adobe Stock) are followed. The user personally handles account creation and verification (ToS requirement), sends messages the AI drafts, uploads deliverables, does final quality control, and manages PayPal.

Ranked by expected speed to first dollar:

| # | Folder | Model | AI share | Manual share | First $ | Ceiling/mo | Payout |
|---|--------|-------|----------|--------------|---------|-----------|--------|
| 01 | freelance-gigs | Fiverr/Upwork: scraping scripts, data cleaning, Excel automation, bug fixes, technical writing | deliverables, gig copy, proposal drafts | client chat, delivery | days–2 wks | $300–2000 | PayPal |
| 02 | biz-websites | cold outreach; small-business sites at $200–500 each | site builds, outreach drafts, portfolio | sending emails, calls | 2–4 wks | $400–2000 | PayPal invoice |
| 03 | micro-tools | niche paid web tools, Lemon Squeezy checkout; deployed via own DevOps stack | code, copy, SEO | domain purchase, launch posts | 2–6 wks | $50–500 | LS → PayPal |
| 04 | gumroad-products | Notion templates, dev boilerplates, cheatsheet packs | products, landing copy | uploads, promotion | 2–6 wks | $50–500 | PayPal |
| 05 | stock-assets | Adobe Stock GenAI images/vectors (labeled per policy) | generation pipeline, metadata | account, uploads, curation | 3–8 wks | $20–300 | PayPal |
| 06 | pod-merch | Redbubble/TeePublic designs | designs, titles, tags | uploads | 3–8 wks | $20–300 | PayPal |
| 07 | kdp-books | niche nonfiction ebooks and workbooks, AI-disclosure compliant | manuscripts, cover concepts, keywords | KDP account, review, publish | 4–8 wks | $50–500 | bank transfer |
| 08 | seo-affiliate-site | niche content site (slow burn) | all content, site build | domain, hosting choice | 3–6 mo | $0–1000+ | varies |

Cadence fit: 05/06/07 suit burst batch-production days; 01/02 suit daily loops; 03/04/08 compound over time.

### capstones/ — cross-track final projects

1. **Full-stack money machine:** micro-tool (money/03) built, containerized, CI/CD-pipelined (devops), deployed to k3s on Proxmox (proxmox/08), monitored end to end (sysops/06 + devops/08).
2. **Company private cloud** (proxmox/10) doubles as a portfolio piece and direct workplace value.

## Success criteria

- Every mission folder contains a complete README + GUIDE (or PLAYBOOK/TRACKER) with no placeholders.
- Guides are executable step-by-step with checkpoints; prove-it challenges have hints, not inline answers.
- Money folders each include an eligibility check and honest expectation-setting.
- The hub README shows a working progress dashboard the user can tick off.

## Out of scope

- Writing the actual mission content in this design (that is the implementation plan's job).
- Cloud-provider tracks (AWS/GCP) — may be added later as new folders.
- Any automation that violates platform ToS (fake reviews, spam, account farming, undisclosed AI where disclosure is required).
