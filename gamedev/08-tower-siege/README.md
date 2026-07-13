# Game 08 — Tower Siege

**Track:** gamedev · **Engine:** Godot 4 · **Platform:** Steam + itch.io · **Monetization:** premium · **Difficulty:** 💀💀💀💀 · **Time:** 2-3 weeks · **Prerequisites:** Games 01/05 (Godot)

## Concept

Tower Siege is a tower defense: enemies walk a fixed path from spawn to your base, and you spend currency to place towers along the sides of that path. Each tower has a range, a fire rate, and a damage value, and automatically shoots whatever enemy is in range the moment its cooldown clears. A wave sends a batch of enemies down the path; an enemy that reaches the end costs you a life instead of currency, and killing an enemy pays you currency you spend on the next tower or the next upgrade. Losing all your lives ends the run; clearing every wave on a map wins it. Maps get bigger and wave rosters get nastier as you progress — more enemy types, tougher stat lines, tighter currency budgets — which is what turns "place a tower" into an actual strategy game instead of a one-note toy.

Tower defense earns its slot as this track's first real paid-Steam release because the genre has a track record most casual genres don't: a single run is short enough to demo and sell itself, but a full campaign of maps, tower types, and upgrade paths genuinely holds attention for 10-20+ hours, which is the playtime range Steam reviewers reward with "worth the price" verdicts. The genre also has no dependency on ads or a live-service backend to make sense as a one-time purchase — the whole loop (place, defend, upgrade, repeat) is self-contained, which is exactly what a premium storefront listing needs to justify asking for money up front instead of monetizing attention over time.

## The $100 decision

This is the first game in the track that actually costs money to publish where it's designed to sell: Steam Direct charges **$100 per app**, and the track budget (see `../README.md`) only covers **one** Steam app fee across games 08, 09, and 10. Before you pay that fee here, decide whether Tower Siege is genuinely your strongest candidate for the one Steam release you're budgeting, or whether you'd rather build 08 as a portfolio piece (itch.io build only, Steam store-page steps read but not paid for yet) and save the real fee for 09 or 10. Nothing below forces the decision for you — the Ship-it challenge assumes you've chosen to spend the fee on this game; if you haven't, do everything up through Phase 5 and treat the Ship-it challenge as a dry run using `../reference/platform-steam.md` until you're ready to commit the $100 to a specific title.

## AI does / You do

**AI does:** the entire tower-defense engine (GDScript in GUIDE.md) — the path/waypoint enemy movement, wave spawning, tower placement, range/target-acquisition/projectile logic, the currency-and-lives economy, multiple tower types and an upgrade path, a JSON/resource wave-data format so new maps don't need new code, the GodotSteam integration wiring, the full asset spec sheet plus AI-generation prompts for every sprite/tileset/SFX/bgm, and the Steam store-page copy draft.

**You do:** creating and verifying your own Steamworks partner account (real legal identity, tax interview, banking) and your itch.io account, personally deciding whether to spend the $100 Steam Direct fee on this title (see above), judging whether AI-generated tower/enemy art actually reads clearly at real gameplay zoom (not just in the editor), running the actual SteamPipe upload and store-page review submission yourself, and clicking publish on both the Steam Coming-Soon page and the paid itch.io build.

## Deliverables

- [ ] A Godot 4 project with a path/waypoint enemy system, timed wave spawning, placeable towers with range/damage/fire-rate and target acquisition, projectiles, and a working currency + lives economy
- [ ] At least 3 tower types with an upgrade path, at least 2 maps, and a JSON/resource-driven wave-data format so new waves and maps don't require code changes
- [ ] A complete asset spec sheet (tower sprites, enemy sprites, map tileset, projectiles, UI, SFX, bgm) with AI-generated finals swapped in over placeholders
- [ ] GodotSteam (or the Steamworks SDK) integrated and confirmed initializing the Steam overlay in a test build
- [ ] A standalone Windows build exported and confirmed running outside the editor
- [ ] A Steam store page live as "Coming Soon" and a paid itch.io build published; Steam release path started

## Start

Open a Claude Code session in this folder and say: `start gamedev/08`. Follow `GUIDE.md`.
