# GameDev Track Design

**Date:** 2026-07-12
**Status:** Approved by user (section-by-section review)

## Purpose

A fifth top-level track in LearningHub: `gamedev/`. Ship small, commercially-viable games across multiple engines and platforms, with the AI doing 90-95% of the work (design, code, integration, store copy) and the user doing the manual gates AI cannot: account creation, identity/payment verification, asset replacement, store submission, and publishing. Each of ten games is a self-contained mission using a deliberately different engine or platform, so the user learns the breadth of the game-monetization landscape by shipping across it. This is a money-making track first and a learning track second — the same do-first, mission-based format as the rest of the hub.

## User profile and constraints

- Advanced IT background; comfortable with Linux, git, programming. New to game engines specifically — that's the point.
- Windows 11 Pro PC, 32GB+ RAM. Strong enough for Unity/Godot/Unreal-lite workloads.
- Global/English market, PayPal, plus this track needs additional payout rails (see below).
- Budget for this track: **$125** — Google Play one-time $25 + one Steam app fee $100. Web portals and itch.io are free.
- AI generates all placeholder art/music/SFX, or specifies exactly what asset the user must drop in (dimensions, format, style, count). User replaces with AI-generated finals later.
- Preference: most popular / easiest-to-profit genres; hardest, most complete guides; regardless of time.

## Honest economics (stated up front, in the track README)

Game revenue is lottery-shaped, more so than the other money folders. Most published indie games earn under $100 lifetime. This track wins on **portfolio + learning**, not any single hit:
- **Hyper-casual mobile + ads** is the highest-probability path to *some* revenue: low bar, fast build, ad-funded — but per-install revenue is tiny; you need volume/retention.
- **Web portals (CrazyGames, Poki, GameDistribution)** pay revenue-share or licensing and are the fastest path to a first payout with zero store fees.
- **itch.io** is the lowest-friction storefront (name your price, instant publish) — good for a first "it's live and buyable" win.
- **Steam** is where premium games earn real money, but $100/game and a much higher quality bar; treated as the graduation platform, one release, late in the track.
- Realistic outcome: month-1 near $0; a portfolio of 10 shipped games across platforms is the asset, and 1-2 that gain any traction fund the rest. No income is guaranteed.

Compliance floor (inherits the money track's, plus gaming specifics): honest store listings; no cloned trademarked IP (no "Flappy Bird", no Nintendo characters, no ripped sprites); respect each ad network's and store's policies (COPPA/age-rating for kids' games, ad-content ratings); original or properly-licensed assets only; disclose AI-generated content where a store requires it; taxes are the user's responsibility (not tax advice).

## Structure

`gamedev/` mirrors the other tracks (mission folders, README + GUIDE per mission), plus shared reference docs the missions all point back to:

```
gamedev/
├── README.md                     # track overview, honest economics, 10-game table, engine install matrix, progression
├── TRACKER.md                    # per-game log: engine, platform, hours, status, revenue, ad network
├── reference/
│   ├── assets-pipeline.md        # how AI makes placeholders + exact spec sheet per asset type; how you swap finals
│   ├── platform-google-play.md   # account setup, $25, AAB build, store listing, closed→open testing, release
│   ├── platform-steam.md         # Steamworks, $100 app fee, depot/build, store page, wishlists, launch
│   ├── platform-web-portals.md   # itch.io + CrazyGames + Poki + GameDistribution: accounts, upload, SDKs, payout
│   └── monetization-ads.md       # AdMob, Unity Ads/LevelPlay, ad types, mediation, GDPR/consent, web portal ad SDKs
├── 01-<game>/  … 10-<game>/      # README.md (concept, engine, platform, difficulty, deliverables) + GUIDE.md
```

Doc formats reuse the hub's mission conventions: README (goal, difficulty skulls, time, prereqs, deliverables, start line) and GUIDE (Phase 0 setup → numbered phases each ending in a **Checkpoint** → break-fix drills → prove-it/ship-it challenge → collapsed hints → done-when). For gamedev the "prove-it" is a **ship-it**: the game is actually published/live on its target platform.

## The 10 games — engine × platform × genre spread

Chosen so no two share an engine, the genres are proven sellers or high-completion-rate for solo devs, and difficulty ascends. Each names its target platform and monetization model.

