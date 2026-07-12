# Game 05 — Blockfall

**Track:** gamedev · **Engine:** Godot 4 · **Platform:** Google Play · **Monetization:** rewarded + banner (LevelPlay mediation) · **Difficulty:** 💀💀💀 · **Time:** 4-6 days · **Prerequisites:** Game 01 (Godot mobile setup)

## Concept

Blockfall is a match-3 puzzle: an 8x8 grid of colored gems where the player swaps two adjacent gems, and any swap that lines up 3 or more gems of the same color in a row or column clears them. Gems above the cleared cells fall to fill the gap (gravity), new gems drop in from the top to refill the board, and if that refill happens to create another match, it clears too — that chain reaction is a combo/cascade, and cascades are the main scoring lever in the genre, not the initial swap.

Match-3 is one of the most durable mobile-monetizing genres that exists. A level runs 1-3 minutes, which keeps session length short and repeatable; the genre naturally supports a moves-limited or lives-limited structure, so a level can genuinely be lost; and losing with moves left on the table is exactly the moment a rewarded "continue" ad slots in without reading as a paywall — the player is choosing to trade 30 seconds of ad time for a real shot at finishing, not being blocked from playing. Franchises built on this exact loop have stayed at or near the top of mobile grossing charts for over a decade, which is stronger evidence for the loop's monetization durability than almost any other genre in this track.

## AI does / You do

**AI does:** the entire grid engine (GDScript in GUIDE.md), match/gravity/refill/combo logic, level objectives and the moves-limited win/lose state, tween-based juice on clears, the LevelPlay mediation wiring, the full asset spec sheet plus AI-generation prompts for every gem/frame/particle/SFX/bgm asset, and the Play Store listing copy.

**You do:** judging whether the AI-generated gem art actually reads as 6 distinct, legible colors at real phone size (not just in the editor), creating and verifying your own Play Console and LevelPlay/AdMob accounts, linking those accounts and accepting their terms yourself, testing the real rewarded-ad flow on a real or emulated device before you trust it, and clicking submit on closed testing.

## Deliverables

- [ ] Godot 4 project with an 8x8 grid, adjacent-swap input, line-scan match detection (full row + column scan, so L/T-shaped clusters clear correctly), clear + gravity + refill, and combo/cascade scoring
- [ ] At least 3 levels, each with a named objective (score target or clear-N-of-a-color) and a moves-limited fail state
- [ ] Tween-based juice on every clear (scale-pop + particle burst) plus a match SFX and a looping bgm
- [ ] A complete asset spec sheet (6 gem colors, board frame, clear particle, match SFX, bgm loop) with AI-generated finals swapped in over the placeholder shapes
- [ ] AdMob banner + rewarded "continue" ad wired through LevelPlay mediation, verified working in test mode
- [ ] A signed `.aab` uploaded to Google Play closed testing with the mediated ads live in that build

## Start

Open a Claude Code session in this folder and say: `start gamedev/05`. Follow `GUIDE.md`.
