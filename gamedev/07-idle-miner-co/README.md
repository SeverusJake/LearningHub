# Game 07 — Idle Miner Co

**Track:** gamedev · **Engine:** JavaScript + PixiJS (PWA) · **Platform:** web + Google Play (TWA) · **Monetization:** ads + optional IAP · **Difficulty:** 💀💀💀 · **Time:** 1-2 weeks · **Prerequisites:** Game 02 (JS/web build familiarity)

## Concept

Idle Miner Co is an incremental/idle management game: you own a mine, buy generators (miners, drills, elevators) that produce resources automatically, spend the proceeds on upgrades and more generators, and watch numbers climb — including while the game is closed, via offline progress. Once growth stalls you *prestige*: reset for a permanent multiplier that makes the next run faster. Idle games have some of the best retention in mobile because the core loop rewards checking in repeatedly, and they ship the same HTML5 build to the web and — via a Trusted Web Activity (TWA) wrapper — to Google Play, so one codebase reaches two storefronts.

## AI does / What you do

**AI does:** all the JavaScript — the incremental economy, generators and cost curves, the tick loop, offline-progress math, the prestige layer, the PixiJS rendering, the PWA manifest + service worker, and the Bubblewrap TWA config; the asset spec sheet; the store copy.

**You do:** install Node, create/verify a Google Play account (Game 03's reference doc), buy a domain and deploy the web build (reusing your DevOps/money-03 Cloudflare skills), generate final art, run the Bubblewrap build, and publish the web PWA + the Play AAB.

## Deliverables

- [ ] An incremental core: generators with exponential cost curves, a tick loop, and clamped offline-progress on load, saved to localStorage
- [ ] A prestige/reset layer granting a permanent multiplier
- [ ] A PixiJS UI render/update loop
- [ ] A complete asset spec sheet with AI-generated finals over placeholders
- [ ] A PWA (manifest + service worker) that's installable, wrapped into a Play AAB via Bubblewrap
- [ ] The game live as a web PWA at a public URL **and** the AAB in Play internal testing

## Start

Open a Claude Code session in this folder and say: `start gamedev/07`. Follow `GUIDE.md`.
