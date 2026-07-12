# Game 02 — Neon Runner

**Track:** gamedev · **Engine:** Phaser 3 (JavaScript/HTML5, via Vite) · **Platform:** web portals (CrazyGames/Poki) + itch.io · **Monetization:** portal ad revenue-share · **Difficulty:** 💀 · **Time:** 2-3 days
**Prerequisites:** none (Node.js)

## Concept

An auto-running endless runner: the world scrolls under a character that runs on its own, the player's only input is jump (tap or space) to clear obstacles that spawn on a timer, and the score is raw distance traveled. No levels to design, no branching logic, no save system — the entire game is one loop that gets harder the longer you survive.

This genre isn't a random starting pick. Endless runners are one of the most proven high-play-count categories on web portals: the rules fit in one sentence, a session lasts thirty seconds to a few minutes, and "one more try" is built into the death-and-restart loop — exactly the session shape that ad-revenue-share portals like CrazyGames and Poki are built around monetizing. It's also the first HTML5/JS game in this track, which means this mission is where you build the Phaser/Vite/portal-SDK muscle memory that games 04 and 07 reuse.

## AI does / You do

**AI does:**
- All Phaser 3 scene code — the auto-run loop, jump physics, obstacle spawner, difficulty ramp, death/restart flow
- Gameplay tuning (run speed, jump velocity, spawn intervals, ramp curve)
- CrazyGames SDK integration — init, gameplay start/stop events, ad calls at the correct moments
- Placeholder art and audio (colored rectangles, generated tones) so the loop is playable before any final asset exists
- The Vite build configuration and the HTML5 export/zip steps

**You do:**
- Install Node.js
- Create an itch.io account and a CrazyGames (or Poki/GameDistribution) developer account
- Generate or source the final art and audio assets from the Phase 3 spec sheet (AI-generated finals, or a Kenney/OpenGameArt fallback)
- Run the actual build, unzip-test it locally, upload the zip to itch.io, and click submit on the portal dashboard

## Deliverables

- [ ] A working endless-runner loop: auto-run, jump-to-dodge, procedural obstacle spawning, distance score
- [ ] A difficulty ramp (speed increases with survival time) and a death + restart screen
- [ ] Final art/audio swapped in against the Phase 3 spec sheet, no placeholder rectangles left in the shipped build
- [ ] CrazyGames SDK wired in — init, gameplay start/stop events, ad call on death — with no ad SDK of your own added anywhere in the portal build
- [ ] A production HTML5 build (`vite build`), zipped, verified running from a static server before upload
- [ ] Published on itch.io + submitted to at least one portal (CrazyGames or GameDistribution)

## Start

Open a Claude Code session in this folder and say: `start gamedev/02`. Follow GUIDE.md.
