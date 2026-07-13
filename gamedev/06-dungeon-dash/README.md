# Game 06 — Dungeon Dash

**Track:** gamedev · **Engine:** Unity (C#) · **Platform:** itch.io + Steam demo · **Monetization:** premium + free demo · **Difficulty:** 💀💀💀 · **Time:** 1-2 weeks · **Prerequisites:** Game 03 (Unity familiarity)

## Concept

Dungeon Dash is a top-down roguelike dungeon crawler. Each run drops you into a freshly generated dungeon of connected rooms, you fight your way through enemies floor by floor picking up loot and upgrades, and when you die the run is over — permadeath, start again on a brand-new layout. The appeal is replayability: procedural generation plus permadeath means no two runs are the same, and players who like the genre sink dozens of hours into "one more run." That replay value is what makes roguelikes a viable **premium** (paid) purchase rather than an ad-funded one — the audience expects to pay for a game they'll replay, and a free first-floor demo is the standard, effective way to convert them.

## AI does / What you do

**AI does:** all the C# — procedural dungeon generation, top-down movement, enemy AI, the combat system, the run/permadeath loop, loot and upgrades, the demo-vs-full content gate, and the build configuration; the full asset spec sheet with generation prompts; the itch.io store copy draft.

**You do:** install Unity (guided in Game 03), create and verify your itch.io account, generate final art with an AI tool and swap it in, run the two builds locally, judge whether the game actually feels good to play, and upload the paid build + free demo to itch.io.

## Deliverables

- [ ] A Unity project with procedural room+corridor dungeon generation, top-down movement, enemy AI (chase + attack), and an HP/damage combat system
- [ ] Floors that chain into a run, loot/upgrade pickups, and a permadeath loop with win/lose screens
- [ ] A complete asset spec sheet with AI-generated finals swapped in over placeholders
- [ ] Two distinct builds: a free demo (first floor only) and the full paid game
- [ ] A standalone Windows build confirmed running outside the editor
- [ ] A paid build and a free demo build both live on itch.io

## Start

Open a Claude Code session in this folder and say: `start gamedev/06`. Follow `GUIDE.md`.
