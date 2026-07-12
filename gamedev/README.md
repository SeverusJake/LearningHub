# Gamedev Track

## Track goal

Ship 10 small commercial games, each one finished, published, and left live on a real storefront — spread across different engines (Godot, Unity, Phaser, Construct 3, PixiJS) and different platforms (Google Play, Steam, itch.io, web portals) so you leave the track with hands-on range instead of expertise in one narrow toolchain. AI does the heavy lifting on every game — code, art direction, level design, copy, store listing text, marketing assets — roughly 90-95% of the total effort. Your job is the 5-10% that can't be delegated: creating and verifying developer accounts, replacing any placeholder/AI-generated assets that a platform's policy or your own judgment says need to be original or licensed, testing the actual build on the actual platform, and clicking publish. You are the gate; the AI is the build system.

## Honest economics

Read this before you get attached to a revenue number. Published indie and hobby games are lottery-shaped: the median outcome across most storefronts is under $100 lifetime, and that's true even for competently made games. This track is not a plan to hit that lottery — it's a plan to leave with 10 shipped, playable, published things and the engine/platform/publishing skills that took to make them. If one or two of the ten catch any traction, that revenue is a bonus that can fund tools or ad spend for the rest of the track, not a paycheck to budget around.

Where the money realistically comes from, ranked by how likely you are to see any of it: hyper-casual mobile with ad monetization (games 01, 03, 05) is the highest-probability-of-some-revenue category, but the per-install economics are brutal — fractions of a cent to a few cents per play, and you need real install volume before ad revenue is anything but noise. Web portals — CrazyGames, Poki, GameDistribution — (games 02, 04, 07) pay out fastest of anything here: no store review queue, no app fee, submit a build and if a portal picks it up you can see your first payment within weeks, but the revenue-share means your cut per play is small. itch.io (games 04, 06, 08) is the lowest-friction storefront that exists — no fee to list, pay-what-you-want is normal, and it's a fine place to put a game with basically zero expectation of income, just a public link. Steam (games 06 demo, 08, 09, 10) is the premium tier and the graduation platform in this track — $100 per app just to submit, a much higher bar for what counts as "finished" (store page, screenshots, trailer, actual polish), and it's the one place here where a single game could plausibly clear real money — but it's also the one place where most small releases sell single digits to low hundreds of copies. Budget one Steam release, not several.

Expect month 1 revenue across all ten games combined to be close to $0. That is normal, not a sign anything went wrong — ad networks and portals both need volume and time before payouts are anything but rounding error, and Steam wishlists take months to build before a launch even happens. The asset you're building is the portfolio of 10 shipped games plus the muscle memory of having gone through account setup, build export, store submission, and post-launch iteration on five different pipelines. If one or two games develop real traction, great — let them pull ahead and get more of your post-track time. Nothing here is guaranteed income.

## The 10 games

