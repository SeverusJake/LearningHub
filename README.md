# LearningHub

## What this is

LearningHub is a do-first learning hub, not a curriculum you read. It has four tracks — `sysops/`, `devops/`, `proxmox/`, and `money/` — each broken into ordered "missions": hands-on projects you build for real, worked inside Claude Code sessions with an AI pairing live at your side. The Markdown files in this repo are the map and the fallback — the how-to-use workflow below is the how-to-use workflow, but the actual learning happens in the terminal, in a VM, or in a live account, not on this page.

## Map

| Track | What it is | Link |
|---|---|---|
| sysops | On-PC Hyper-V lab — build a full Linux server estate from bare metal to a hardened, monitored, backed-up mini-company, solo. | [sysops/](sysops/) |
| devops | One real application (`shiplog`) taken through the full lifecycle: git, containers, CI/CD, Kubernetes, IaC, GitOps, observability, chaos engineering. | [devops/](devops/) |
| proxmox | The company Proxmox cluster (3+ nodes, real admin access) — templates, IaC, storage, HA, SDN, Kubernetes, monitoring, and a self-service private cloud. | [proxmox/](proxmox/) |
| money | Eight AI-leveraged income experiments, ranked by speed to first dollar, run under a strict compliance floor. | [money/](money/) |
| gamedev | Ship ten small commercial games across Godot, Unity, and web engines to Google Play, Steam, web portals, and itch.io — AI does 90-95%. | [gamedev/](gamedev/) |
| capstones | Cross-track final projects that stitch the other three tracks together into one deployed, observable system. | [capstones/](capstones/) |

## How to use

1. Open a Claude Code session with this repo as the working directory, inside the mission folder you're about to run (e.g. `sysops/03-storage-wars/`).
2. Say `start <track>/<NN>` (e.g. `start sysops/03`) to kick off the mission.
3. Follow that mission's `GUIDE.md`. Guides are not scripts to paste — they adapt live in-session: the AI adjusts steps to what your environment actually shows, walks you through break-fix drills interactively, and only gives hints for prove-it challenges when you ask.
4. Before starting any mission, take a snapshot of the VM(s) or cluster state you're about to touch. Every mission assumes you can roll back to a known-good point — sysops and devops missions snapshot Hyper-V checkpoints, proxmox missions snapshot/back up the affected VMs or `/etc/pve` config, per that track's safety rules.

## Progress dashboard

### sysops

- [ ] 01 Lab Forge — [sysops/01-lab-forge/](sysops/01-lab-forge/)
- [ ] 02 Linux Deep Core — [sysops/02-linux-deep-core/](sysops/02-linux-deep-core/)
- [ ] 03 Storage Wars — [sysops/03-storage-wars/](sysops/03-storage-wars/)
- [ ] 04 Network Fortress — [sysops/04-network-fortress/](sysops/04-network-fortress/)
- [ ] 05 Service Citadel — [sysops/05-service-citadel/](sysops/05-service-citadel/)
- [ ] 06 All-Seeing Eye — [sysops/06-all-seeing-eye/](sysops/06-all-seeing-eye/)
- [ ] 07 Doomsday Drill — [sysops/07-doomsday-drill/](sysops/07-doomsday-drill/)
- [ ] 08 Hardening — [sysops/08-hardening/](sysops/08-hardening/)
- [ ] 09 Automation — [sysops/09-automation/](sysops/09-automation/)
- [ ] 10 Capstone: MiniCorp — [sysops/10-capstone-minicorp/](sysops/10-capstone-minicorp/)

### devops

- [ ] 01 Git Mastery — [devops/01-git-mastery/](devops/01-git-mastery/)
- [ ] 02 Docker Deep — [devops/02-docker-deep/](devops/02-docker-deep/)
- [ ] 03 CI/CD Forge — [devops/03-cicd-forge/](devops/03-cicd-forge/)
- [ ] 04 K8s Core — [devops/04-k8s-core/](devops/04-k8s-core/)
- [ ] 05 K8s Advanced — [devops/05-k8s-advanced/](devops/05-k8s-advanced/)
- [ ] 06 IaC — [devops/06-iac/](devops/06-iac/)
- [ ] 07 GitOps — [devops/07-gitops/](devops/07-gitops/)
- [ ] 08 Observability — [devops/08-observability/](devops/08-observability/)
- [ ] 09 Chaos + SRE — [devops/09-chaos-sre/](devops/09-chaos-sre/)
- [ ] 10 Capstone: Zero-to-Prod — [devops/10-capstone-zero-to-prod/](devops/10-capstone-zero-to-prod/)

