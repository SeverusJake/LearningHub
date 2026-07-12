# Reference — Asset Pipeline

Every mission in the gamedev track follows the same rule: build art-last. This doc defines the spec-sheet format and the placeholder-to-final workflow that all 10 game GUIDEs reuse instead of re-explaining it each time. Read this once, then each GUIDE just points back here.

---

## 1. Principle

Mechanics first, art last. Every mission gets its gameplay loop working against placeholders — colored rectangles, boxes, beeps — before a single final asset gets made. Real assets go in during a dedicated pass near the end of the mission, right before the game ships or gets submitted to a store.

Why this order and not the reverse:

- **You are never blocked waiting on art.** If you can't decide what the player sprite should look like, that's a decision, not a blocker — a gray box moves, collides, and takes damage exactly like a finished sprite will. Gameplay work continues regardless.
- **Placeholders expose the real shape of the problem.** A rectangle at the wrong size or a hitbox that feels wrong is cheap to fix. A finished 128x128 sprite baked into wrong collision math is expensive to fix.
- **Final art is a swap, not a rebuild.** Because placeholders live at the exact filenames and dimensions the final assets will use, replacing them is a file-copy operation, not a code change. Section 5 covers the mechanics of that swap.
- **AI generation works better against a working game.** You get better prompts once you can see the placeholder in motion, on screen, next to the UI it has to match. Generating final art against a spec sheet written before you've seen the game run is guesswork.

If a GUIDE phase says "placeholder" or "programmer art," that means: ship something that satisfies the spec sheet's dimensions and format, worry about how it looks later.

---

## 2. The spec-sheet format

Every game GUIDE includes an asset spec sheet — a table listing every art, audio, and font asset the game needs, before any of them exist. The spec sheet is written during design, filled with placeholders during build, and used as the checklist during the art-swap pass at the end.

Columns:

| Column | Meaning |
|---|---|
| `TYPE` | `SPRITE`, `SPRITESHEET`, `BACKGROUND`, `AUDIO` (music), `SFX` (sound effect), `FONT`, `ICON` |
| `path` | the exact filename/relative path the asset lives at in the project — placeholder and final both use this path |
| `spec` | dimensions, format, duration, frame count — whatever the engine needs to import it correctly |
| `description` | what the asset depicts or sounds like, in plain language, enough for an AI generator or a human artist to act on |
| `fallback` | where to get a free stand-in if AI generation doesn't produce something usable — a specific pack or site, or `generated` if AI output is expected to be good enough on the first pass |

Example, from a simple arcade-style game:

```
TYPE   | path            | spec                        | description            | fallback
SPRITE | player.png      | 128×128 PNG, transparent    | single frame, top-down | Kenney
SPRITE | coin_sheet.png  | 64×64/frame, 8 frames horiz | gold coin spin         | Kenney
AUDIO  | bgm_loop.ogg    | ~60s seamless loop, 120bpm  | chiptune               | OpenGameArt
SFX    | tap.wav         | <0.5s                       | UI click               | generated
FONT   | ui.ttf          | rounded sans                | legible at small sizes | Google Fonts
```

Rules for keeping the spec sheet honest:

- Write the spec sheet before writing placeholder-loading code, so the path and dimensions in the sheet are the same path and dimensions the placeholder code uses.
- One row per asset, not per variant — if a game has 6 enemy types that share a spec, one row with a note ("×6, palette-swapped") beats 6 near-identical rows.
- The `fallback` column is not optional. AI generation sometimes fails to produce a usable result on a given asset (transparent backgrounds and looping audio are the most common failure points) — know in advance where you'd get a same-spec replacement without stalling the mission.

---

## 3. Placeholder strategy

Placeholders come in three tiers. Pull from tier (a) first — always, no exceptions, it's what keeps you unblocked. Reach for (b) or (c) only once mechanics are proven.

### (a) Solid-color / programmer art

The fastest placeholder is a colored rectangle drawn directly by the engine — no image file at all. This is what makes "the game runs immediately" literal: you can have a moving, colliding player character before you've opened an image editor.

**Godot** (a `ColorRect` node, or a `Sprite2D` backed by a 1x1 texture stretched to size):

```gdscript
# Player.gd — attach to a Node2D, draws a colored box as a stand-in for player.png
extends Node2D

func _ready():
	var box := ColorRect.new()
	box.size = Vector2(128, 128)
	box.position = Vector2(-64, -64)  # center on the node's origin
	box.color = Color(0.2, 0.6, 1.0)  # placeholder blue — swap for player.png later
	add_child(box)
```

