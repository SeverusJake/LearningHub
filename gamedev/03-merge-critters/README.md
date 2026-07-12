# Game 03 — Merge Critters

**Track:** gamedev · **Engine:** Unity (C#) · **Platform:** Google Play · **Monetization:** Rewarded video + interstitial
**Difficulty:** 💀💀 · **Time:** 3-5 days · **Prerequisites:** none (game 01 recommended for Play setup familiarity)

## Concept

Merge Critters is a merge/idle game: critters spawn onto a grid over time, and dragging two same-tier critters together fuses them into the next tier up, paying out currency on every merge. Merge mechanics are one of the strongest retention shapes in casual mobile — the loop reads in five seconds, there's no fail state to punish a new player, and a partly-full grid gives someone a concrete reason to open the app again ("that pair is almost ready to merge"). That same shape is also the best rewarded-ad fit in this track: a player who wants the board cleared faster or wants a currency boost has an obvious, self-motivated reason to opt into a 30-second ad, which is exactly the voluntary-exchange model rewarded video is built around. See `../reference/monetization-ads.md` for why that pairing works and how the ad types differ.

## What AI does / What you do

**AI does:**
- Every C# script: grid management, drag-and-drop input, merge resolution, currency, JSON save/load, the spawn-cost shop loop, and the ad integration code
- The asset spec sheet and a placeholder-generation tool so the game is fully playable before any final art exists
- Prompts for AI-generated final critter sprites, coin/UI icons, and Play Store listing copy
- Unity Ads/LevelPlay wiring for rewarded video and interstitial ads, configured in test mode

**You do:**
- Install Unity Hub, Unity 6 LTS, and the Android Build Support module
- Create (or reuse from game 01) your Google Play Console developer account, and create a Unity Ads/LevelPlay account
- Generate your own upload keystore and back it up somewhere that survives a disk failure
- Judge whether the AI-generated critter art needs a redo pass before it ships
- Build the signed `.aab`, upload it to Play closed testing, and verify on a real device that the rewarded ad actually grants its reward before calling this shipped

## Deliverables

- [ ] Unity project with Unity 6 LTS + Android Build Support installed, builds and runs in the editor
- [ ] Grid-based merge mechanic: dragging two same-tier critters merges them into the next tier and pays out currency
- [ ] Progress (grid state + currency) persists across an app restart
- [ ] A spawn-cost/shop loop that spends currency to manually add a critter
- [ ] The full loop runs on placeholder art (numbered colored circles) before any final asset exists
- [ ] Rewarded video and interstitial ads wired through Unity Ads/LevelPlay, running in test mode
- [ ] Signed `.aab` built from Unity
- [ ] Game in Play closed testing with rewarded ads working in test mode

## Start

Open a Claude Code session in this folder and say: `start gamedev/03`. Follow GUIDE.md.
