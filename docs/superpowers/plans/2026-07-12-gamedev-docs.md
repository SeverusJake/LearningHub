# GameDev Track Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the complete `gamedev/` track: track README + TRACKER, five reference docs (assets pipeline + four platform/monetization manuals), ten game mission folders (README + GUIDE each), and a hub README update adding the track.

**Architecture:** Pure-documentation. Each task produces one self-contained folder or file of Markdown, verified against placeholder and structure checks, then committed. Shared reference docs (Task 2–7) come before the game missions because every mission GUIDE links back to them.

**Tech Stack (referenced by the docs):** Godot 4 (GDScript), Unity 6 LTS (C#), Phaser 3 + PixiJS + Construct 3 (JavaScript/HTML5), Android AAB/Google Play Console, Steamworks/SteamPipe, itch.io, CrazyGames/Poki/GameDistribution portal SDKs, AdMob + Unity LevelPlay mediation.

## Global Constraints

Apply to EVERY task. Implicitly included in every task's requirements.

**Spec:** `docs/superpowers/specs/2026-07-12-gamedev-design.md` — the approved design. Do not contradict it.

**Audience/voice:** Advanced IT user, new to game engines. Plain, direct English, no hype, no filler. Every command/config in a fenced code block with expected output or a success indicator. Windows host commands in PowerShell; engine/CLI commands labeled with where they run.

**Banned patterns (plan failure if present in any produced doc):** `TBD`, `TODO`, `FIXME`, "coming soon", "left as an exercise" (except inside a deliberate ship-it/prove-it challenge), the literal phrase "fill in", empty sections, dead relative links.

**Honest-economics rule:** every game README states its monetization model and a realistic revenue expectation as a range with no guarantee. The track README carries the full lottery-shaped-economics framing from the spec. No doc promises income.

**Compliance floor (every game + platform doc):** honest store listings; no cloned trademarked IP or ripped assets; original or properly-licensed assets only; respect each store's and ad network's policies (age rating/COPPA where kid-directed); disclose AI-generated content where a store requires it; taxes are the user's responsibility (not tax advice).

**Mission README.md template (games):**

```markdown
# Game NN — <Title>

**Track:** gamedev · **Engine:** <engine> · **Platform:** <target> · **Monetization:** <model>
**Difficulty:** 💀..💀💀💀💀💀 · **Time:** <estimate> · **Prerequisites:** <games/reference docs or "none">

## Concept
<2-4 sentences: what the game is, why this genre sells / completes well solo>

## What AI does / What you do
<two short bullet lists — the 90-95% vs manual split for THIS game>

## Deliverables
<checklist ending in the ship-it: the game is actually live on its target platform>

## Start
Open a Claude Code session in this folder and say: `start gamedev/NN`. Follow GUIDE.md.
```

**Mission GUIDE.md template (games):**

```markdown
# Guide — Game NN: <Title>

## Phase 0 — Setup check
<engine installed + verified; account/reference-doc pointers for the target platform>

## Phase 1..N — <phase name>
<numbered steps, exact code/scene instructions, each phase ends with a **Checkpoint:**
(a runnable state that proves the phase worked — "the cube falls and lands", "an ad loads in test mode")>

## Asset spec sheet
<a table: TYPE | filename/path | exact dimensions+format | description | free-licensed fallback.
Placeholders (solid-color/programmer-art or an AI prompt) ship first so the game runs;
the user swaps AI-generated finals in at the same paths before publish.>

## Monetization integration
<the ad/premium setup for THIS game, linking to reference/monetization-ads.md and the platform doc>

## Ship-it challenge
<the manual publish path: build locally, create/verify the account via the reference doc,
upload, submit, go live. Acceptance = the game is reachable/buyable on its platform.>

## Break-fix drills
<numbered engine/build/store gotchas the user diagnoses; no inline solutions>

## Hints
<details><summary>Hints (open only when stuck)</summary>
one short nudge per drill/challenge
</details>

## Done when
<checklist mirroring README deliverables, ending in "the game is live">
```

**Verification (every task):** from repo root, `git grep --no-index -nE "TBD|TODO|FIXME|coming soon|fill in" -- <task path>` returns nothing (reword any legitimate use), and every produced file has all template sections non-empty.

**Commit style:** one commit per task, message given in the task, ending with:
```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

---

### Task 1: Track README + TRACKER

**Files:**
- Create: `gamedev/README.md`, `gamedev/TRACKER.md`

**Interfaces:**
- Produces: the 10-game table, engine-install matrix, and honest-economics framing every mission and reference doc points back to.

- [ ] **Step 1: Write `gamedev/README.md`** — sections: (1) Track goal (ship 10 small commercial games across engines/platforms, AI does 90-95%). (2) **Honest economics** — the full lottery-shaped framing from the spec: most indie games earn <$100 lifetime; win on portfolio+learning; hyper-casual+ads = highest-probability small revenue; web portals = fastest first payout; itch = lowest friction; Steam = premium/graduation platform at $100/game; month-1 near $0; no guarantee. (3) The 10-game table from the spec (#, title, genre, engine, platform, monetization, difficulty). (4) Engine-install matrix — a table: engine → download URL + install-check command (Godot 4, Unity 6 LTS via Unity Hub, Node.js for Phaser/PixiJS, Construct 3 browser, Android Studio/SDK, Git). (5) Progression — 01 first (simplest), web games (02/04/07) share a stack, Steam games (06/08/09/10) last; reference docs to read before first publish. (6) Budget note — $125 = Play $25 + one Steam $100; web/itch free. (7) Compliance floor + link to `../money/README.md`.
- [ ] **Step 2: Write `gamedev/TRACKER.md`** — a table `| Game | Engine | Platform | Status | Hours | Revenue | Ad network | Notes |` with the 10 games pre-listed as rows, status column starting "not started"; a "Weekly review" section with 5 fixed questions (games shipped? which platform paying? downloads/plays? ad revenue trend? next game to build?).
- [ ] **Step 3: Verify** per Global Constraints. **Step 4: Commit:** `docs(gamedev): add track README and tracker`

### Task 2: reference/assets-pipeline.md

**Files:**
- Create: `gamedev/reference/assets-pipeline.md`

**Interfaces:**
- Produces: the asset spec-sheet format and the AI-generate-then-swap workflow every game GUIDE reuses.

- [ ] **Step 1: Write the doc** — sections: (1) Principle — build art-last: mechanics against placeholders first, finals before publish. (2) The spec-sheet format (the `TYPE | path | dimensions+format | description | fallback` table, with the example from the spec). (3) Placeholder strategy — three tiers: solid-color/programmer-art rectangles (give a Godot + a Phaser snippet drawing a colored rect as a stand-in sprite), free-licensed packs (Kenney.nl, OpenGameArt, Google Fonts — with licensing notes), and AI-generated. (4) AI asset generation — concrete prompt patterns for sprites (transparent PNG, consistent style, sprite-sheet framing), backgrounds, UI, icons; music (loopable chiptune/ambient, length, bpm); SFX (short, UI/impact). Name current tool categories (text-to-image, text-to-music, SFX generators) generically without over-claiming specific product features. (5) Swap procedure — same filename/path, re-import in engine, keep power-of-two sizes, mobile texture-size caps. (6) Store-asset specs pointer (icons/screenshots/capsules live in the platform docs). (7) A note on disclosing AI-generated assets where a store requires it.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(gamedev): add assets pipeline reference`

### Task 3: reference/platform-google-play.md

**Files:**
- Create: `gamedev/reference/platform-google-play.md`

- [ ] **Step 1: Write the doc** — a complete first-timer manual: (1) Create a Google Play Console developer account — $25 one-time fee, personal vs organization account, the identity verification + address/phone realities, and the current developer-verification requirements. (2) Prerequisites — an app signing/upload key: give the `keytool` command to generate an upload keystore and the Play App Signing explanation. (3) Build an AAB — generic steps that each engine's GUIDE plugs into (Godot Android export template + keystore config; Unity Android build settings + IL2CPP/AAB); give the Godot export-preset key fields and the Unity Player Settings key fields. (4) Create the app in Console — store listing (title/short/full description, exact character limits), graphic assets and their **exact dimensions** (icon 512×512, feature graphic 1024×500, phone screenshots), content rating questionnaire, data-safety form, target-audience/COPPA. (5) Testing ladder — internal → closed (the 12-testers-for-14-days requirement for new personal accounts) → open → production, with the rollout %. (6) Payments/payout setup for paid apps/ads. (7) Common rejection reasons. Every step is a numbered action with what the user clicks/sees.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(gamedev): add google play platform reference`

### Task 4: reference/platform-steam.md

**Files:**
- Create: `gamedev/reference/platform-steam.md`

- [ ] **Step 1: Write the doc** — (1) Steamworks account + the Steam Direct $100 recoupable app fee **per title**, and the tax/bank/identity paperwork (Steam Direct onboarding, W-8BEN for non-US). (2) Create an app, get the AppID. (3) SteamPipe build upload — the `content builder` / `steamcmd` app-build VDF concept, depots, a minimal build script example. (4) Store page — all required assets with **exact dimensions** (header capsule 460×215, main capsule 616×353, library assets, screenshots, trailer), description, tags, and why they matter for discovery. (5) Wishlists — why they drive the launch algorithm, the "coming soon" page, building wishlists pre-launch. (6) Review/approval, build submission, release-day mechanics, the 30-day-after-store-page rule. (7) Payout thresholds and revenue share (Steam's 30%). Numbered, first-timer level.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(gamedev): add steam platform reference`

### Task 5: reference/platform-web-portals.md

**Files:**
- Create: `gamedev/reference/platform-web-portals.md`

- [ ] **Step 1: Write the doc** — (1) itch.io — free account, uploading an HTML5 game (zip with index.html), the "pay what you want"/paid/free options, embedding, payout via PayPal/Stripe and thresholds; the fastest "it's live" win. (2) CrazyGames — account, the CrazyGames SDK requirements (ad calls, the QA checklist), submission + review, revenue share, payout. (3) Poki — application-gated (honest note it's not open-signup), the Poki SDK, the Inspector tool, revenue share. (4) GameDistribution — open signup, its SDK, how it syndicates to many portals, revenue share. (5) A comparison table: portal | open-signup? | SDK required | revenue model | payout method | payout threshold. (6) The rule that portal games must NOT include your own ad SDK (the portal serves ads and shares revenue) — a common rejection cause. (7) HTML5 export notes shared by the web-engine games.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(gamedev): add web portals platform reference`

### Task 6: reference/monetization-ads.md

**Files:**
- Create: `gamedev/reference/monetization-ads.md`

- [ ] **Step 1: Write the doc** — (1) Ad models — banner / interstitial / rewarded video, with a table of which genre each fits and typical placement rules (no interstitial mid-gameplay, rewarded = opt-in for a benefit). (2) AdMob (mobile) — create an AdMob account, link it to Play, ad unit IDs, **always use test ad unit IDs during development** (give Google's public test IDs), the Godot AdMob plugin path and the Unity Google Mobile Ads SDK path. (3) Mediation — Unity LevelPlay/ironSource concept and why mediation raises fill/eCPM; a short setup outline. (4) Consent/privacy — GDPR + the UMP/consent SDK, ATT on iOS (noted), COPPA tagging for kid-directed apps and how it limits ad personalization. (5) Ad content rating in the store. (6) Web-portal ads — you do NOT add your own; the portal SDK handles it and shares revenue (link to the portals doc). (7) IAP — mentioned briefly (consumables/remove-ads) with the note that ads are this track's primary model. (8) A realistic eCPM/revenue expectation paragraph — cents per install territory, volume-driven, no guarantee.
- [ ] **Step 2: Verify. Step 3: Commit:** `docs(gamedev): add ads monetization reference`

### Task 7: Game 01 — Tap Tower (Godot 4, Play, AdMob)

**Files:**
- Create: `gamedev/01-tap-tower/README.md`, `gamedev/01-tap-tower/GUIDE.md`

**Interfaces:**
- Consumes: `reference/assets-pipeline.md`, `reference/platform-google-play.md`, `reference/monetization-ads.md`.

- [ ] **Step 1: Write README** per template. Engine Godot 4, Platform Google Play, Monetization AdMob banner + interstitial. Difficulty 💀. Time 1-2 days. Deliverables end in: the game live in Play internal/closed testing with a test ad showing.
- [ ] **Step 2: Write GUIDE** — Phase 0 install Godot 4 + Android export templates + JDK/SDK (link the Play doc). Phase 1 project + a one-tap stacker mechanic: a block slides horizontally, tap drops it, overlap trims the next block, miss = game over (give the full GDScript for the block controller + score). Phase 2 UI (score label, restart), difficulty ramp (speed increases per block). Phase 3 the asset spec sheet (block sprite 128×128, bg, tap SFX, bgm — with placeholders and a Kenney fallback). Phase 4 AdMob integration via the Godot admob plugin — banner during play, interstitial on game-over, **test ad IDs** (link ads doc). Phase 5 Android export + keystore + AAB (link Play doc). Ship-it: create the Play app, upload the AAB to internal testing, confirm it installs on a device with a test ad. Break-fix drills: (1) export fails — missing export templates/SDK path. (2) black screen on device — wrong renderer for mobile (Compatibility). (3) ad never loads — using real ID / not initialized. Hints collapsed. Done-when checklist.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 01 tap-tower`

### Task 8: Game 02 — Neon Runner (Phaser 3, web portals)

**Files:**
- Create: `gamedev/02-neon-runner/README.md`, `gamedev/02-neon-runner/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Phaser 3 (JS/HTML5), Platform web portals (CrazyGames/Poki), Monetization portal ad revenue-share. Difficulty 💀. Time 2-3 days. Deliverables end in: game published on itch.io and submitted to at least one portal.
- [ ] **Step 2: Write GUIDE** — Phase 0 Node.js + a Phaser project (Vite template, give the setup commands). Phase 1 endless-runner core: auto-run, jump on tap/space, procedural obstacle spawning, ground collision, score-by-distance (give the full Phaser scene JS: preload/create/update, physics arcade). Phase 2 difficulty ramp (speed up over time), death + restart. Phase 3 asset spec sheet (player sprite-sheet 64×64×run frames, obstacle, parallax bg, jump SFX, bgm loop — placeholders + Kenney fallback). Phase 4 the CrazyGames SDK: init, call the ad on death per their rules, gameplay-start/stop events (link portals doc); note NO own ad SDK. Phase 5 HTML5 build (`vite build`), zip, test locally. Ship-it: upload the zip to itch.io as an HTML5 game (playable in-browser), then submit to CrazyGames/GameDistribution via the portals doc. Break-fix drills: (1) game runs in dev but blank in the itch iframe — base-path/asset-path issue in the build. (2) portal rejects — own ads present or missing SDK calls. (3) mobile touch not working — pointer vs keyboard input. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 02 neon-runner`

### Task 9: Game 03 — Merge Critters (Unity, Play, rewarded ads)

**Files:**
- Create: `gamedev/03-merge-critters/README.md`, `gamedev/03-merge-critters/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Unity (C#), Platform Google Play, Monetization rewarded video + interstitial. Difficulty 💀💀. Time 3-5 days. Deliverables end in: game in Play closed testing with rewarded ads working in test mode.
- [ ] **Step 2: Write GUIDE** — Phase 0 Unity Hub + Unity 6 LTS + Android module (link Play doc). Phase 1 merge mechanic: a grid, drag two same-level critters together to merge into the next level, spawn new ones on a timer, currency on merge (give the C# scripts: GridManager, DraggableItem, MergeLogic). Phase 2 save/load (PlayerPrefs or JSON), a shop/spawn-cost loop. Phase 3 asset spec sheet (critter sprites at each tier 256×256, grid cell, coin, UI — placeholders + fallback). Phase 4 Unity Ads/LevelPlay: rewarded video for bonus currency/speed-up, interstitial between sessions, **test mode on** (link ads doc). Phase 5 Android AAB build via Unity (link Play doc). Ship-it: Play closed testing upload, verify rewarded ad grants the reward on a device. Break-fix drills: (1) Gradle build fails — SDK/NDK version mismatch. (2) rewarded callback never fires — not subscribing to the completion event. (3) merged items desync from save — saving before the merge resolves. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 03 merge-critters`

### Task 10: Game 04 — Word Bloom (Construct 3, web + itch)

**Files:**
- Create: `gamedev/04-word-bloom/README.md`, `gamedev/04-word-bloom/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Construct 3 (event sheets, low-code), Platform web + itch.io, Monetization portal ads + itch pay-what-you-want. Difficulty 💀💀. Time 2-4 days. Deliverables end in: playable on itch.io + submitted to a portal.
- [ ] **Step 2: Write GUIDE** — Phase 0 Construct 3 in the browser (free tier limits noted, when the paid tier is needed for export). Phase 1 word-puzzle core built with event sheets: a letter grid/wheel, drag to form words, validate against a bundled word list (give the JSON word-list approach + the event-sheet logic described block-by-block since Construct is visual — describe each event/condition/action precisely). Phase 2 scoring, level progression, a hint system. Phase 3 asset spec sheet (letter tiles, background, UI, SFX — placeholders + fallback; note Construct's built-in sprite editor). Phase 4 the word list — a bundled dictionary file and how to load it; licensing note on word lists. Phase 5 HTML5 export from Construct. Ship-it: itch.io HTML5 upload (pay-what-you-want) + a portal submission. Monetization note: portal SDK integration in Construct via the browser/SDK plugin. Break-fix drills: (1) export requires the paid tier — the free-tier limit. (2) word validation rejects valid words — case/whitespace in the list. (3) large word-list slows load — preload strategy. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 04 word-bloom`

### Task 11: Game 05 — Blockfall (Godot 4, Play, mediation)

**Files:**
- Create: `gamedev/05-blockfall/README.md`, `gamedev/05-blockfall/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Godot 4, Platform Google Play, Monetization rewarded + banner with LevelPlay mediation. Difficulty 💀💀💀. Time 4-6 days. Deliverables end in: Play closed testing with mediated ads.
- [ ] **Step 2: Write GUIDE** — Phase 0 Godot 4 mobile (assumes game 01 setup). Phase 1 falling-block match mechanic: a grid, blocks fall, swap adjacent to make matches of 3+, gravity refill, combo scoring (give the full GDScript: grid model, match detection flood-fill, gravity/refill, input). Phase 2 levels/objectives, a moves-limited mode, juice (tween pops). Phase 3 asset spec sheet (gem sprites ×6 colors 128×128, board, particles, match SFX, bgm — placeholders + fallback). Phase 4 mediation — AdMob as the base network plus LevelPlay mediation concept, rewarded "continue" on loss + banner (link ads doc, test IDs). Phase 5 AAB + closed testing (link Play doc). Ship-it: closed testing upload, verify the "continue" rewarded ad. Break-fix drills: (1) match detection misses L/T shapes — flood-fill vs line-only. (2) refill deadlocks with no moves — no shuffle-on-no-moves. (3) mediation shows no ads — adapter not installed / no test mode. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 05 blockfall`

### Task 12: Game 06 — Dungeon Dash (Unity, itch + Steam demo)

**Files:**
- Create: `gamedev/06-dungeon-dash/README.md`, `gamedev/06-dungeon-dash/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Unity (C#), Platform itch.io + a Steam demo, Monetization premium (paid) + free demo. Difficulty 💀💀💀. Time 1-2 weeks. Deliverables end in: a paid build on itch.io + a free demo build.
- [ ] **Step 2: Write GUIDE** — Phase 0 Unity 2D. Phase 1 roguelike core: procedural room/dungeon generation, top-down movement, melee/ranged combat, enemy AI (chase + attack), HP/damage (give the C# scripts: DungeonGenerator, PlayerController, EnemyAI, CombatSystem). Phase 2 rooms → floors, loot/upgrades, permadeath run loop, a win/lose screen. Phase 3 asset spec sheet (player + enemy sprite-sheets, tileset 32×32, items, UI, hit SFX, dungeon bgm — placeholders + Kenney fallback). Phase 4 build a free **demo** slice (first floor) vs the full paid build — how to gate content. Phase 5 desktop builds (Windows) from Unity. Ship-it: upload the paid build to itch.io with a price, upload the free demo; note the Steam page comes in game 09/10. Break-fix drills: (1) generation makes disconnected rooms — no corridor pass. (2) enemies clip through walls — missing collider/nav. (3) itch build won't launch — missing Mono/data folder in the zip. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 06 dungeon-dash`

### Task 13: Game 07 — Idle Miner Co (JS + PixiJS PWA, web + Play TWA)

**Files:**
- Create: `gamedev/07-idle-miner-co/README.md`, `gamedev/07-idle-miner-co/GUIDE.md`

- [ ] **Step 1: Write README.** Engine JavaScript + PixiJS (PWA), Platform web + Google Play via TWA wrapper, Monetization ads + optional IAP. Difficulty 💀💀💀. Time 1-2 weeks. Deliverables end in: live as a web PWA + wrapped into a Play AAB via TWA.
- [ ] **Step 2: Write GUIDE** — Phase 0 Node.js + a PixiJS + Vite project. Phase 1 incremental core: resource generators, exponential cost curves, a tick loop, offline-progress calculation on load (give the JS: game-state model, generator/upgrade logic, the big-number handling, save to localStorage). Phase 2 prestige/reset layer, UI with PixiJS (give the render/update loop). Phase 3 asset spec sheet (mine/worker sprites, icons, bg, UI — placeholders + fallback). Phase 4 PWA — manifest.json + a service worker for offline; then wrap as a Play app with a Trusted Web Activity (Bubblewrap CLI — give the commands to generate the AAB) and where ads fit (web ad slot vs AdMob in the TWA — honest note on TWA ad limitations, link ads doc). Phase 5 deploy the web build (Cloudflare Pages — cross-link `../../money/03-micro-tools` / `devops`) + Bubblewrap AAB. Ship-it: web PWA live at a URL + AAB in Play internal testing. Break-fix drills: (1) offline progress explodes the numbers — unbounded elapsed time. (2) service worker serves stale build — cache-versioning. (3) Bubblewrap AAB fails Digital Asset Links — assetlinks.json not hosted. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 07 idle-miner-co`

### Task 14: Game 08 — Tower Siege (Godot 4, Steam + itch)

**Files:**
- Create: `gamedev/08-tower-siege/README.md`, `gamedev/08-tower-siege/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Godot 4, Platform Steam + itch.io, Monetization premium. Difficulty 💀💀💀💀. Time 2-3 weeks. Deliverables end in: a Steam store page live (coming-soon) + a paid itch build; first paid Steam release path started.
- [ ] **Step 2: Write GUIDE** — Phase 0 Godot 4 desktop. Phase 1 tower-defense core: a path/waypoint system, enemy waves along the path, placeable towers with range/damage/fire-rate, targeting, projectiles, currency/lives (give the full GDScript: PathFollow enemies, Tower base + targeting, WaveManager, economy). Phase 2 multiple tower types + upgrades, multiple maps, a wave editor/data format. Phase 3 asset spec sheet (tower sprites, enemy sprites, map tileset, projectiles, UI, SFX, bgm — placeholders + fallback). Phase 4 Steam integration — GodotSteam or the Steamworks SDK basics (init, achievements optional), and the $100 app-fee reality (link Steam doc). Phase 5 Windows build + the itch build. Ship-it: pay the Steam Direct fee, create the app + store page (coming-soon), upload a build via SteamPipe; publish the paid build to itch now. Break-fix drills: (1) enemies skip waypoints at high speed — frame-rate-dependent movement. (2) towers target out-of-range — stale target not cleared. (3) Steam build won't upload — depot/VDF misconfig. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 08 tower-siege`

### Task 15: Game 09 — Card Forge (Unity, Steam)

**Files:**
- Create: `gamedev/09-card-forge/README.md`, `gamedev/09-card-forge/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Unity (C#), Platform Steam, Monetization premium (wishlist-driven launch). Difficulty 💀💀💀💀. Time 3-4 weeks. Deliverables end in: a Steam store page with wishlists open; a demo build.
- [ ] **Step 2: Write GUIDE** — Phase 0 Unity. Phase 1 deckbuilder core: cards as data (ScriptableObjects), a draw/play/discard/energy turn loop, enemy intents, a card-effect system, HP/block (give the C# scripts: CardData, DeckManager, CombatManager, effect resolver). Phase 2 a map/run structure (node paths, rewards, a shop), relics/upgrades, run persistence. Phase 3 asset spec sheet (card frames + art slots, enemy sprites, UI, map icons, SFX, bgm — placeholders + fallback; note card art is the biggest AI-asset job). Phase 4 Steamworks — the Steam page, tags, capsules (exact dims via Steam doc), **wishlists as the launch lever**, a Steam demo build, achievements via the SDK. Phase 5 Windows build + SteamPipe. Ship-it: Steam page live + "coming soon" + demo uploaded; wishlist-building actions listed (link money-track distribution ideas). Break-fix drills: (1) card effects resolve in the wrong order — no effect queue. (2) run state lost on quit — not serializing mid-combat. (3) Steam demo shows as the full game — separate AppID/depot for the demo. Hints. Done-when.
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 09 card-forge`

### Task 16: Game 10 — Capstone: Pixel Quest (Godot 4, Steam + web demo)

**Files:**
- Create: `gamedev/10-capstone-pixel-quest/README.md`, `gamedev/10-capstone-pixel-quest/GUIDE.md`

- [ ] **Step 1: Write README.** Engine Godot 4 (+ HTML5 export), Platform Steam (paid) + web demo funnel, Monetization premium + demo-to-wishlist. Difficulty 💀💀💀💀💀. Time 4-6 weeks. Prerequisites: games 01-09 (uses every skill). Deliverables end in: a real paid Steam release with a web demo driving wishlists. Capstone rule: guide is a requirements spec, not step-by-step; no hints section.
- [ ] **Step 2: Write GUIDE** — requirements-spec style, guides-closed (own prior games are the toolkit). Requirements: (1) a small but complete commercial 2D game (pick one focused genre — action-platformer or top-down adventure — ~30-60 min of content). (2) Built in Godot 4 with a clean project structure, save system, options menu, controller support. (3) A polished vertical slice exported to **HTML5** as a free web demo (hosted, link the web-portals + devops deploy path) that funnels to the Steam page. (4) A **Steam release**: page with real capsules/trailer/screenshots (exact dims via Steam doc), wishlists, the $100 Direct fee paid, tax/bank done, a proper build via SteamPipe, achievements, a launch-day checklist. (5) Real (AI-generated) final assets throughout — no placeholders shipped. Give a 20-item acceptance checklist (game complete, save works, demo live and funnels, Steam page approved, build passes review, price set, launch checklist done, wishlists > a target, AI-asset disclosure where required). Reflection section: which engine/platform you'd pick for the next game and why. No hints section (capstone rule stated).
- [ ] **Step 3: Verify. Step 4: Commit:** `docs(gamedev): add game 10 capstone pixel-quest`

### Task 17: Hub README update + final integration pass

**Files:**
- Modify: `README.md` (hub)
- Possibly modify: any gamedev file with a broken link

- [ ] **Step 1: Update hub `README.md`** — add a `gamedev` row to the Map table (link `gamedev/`, one-line description) and a `### gamedev` section to the progress dashboard listing all 10 games with links `gamedev/NN-<slug>/`; keep names matching the folders exactly.
- [ ] **Step 2: Link check** — every relative link in every `gamedev/**/*.md` and the hub README resolves (test-path each `](target)`); fix any broken ones.
- [ ] **Step 3: Placeholder sweep** — `git grep --no-index -nE "TBD|TODO|FIXME|coming soon|fill in" -- gamedev/ README.md` → reword any legitimate hits, expect clean.
- [ ] **Step 4: Commit:** `docs(gamedev): wire track into hub README + final consistency pass`

---

## Self-Review Notes

- **Spec coverage:** track README+economics (Task 1), TRACKER (Task 1), 5 reference docs (Tasks 2-6), 10 games with the exact engine/platform/monetization from the spec table (Tasks 7-16), hub integration (Task 17). All spec success criteria mapped. No gaps.
- **Consistency:** the 10-game engine/platform/monetization assignments match the spec table one-for-one (Godot 01/05/08/10, Unity 03/06/09, Phaser 02, Construct 04, PixiJS 07). Reference docs defined once (Tasks 2-6) and linked by the games that use them (Play→01/03/05/07; Steam→08/09/10; portals→02/04/07; ads→01/03/05/06/07). Asset spec-sheet format defined once (Task 2), reused by every game.
- **Placeholders:** content specs are concrete (named mechanics, exact code to include, exact store-asset dimensions, ship-it acceptance). "Give the code/scripts" markers instruct the executor to write full artifacts — the deliverable of a docs plan.
- **Budget/honesty:** $125 split and lottery-shaped economics carried in Task 1; every game README states its model + no-guarantee; compliance floor in Global Constraints binds all tasks.
