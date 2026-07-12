# Game 04 — Word Bloom

**Track:** gamedev · **Engine:** Construct 3 · **Platform:** web + itch.io · **Monetization:** portal ads + itch PWYW · **Difficulty:** 💀💀 · **Time:** 2-4 days
**Prerequisites:** none

## Concept

A drag-to-connect word puzzle. The player drags across a grid (or wheel) of letters, connecting adjacent tiles to spell a word, then releases to submit it. A submitted word gets checked against a bundled dictionary: valid words score points and the tiles confirm with a highlight; invalid words clear back to nothing so the player can try again immediately. Levels raise the bar — more letters, longer required words, tighter time or move budgets — and a hint system lets a stuck player reveal a letter at a cost (an ad view on portal builds, an in-game cost on itch).

Word games are a deliberately safe genre pick for this slot in the track: the core loop (see a jumble, find the word, feel the small dopamine hit of a correct answer) has near-universal appeal across ages and platforms, needs no reflexes or twitch skill, and is the kind of game people play in five-minute bursts *and* half-hour sessions depending on mood — which is exactly the session-length flexibility that both ad-funded portals (more session time, more ad opportunities) and itch's browse-and-play crowd reward.

## AI does / You do

**AI does:** the full event-sheet design (every condition/action block spelled out phase-by-phase in GUIDE.md so you can build it directly in Construct's visual editor), the word-list curation and licensing research, the asset spec sheet and placeholder/AI-art prompts, the level-progression and hint-system logic, the portal SDK wiring instructions, and all store-listing/description copy for itch and the portal you submit to.

**You do:** everything only a human can click — creating your Construct 3, itch.io, and portal developer accounts; actually placing every event/condition/action block into the Construct editor (it's a visual tool, not a scriptable one — AI can hand you the exact recipe but can't operate the browser-based editor for you); testing the build in-browser at each checkpoint; verifying the word list's license before it ships; and running the real HTML5 export and upload. One account note before you scope content: **Construct 3's free plan caps you on event sheets/layouts and generally blocks exporting a finished HTML5 build** — check the current free-tier limits and export gate at construct.net before Phase 4, because you may need to upgrade to a paid plan just to get an exportable build out the door.

## Deliverables

- [ ] A letter grid with working drag-to-select word formation, validated live against a bundled word-list array
- [ ] Scoring, level progression, and a working hint system (reveal-a-letter, gated by ad view or in-game cost)
- [ ] A full asset pass — letter tiles, background, UI buttons, and SFX — replacing every placeholder
- [ ] The full dictionary word list loaded from a licensed, bundled file and used for validation (not just a small test subset)
- [ ] A working HTML5 export that runs correctly from a local static server
- [ ] Word Bloom playable on itch.io (HTML5, pay-what-you-want) and submitted to at least one web portal

## Start

Open a Claude Code session in this folder and say: `start gamedev/04`. Follow GUIDE.md.
