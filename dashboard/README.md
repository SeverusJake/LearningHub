# Atelier — LearningHub Dashboard

A local reading room for the LearningHub repo: browse every mission, guide, playbook, and reference doc, track progress, star favorites, and tick off checklists — all loaded straight from the repo's markdown at dev/build time. No backend.

## Setup

```powershell
cd dashboard
npm install
npm run dev
```

Open the printed localhost URL. Content comes from the real `.md` files one level up — edit a guide and the page hot-reloads.

## What it does

- **Missions** — all 48 missions across sysops / devops / proxmox / money / gamedev, grouped by track, filterable by progress status and track, sortable, searchable (titles and full text).
- **Reader** — click a mission to read its README / GUIDE / PLAYBOOK / TRACKER as rendered markdown. `- [ ]` checklists are live: tick them and the state persists (localStorage). `<details>` hint blocks collapse as designed. "Copy start command" gives you the `start <track>/<NN>` line to paste into a Claude Code session.
- **Progress** — each mission cycles not started → in progress → done; track sections show completion counts.
- **Favorites / Recent / Reference** — starred missions, last 5 docs you read, and the shelf of track READMEs + platform manuals.
- **Theme** — warm light/dark, persisted, 400ms dimmer-switch transition.

All personal state (progress, stars, recents, checklist ticks, theme) lives in this browser's localStorage under `atelier.*` keys.
