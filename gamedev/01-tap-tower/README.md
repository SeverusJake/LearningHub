# Game 01 — Tap Tower

**Track:** gamedev · **Engine:** Godot 4 · **Platform:** Google Play · **Monetization:** AdMob banner + interstitial · **Difficulty:** 💀 · **Time:** 1-2 days · **Prerequisites:** none

## Concept

A one-tap block stacker. A block slides back and forth above the tower; tap to drop it. Wherever it overlaps the block below, it snaps to that overlap — the part hanging over the edge is trimmed off. Land a block with zero overlap and the run ends. Score is just how high you got. There's no menu maze, no inventory, no dialogue — one input, one rule, one number going up.

Hyper-casual one-tap games are the highest-completion, most ad-friendly genre that exists: players understand the whole game in one glance, sessions are short enough to replay immediately after a loss, and a slide-and-drop mechanic gives you natural, non-intrusive moments to show a banner (during play) and an interstitial (on game over) without ever interrupting an actual input. That combination — trivial to learn, cheap to build, structurally suited to ads — is exactly why this is game 01: it's the fastest path through the whole pipeline (Godot → Android export → Play Console → AdMob) with the least amount of genre complexity fighting you along the way.

## What AI does / What you do

**What AI does:**
- Writes all the GDScript — the stacking mechanic, the UI, the difficulty ramp, the AdMob wiring
- Builds and wires the Godot scenes and node structure
- Tunes feel (slide speed, ramp rate, block height) based on what you report from playtesting
- Writes the AdMob integration code against Google's public test ad unit IDs
- Writes the Play Store listing copy (short/full description, feature graphic text)
- Produces placeholder art (colored rectangles) so the game is playable before any final art exists

**What you do:**
- Install Godot 4, the Android export templates, a JDK, and the Android SDK
- Create and verify your own Google Play Console developer account (identity verification is yours to complete — no one else can do this for you)
- Pay the one-time $25 Play Console registration fee
- Generate the final art (block sprite, background) with an AI image tool once the mechanic is proven, per the asset spec sheet in GUIDE.md
- Run the actual Godot export and hold your own signing keystore
- Upload the build to Play Console and click publish yourself

## Deliverables

- [ ] Core tap-to-drop stacking mechanic implemented and playable end-to-end (stack, miss, lose)
- [ ] Score display, game-over screen, and restart working, with slide speed ramping per block
- [ ] Placeholder art/audio swapped for final Kenney/AI-generated assets per the spec sheet
- [ ] AdMob banner + interstitial wired in and confirmed working with test ad units
- [ ] Signed Android App Bundle (.aab) exported
- [ ] The game is live in Play internal/closed testing with a test ad showing

## Start

Open a Claude Code session in this folder and say: `start gamedev/01`. Follow GUIDE.md.