| # | Game (working title) | Genre | Engine / Platform tech | Target platform | Monetization | Difficulty |
|---|---|---|---|---|---|---|
| 01 | Tap Tower | Hyper-casual one-tap stacker | **Godot 4** (GDScript) | Google Play (mobile) | AdMob banner + interstitial | 💀 |
| 02 | Neon Runner | Endless runner | **Phaser 3** (JavaScript/HTML5) | Web portals (CrazyGames/Poki) | Portal ad revenue-share | 💀 |
| 03 | Merge Critters | Merge/idle | **Unity** (C#) | Google Play | Rewarded video + interstitial | 💀💀 |
| 04 | Word Bloom | Word puzzle | **Construct 3** (no-/low-code, event sheets) | Web + itch.io | Portal ads + itch "pay what you want" | 💀💀 |
| 05 | Blockfall | Match-3 / falling-block puzzle | **Godot 4** (mobile export) | Google Play | Rewarded + banner, LevelPlay mediation | 💀💀💀 |
| 06 | Dungeon Dash | Roguellike dungeon crawler | **Unity** (C#) | itch.io + Steam demo | Premium (paid) + free demo | 💀💀💀 |
| 07 | Idle Miner Co | Incremental/idle management | **JavaScript + PixiJS** (PWA) | Web + Play (TWA wrapper) | Ads + optional IAP | 💀💀💀 |
| 08 | Tower Siege | Tower defense | **Godot 4** | Steam + itch.io | Premium | 💀💀💀💀 |
| 09 | Card Forge | Roguelike deckbuilder | **Unity** (C#) | Steam | Premium (wishlist-driven launch) | 💀💀💀💀 |
| 10 | Capstone: Pixel Quest | Small commercial 2D game, cross-platform | **Godot 4** (Steam) + **HTML5 export** (web demo) | Steam (paid) + web demo funnel | Premium + demo-to-wishlist funnel | 💀💀💀💀💀 |

Rationale for the spread:
- **Engines:** Godot (×4 — the free, fast-iterating workhorse the user should end up fluent in), Unity (×3 — the industry-standard C# engine and its ad ecosystem), Phaser/PixiJS/Construct (×3 — web/HTML5 stack for the portal path). Covers GDScript, C#, and JavaScript so the user learns three ecosystems.
- **Genres:** all are proven high-completion, high-monetization-fit for solo devs — hyper-casual, endless runner, merge/idle, word, match-3, roguelike, incremental, tower defense, deckbuilder. No genre requiring a large content team.
- **Platforms:** mobile (Play), web portals, itch.io, and Steam — every major solo-dev revenue channel, each with its own reference doc.
- **Difficulty ramp:** 01 is a one-tap game shippable in a day; 10 is a small but real commercial Steam release, integrating everything.

## Asset strategy

The `reference/assets-pipeline.md` doc is central. For every game, the GUIDE specifies assets as a **spec sheet**, e.g.:

```
SPRITE  player.png       128×128 PNG, transparent, single frame, top-down
SPRITE  coin_sheet.png   64×64 per frame, 8 frames horizontal, gold coin spin
AUDIO   bgm_loop.ogg      ~60s seamless loop, chiptune, 120bpm
SFX     tap.wav           <0.5s, UI click
FONT    ui.ttf            any legible rounded sans (name a free-licensed default)
```

The GUIDE ships with AI-generated or solid-color/programmer-art **placeholders** so the game runs immediately, plus explicit instructions and prompts for the user to generate finals with an AI image/music tool and drop them in at the same paths. Games are built art-last: mechanics first against placeholders, polish and real assets before publish. Every asset spec names a free-licensed fallback (Kenney.nl packs, OpenGameArt) so the user is never blocked.

## Manual-vs-AI split (per game, in each PLAYBOOK-equivalent GUIDE)

- **AI does:** all engine code and scenes, mechanic design, difficulty tuning parameters, ad-SDK integration code, build configuration, store-listing copy (title, description, keywords), placeholder assets, and the exact asset spec sheet.
- **You do:** install the engine (guided), create and verify platform accounts (Play, Steam, portal, itch — one-time, guided step-by-step with the reference docs), pay the fees, generate/replace final art+music with AI tools, run the actual builds locally, upload/submit to stores, click the publish/consent buttons, and manage payouts.

## Platform setup coverage (the reference docs)

Each reference doc is a complete, current, step-by-step manual for the parts only the user can do:
- **Google Play:** create a Google Play Console developer account ($25 one-time), identity + D-U-N-S-style verification realities, generate an upload key + AAB, fill the store listing, content rating questionnaire, data-safety form, closed testing → 12-tester requirement → open testing → production rollout.
- **Steam:** Steamworks account, $100 app deposit per title, the Steam Direct paperwork (tax/bank), depot + build upload via SteamPipe, store page assets and their exact dimensions, wishlists and why they drive launch, review/approval, release-day mechanics.
- **Web portals:** itch.io (free, instant, pay-what-you-want, payout via PayPal/Stripe), plus CrazyGames / Poki / GameDistribution — account, the portal SDK each requires, HTML5 upload/embed, revenue-share terms, and payout thresholds. Honest note on which are open-signup vs application-gated.
- **Ads/monetization:** AdMob (mobile), Unity Ads/LevelPlay mediation, ad types (banner/interstitial/rewarded) and when each fits a genre, GDPR/UMP consent, ad content rating, COPPA for kid-directed games, and the web-portal ad SDKs (which forbid your own ads — revenue is the portal's share). IAP is mentioned where relevant but ads are the primary model.

## Success criteria

- `gamedev/` exists with a track README (honest economics, the 10-game table, an engine-install matrix, progression), a TRACKER.md, five reference docs, and ten mission folders each with README + GUIDE.
- Every GUIDE is executable step-by-step with checkpoints, an asset spec sheet, a manual-vs-AI split, and a **ship-it** challenge that ends in the game actually being published/live.
- The five reference docs are complete enough that a first-timer can create each account and ship to each platform without leaving the repo.
- No placeholders (no "TBD"/"TODO"/"coming soon"/"fill in") anywhere; all relative links resolve; the hub README dashboard is updated to include the gamedev track.
- Compliance and honest-expectations language present in the track README.

## Out of scope

- Writing the actual game source code / engine projects (the GUIDE embeds code the user builds in-session; the repo ships docs, not shipped game binaries).
- 3D / AAA engines beyond a mention (Unreal is noted as out-of-scope for solo profit here).
- Console platforms (Nintendo/PlayStation/Xbox — require devkits/approval, not solo-viable at this stage).
- Guaranteeing revenue or providing financial/tax advice.

## Integration with the rest of the hub

- `gamedev/` is a peer of `sysops/`, `devops/`, `proxmox/`, `money/` in the hub README map and progress dashboard.
- Web games (Phaser/PixiJS/Construct) reuse the user's DevOps skills for deployment; a note links game 02/07 hosting to `devops/` and the `money/03-micro-tools` Cloudflare workflow. Cross-track, not required.
- The money track's compliance floor and honest-expectations framing are inherited and referenced.