| # | Title | Genre | Engine | Platform | Monetization | Difficulty |
|---|-------|-------|--------|----------|--------------|------------|
| 01 | [Tap Tower](01-tap-tower/) | Hyper-casual one-tap stacker | Godot 4 | Google Play | AdMob banner + interstitial | 💀 |
| 02 | [Neon Runner](02-neon-runner/) | Endless runner | Phaser 3 (JS/HTML5) | Web portals | Portal ad revenue-share | 💀 |
| 03 | [Merge Critters](03-merge-critters/) | Merge/idle | Unity (C#) | Google Play | Rewarded video + interstitial | 💀💀 |
| 04 | [Word Bloom](04-word-bloom/) | Word puzzle | Construct 3 | Web + itch.io | Portal ads + itch PWYW | 💀💀 |
| 05 | [Blockfall](05-blockfall/) | Match-3 | Godot 4 | Google Play | Rewarded + banner, LevelPlay mediation | 💀💀💀 |
| 06 | [Dungeon Dash](06-dungeon-dash/) | Roguelike | Unity (C#) | itch.io + Steam demo | Premium + free demo | 💀💀💀 |
| 07 | [Idle Miner Co](07-idle-miner-co/) | Incremental/idle | JavaScript + PixiJS (PWA) | Web + Play (TWA) | Ads + optional IAP | 💀💀💀 |
| 08 | [Tower Siege](08-tower-siege/) | Tower defense | Godot 4 | Steam + itch.io | Premium | 💀💀💀💀 |
| 09 | [Card Forge](09-card-forge/) | Roguelike deckbuilder | Unity (C#) | Steam | Premium (wishlist-driven) | 💀💀💀💀 |
| 10 | [Capstone: Pixel Quest](10-capstone-pixel-quest/) | Small commercial 2D game | Godot 4 + HTML5 export | Steam (paid) + web demo | Premium + demo-to-wishlist | 💀💀💀💀💀 |

## Engine install matrix

| Engine/Tool | Download source | Install-check command |
|---|---|---|
| Godot 4 | [godotengine.org/download](https://godotengine.org/download) — get the Windows 64-bit .zip, no installer needed | `godot --version` |
| Unity 6 LTS | Install Unity Hub from [unity.com/download](https://unity.com/download), then add Unity 6 LTS + Android Build Support module through the Hub | Open Unity Hub → Installs tab, confirm Unity 6 LTS is listed (Unity has no reliable global CLI version command on Windows by default) |
| Node.js | [nodejs.org](https://nodejs.org) — install the LTS release (needed for Phaser 3 and PixiJS tooling, npm, and local dev servers) | `node --version` |
| Construct 3 | Browser-based at [editor.construct.net](https://editor.construct.net) — no install; free tier caps you at a small number of event sheets/layouts per project, which is fine for Word Bloom but check the limit before you scope the game | No CLI — verify by loading the editor URL and confirming a project opens |
| Android Studio + SDK | [developer.android.com/studio](https://developer.android.com/studio) — needed for Google Play builds (Godot/Unity Android export, and the TWA wrapper for Idle Miner Co) | `sdkmanager --version` (run from `<SDK>/cmdline-tools/latest/bin/`) |
| Git | [git-scm.com/download/win](https://git-scm.com/download/win) | `git --version` |

## Progression

Start with 01 (Tap Tower) — it's the simplest game in the track and a competent AI-assisted build can go from empty project to a signed, uploaded APK in a day. That first pass through Godot's export pipeline and the Play Console is what makes every later Godot/Play game faster.

Games 02, 04, and 07 share a JS/HTML5 stack (Phaser 3, Construct 3's own export, and PixiJS respectively) — build them in that order once you're through the Godot/Unity basics and you'll be reusing browser dev-tools debugging, portal submission steps, and web build/export habits across all three.

Save the Steam games (08, 09, 10) for last. They carry both a higher bar — a real store page, screenshots, capsule art, ideally a trailer, and a game that holds up under public review — and a $100 fee each. Only one Steam app fee is budgeted for this track (see Budget below), so before you start 08 decide which of 08/09/10 is your one primary paid Steam release and treat the other two as itch.io/demo-only unless early traction changes that math.

Read each game's reference docs (`reference/<name>.md` inside that game's folder) before you hit publish on it, not after — store policies, ad network payout thresholds, and rating requirements are cheaper to get right the first time than to fix post-launch.

## Budget

Total: $125.

- Google Play Console developer account: $25 one-time registration fee — covers every Play Store game in this track (01, 03, 05, and the 07 TWA wrapper).
- One Steam app fee: $100 — covers exactly one of your Steam releases (08, 09, or 10 — pick the primary one per Progression above). The $100 is refundable by Valve once that title clears $1,000 in sales, but don't plan around getting it back.
- Web portals (CrazyGames, Poki, GameDistribution) and itch.io: free to submit and list, no budget needed.

Nothing else in this track requires spend unless you choose to buy licensed art/audio/font assets beyond what's free/AI-generated — that's an optional add-on, not part of the $125.

## Compliance floor

Applies to every game in this track, no exceptions:

- Store listings must be honest — no fake screenshots, no promising features that aren't in the build, no misleading category/tag gaming.
- No cloned trademarked IP and no ripped assets — don't reskin someone else's game, character, or brand, and don't use art/audio/fonts you don't have rights to.
- Every asset that ships is either genuinely original (including AI-generated where the platform allows it) or properly licensed — placeholder AI art is fine to prototype with, but check each platform's and asset marketplace's license terms before it ships in a public build.
- Follow each store's and each ad network's policies, including age rating and COPPA-related rules for any game whose art style or content could read as kid-directed (this affects ad types you're allowed to serve and what data you can collect).
- Disclose AI-generated content wherever a store's policy requires that disclosure — check the current policy for Google Play and Steam before submitting, since these rules change.
- Revenue figures anywhere in this track are ranges, not promises — nothing here is guaranteed income.
- Taxes on anything this track earns are your responsibility; nothing in this repo is tax advice.

See [../money/README.md](../money/README.md) for the broader compliance floor and honest-economics framing shared across every income-generating track in this repo.