**Phaser** (`this.add.rectangle` in a scene's `create()`):

```javascript
// PlayScene.js — draws a colored box as a stand-in for player.png
create() {
  this.player = this.add.rectangle(400, 300, 128, 128, 0x3399ff);
  this.physics.add.existing(this.player);
}
```

Both snippets use the same dimensions the spec sheet lists for the real asset (128x128 above), so collision boxes and layout code written against the placeholder keep working unchanged once the real sprite drops in.

### (b) Free-licensed packs

When a colored box stops being enough to judge feel (e.g., you need to tell player from enemy from pickup at a glance), pull a free asset instead of jumping straight to AI generation:

- **Kenney.nl** — CC0 (public domain, no attribution required). The default first stop for sprites, tilesets, and UI packs. Large enough libraries that most 2D genres are covered.
- **OpenGameArt.org** — mixed licenses per asset (CC0, CC-BY, CC-BY-SA, GPL). Check the license on the specific asset page before using it, not just the site's general reputation — attribution or share-alike requirements attach per-file, not per-site.
- **Google Fonts** — open-license fonts (mostly OFL). Good default for the `FONT` row on any spec sheet.

Whenever you pull from tier (b), record the license and source next to the asset — a line in the mission's notes or a `CREDITS.md` in the project root. "Found it free online" is not a license record; "Kenney.nl, CC0" is. This matters most if the game ever ships to a store, where some platforms ask for a license accounting of third-party assets.

### (c) AI-generated finals

The last tier, and the one that becomes the actual shipped asset in most missions. Covered in full in Section 4.

---

## 4. AI asset generation

This section gives prompt patterns, not tool endorsements. Use any text-to-image, text-to-music, or SFX-generation tool you have access to — the patterns below are about what to ask for, independent of which product you're asking.

### Sprites

Ask for: **"transparent PNG background, flat 2D game-asset style, centered, single object, consistent palette."** Being explicit about "transparent background" and "single object, centered" matters more than any style adjective — those two constraints are what make a generated image actually usable as a drop-in sprite instead of needing a manual background-removal pass.

For sprite sheets (a walk cycle, a spin animation, an explosion): generate the individual frames one at a time with the same prompt plus a frame descriptor ("frame 1 of 8, arm forward" / "frame 2 of 8, arm back"), keeping the subject, palette, and framing identical across calls, then arrange the resulting images on a grid yourself in an image editor or a small script to produce the sheet the spec row describes (e.g. `64×64/frame, 8 frames horiz`). Generating the whole sheet in one call rarely produces evenly-spaced, evenly-sized frames — treat single-frame generation plus manual grid assembly as the reliable path.

### Backgrounds

Same "flat 2D game-asset style" baseline, plus call out whether the background needs to be **seamless / tileable** — a background that scrolls or repeats needs edges that match up, and generic text-to-image prompting does not produce that by default unless you ask for it directly ("seamless tiling texture, edges match on all sides").

### UI and icons

Ask for a **simple, high-contrast, consistent set** — icons for a shared UI (health, coins, pause, settings) should come from prompts that repeat the same style words across every icon in the set, otherwise you get a UI where every button looks like it came from a different game. Generate the full icon set in one sitting, reusing the style phrase verbatim across prompts, rather than generating them as you need them over multiple sessions.

### Music

Specify **genre, length, BPM, and mood**, and say **loopable** explicitly if the track needs to repeat during gameplay (most background music does). "Chiptune, 60 seconds, 120bpm, upbeat and loopable" is a usable prompt; "fun game music" is not.

### SFX

Keep it **short and describe the action**, not a genre — "a short crisp UI click, under half a second" or "a soft coin-collect chime, bright and quick" describes what the sound does in-game, which is what a generator needs to produce something that fits the spec row's duration.

---

## 5. Swap procedure

Replacing a placeholder with a final asset is a mechanical checklist, not a redesign:

1. **Generate or source the final asset** using Section 3(b)/(c), matching the `spec` column exactly — same dimensions, same format, same duration.
2. **Save it at the same filename and path** the placeholder occupied (the `path` column in the spec sheet). This is the whole reason the spec sheet locks in the path up front — no code should need to change to point at a new file.
3. **Re-import in the engine** — Godot and Phaser both need the new file picked up (reimport in the FileSystem dock in Godot; a rebuilt/reloaded asset bundle in Phaser's dev server). A stale cached texture is the most common "I swapped the file but it still shows the placeholder" bug.
4. **Keep dimensions power-of-two** where the engine or platform benefits from it (64, 128, 256, 512, 1024...) — GPUs handle power-of-two textures more efficiently, and some mobile GPUs still have hard requirements around it.
5. **Respect mobile texture-size caps** — treat 2048×2048 as the safe upper bound for any single texture if the game targets mobile or WebGL. Going bigger risks failing to load on lower-end devices even when it works fine on your dev machine.
6. **Verify it still runs** — launch the game after every swap (or every small batch of swaps) and confirm the asset displays at the right size, in the right position, with the right transparency. Don't batch all asset swaps for the whole game and test once at the end; a bad swap is easy to isolate right after it happens and hard to isolate after ten more swaps land on top of it.

---

## 6. Store-asset specs

Store-facing assets — app icons, screenshots, feature graphics, capsule images — are a different category from in-game assets and have exact required pixel dimensions set by each platform. Those dimensions don't live in this doc; they live in the platform-specific reference doc for wherever the mission is publishing to:

- `platform-google-play.md`
- `platform-steam.md`
- `platform-web-portals.md`

When a mission GUIDE reaches its publish phase, check the relevant platform doc for the exact icon/screenshot/capsule specs before generating those assets — treat them as their own spec-sheet rows, sized to what the store requires, not to what looks good in-engine.

---

## 7. AI-disclosure note

Some stores and platforms require disclosing that a submission contains AI-generated content — this applies to store listing assets and sometimes to in-game content itself, not just to the workflow described in Section 4. Requirements differ by platform and change over time, so check the disclosure requirement in the relevant platform doc (`platform-google-play.md`, `platform-steam.md`, `platform-web-portals.md`) before publishing, and comply with whatever that platform currently requires.