### proxmox

- [ ] 01 Recon + Safety Rails — [proxmox/01-recon-safety-rails/](proxmox/01-recon-safety-rails/)
- [ ] 02 Template Factory — [proxmox/02-template-factory/](proxmox/02-template-factory/)
- [ ] 03 IaC on Proxmox — [proxmox/03-iac-on-proxmox/](proxmox/03-iac-on-proxmox/)
- [ ] 04 Storage Deep — [proxmox/04-storage-deep/](proxmox/04-storage-deep/)
- [ ] 05 PBS — [proxmox/05-pbs/](proxmox/05-pbs/)
- [ ] 06 HA + Cluster — [proxmox/06-ha-cluster/](proxmox/06-ha-cluster/)
- [ ] 07 SDN — [proxmox/07-sdn/](proxmox/07-sdn/)
- [ ] 08 K8s on Proxmox — [proxmox/08-k8s-on-proxmox/](proxmox/08-k8s-on-proxmox/)
- [ ] 09 Cluster Watchtower — [proxmox/09-cluster-watchtower/](proxmox/09-cluster-watchtower/)
- [ ] 10 Capstone: Private Cloud — [proxmox/10-capstone-private-cloud/](proxmox/10-capstone-private-cloud/)

### money

- [ ] 01 freelance-gigs — [money/01-freelance-gigs/](money/01-freelance-gigs/)
- [ ] 02 biz-websites — [money/02-biz-websites/](money/02-biz-websites/)
- [ ] 03 micro-tools — [money/03-micro-tools/](money/03-micro-tools/)
- [ ] 04 gumroad-products — [money/04-gumroad-products/](money/04-gumroad-products/)
- [ ] 05 stock-assets — [money/05-stock-assets/](money/05-stock-assets/)
- [ ] 06 pod-merch — [money/06-pod-merch/](money/06-pod-merch/)
- [ ] 07 kdp-books — [money/07-kdp-books/](money/07-kdp-books/)
- [ ] 08 seo-affiliate-site — [money/08-seo-affiliate-site/](money/08-seo-affiliate-site/)

### gamedev

- [ ] 01 Tap Tower — [gamedev/01-tap-tower/](gamedev/01-tap-tower/)
- [ ] 02 Neon Runner — [gamedev/02-neon-runner/](gamedev/02-neon-runner/)
- [ ] 03 Merge Critters — [gamedev/03-merge-critters/](gamedev/03-merge-critters/)
- [ ] 04 Word Bloom — [gamedev/04-word-bloom/](gamedev/04-word-bloom/)
- [ ] 05 Blockfall — [gamedev/05-blockfall/](gamedev/05-blockfall/)
- [ ] 06 Dungeon Dash — [gamedev/06-dungeon-dash/](gamedev/06-dungeon-dash/)
- [ ] 07 Idle Miner Co — [gamedev/07-idle-miner-co/](gamedev/07-idle-miner-co/)
- [ ] 08 Tower Siege — [gamedev/08-tower-siege/](gamedev/08-tower-siege/)
- [ ] 09 Card Forge — [gamedev/09-card-forge/](gamedev/09-card-forge/)
- [ ] 10 Capstone: Pixel Quest — [gamedev/10-capstone-pixel-quest/](gamedev/10-capstone-pixel-quest/)

## Ground rules

**Learning tracks (sysops, devops, proxmox):** no copy-paste without passing the checkpoint that proves you understand what you just ran — every guide phase ends in a verification step, and you don't move on until it passes for the right reason, not by luck. Break-fix drills are mandatory, not optional bonus content: they are where the actual skill gets built, and skipping them defeats the point of the track.

**Money track:** compliance floor for every experiment — no fake reviews, no spam, no undisclosed AI where a platform requires disclosure, no IP infringement, and income is never guaranteed. Full rules, eligibility checks, and honest expectations live in [money/README.md](money/README.md).
