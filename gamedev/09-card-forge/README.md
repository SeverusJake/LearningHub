# Game 09 — Card Forge

**Track:** gamedev · **Engine:** Unity (C#) · **Platform:** Steam · **Monetization:** premium (wishlist-driven) · **Difficulty:** 💀💀💀💀 · **Time:** 3-4 weeks · **Prerequisites:** Games 03/06 (Unity)

## Concept

Card Forge is a roguelike deckbuilder: you start with a small deck of cards, and across a run of escalating fights you play cards using energy each turn to attack and defend, adding new cards and relics to your deck as rewards so it grows stronger and more synergistic. Every run is different because the cards, enemies, and reward paths are randomized. The genre has a devoted, high-spending PC audience and exceptional word-of-mouth — a good deckbuilder gets streamed and recommended, which is exactly the organic discovery a solo dev needs. It's a **premium** Steam game whose launch lives or dies on **wishlists**: the number of players who wishlist your "Coming Soon" page before release is the single biggest lever on launch-day visibility.

## AI does / What you do

**AI does:** all the C# — cards as data, the turn/energy/draw loop, the effect resolver, enemy intents, the run/map structure, relics, and persistence; the Steam integration wiring; the asset spec sheet (note: **card art is the single biggest AI-asset job** in the track); the store-page copy.

**You do:** create/verify the Steamworks account, complete tax/bank paperwork, pay the $100 Steam Direct fee (if this is your chosen Steam release — see the track budget), generate the many card-art finals, run the builds and SteamPipe upload, and do the wishlist-building outreach before launch.

## Deliverables

- [ ] A deckbuilder core: cards as ScriptableObjects, a draw/play/discard/energy turn loop, enemy intents, an effect resolver, HP/block
- [ ] A run structure (node map with paths, rewards, a shop), relics/upgrades, and run persistence
- [ ] A complete asset spec sheet with AI-generated finals over placeholders
- [ ] A Steam store page with capsules/tags, wishlists open, and achievements wired via the SDK
- [ ] A Steam demo build uploaded (its own AppID/depot) and a Windows build via SteamPipe
- [ ] A Steam page with wishlists open + a demo build

## Start

Open a Claude Code session in this folder and say: `start gamedev/09`. Follow `GUIDE.md`.
