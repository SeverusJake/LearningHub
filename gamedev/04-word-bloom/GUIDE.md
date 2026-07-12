# Guide — Game 04: Word Bloom

Construct 3 is a visual, event-sheet engine — there is no source file to hand you, only a recipe of **conditions** (when does this fire) and **actions** (what happens when it does) that you place into the editor yourself, one block at a time. Every phase below spells out that recipe object-by-object and event-by-event so you can reproduce it directly in the Construct 3 editor at [editor.construct.net](https://editor.construct.net). Where an event has more than one condition, they're listed as separate lines that all have to be true together (Construct ANDs conditions on the same event line by default).

Reference docs used throughout: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) (placeholder-to-final asset workflow) and [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md) (itch.io and web-portal submission mechanics, portal SDK rules).

---

## Phase 0 — Construct 3 in the browser

Construct 3 has no local install — the entire editor runs at [editor.construct.net](https://editor.construct.net) in Chrome or Edge.

1. Go to editor.construct.net and create a free account (email + password, no payment info needed to start).
2. Click **New project** → **Empty project**.
3. Before you build anything, open the account/plan page and read the current **Free plan** limits. Construct's free tier caps how much project you can build (a small number of event sheets and layouts per project) and — the part that matters most for this game — **generally does not let you export a finished build**; exporting to a real HTML5 zip is typically gated behind a paid Personal/Business plan. These numbers and the exact export gate change over time, so confirm the current terms on Construct's own pricing page rather than trusting a fixed figure here. Word Bloom is small enough to build entirely on the free plan — the decision point is only whether you need to upgrade when you reach Phase 5's export step.

**Checkpoint:** with the empty project open, click the **Preview** (play) button in the editor toolbar. A new browser tab opens showing a blank white layout with no red errors in the browser's developer console. That's Construct's whole build loop in miniature: edit, click Preview, watch a real browser render it.

---

## Phase 1 — Word-puzzle core

### Objects to add

Add these from the Construct **Object bar** (right-click → Insert new object):

| Object | Type | Purpose |
|---|---|---|
| `LetterTile` | Sprite | one instance per grid cell — the tile itself |
| `LetterLabel` | Text | the big letter drawn on top of each tile |
| `CurrentWordText` | Text | shows the word being built, top of screen |
| `WordList` | Array | holds every valid word (Phase 1: a short test list; Phase 4: the full dictionary) |
| `SelectedOrder` | Array | holds the UIDs of tiles selected in the current drag, in order |
| `Touch` | Touch (plugin) | unifies mouse and finger input — add it once from the plugin list, Construct auto-instances it |
| — | Function (plugin) | add this once too; it's where `SelectTile`, `ClearSelection`, `BuildGrid` (below) live |

Instance variables on `LetterTile` (add via its Properties panel): `Letter` (Text), `Row` (Number), `Col` (Number), `IsSelected` (Boolean, default `false`).

Project-level global variables (System → Add global variable): `CurrentWord` (Text, `""`), `LastRow` (Number, `-1`), `LastCol` (Number, `-1`).

### Building the grid

Wrap grid creation in its own function so Phase 2's level-advance can call it again later, instead of only running once at layout start.

**Function `BuildGrid`** (no parameters):
- Action: System → *For* `"col"` from `0` to `3`
  - Action (nested inside the `col` loop): System → *For* `"row"` from `0` to `3`
    - Action: System → *Create object* `LetterTile`, layer `"Game"`, at `(GridX + loopindex("col") * 96, GridY + loopindex("row") * 96)`
    - Action: `LetterTile` → *Set value* `Row` to `loopindex("row")`
    - Action: `LetterTile` → *Set value* `Col` to `loopindex("col")`
    - Action: `LetterTile` → *Set value* `Letter` to `mid("ETAOINSHRDLUCMFWYPVBGKJQXZ", round(random(0,25)), 1)` — a letter-frequency string so common letters (E, T, A) come up more than rare ones (Q, X, Z). This is a placeholder distribution; Phase 2 swaps in pre-authored, guaranteed-solvable level letter-sets.
    - Action: System → *Create object* `LetterLabel` at `(LetterTile.X, LetterTile.Y)` — because you just created `LetterTile` this same iteration, Construct still has it picked, so `LetterTile.X`/`LetterTile.Y` refer to the tile you just placed, not some other instance.
    - Action: `LetterLabel` → *Set text* to `LetterTile.Letter`

**Event — On start of layout**
- Condition: System → *On start of layout*
- Action: System → *Call function* `BuildGrid`

### Selecting tiles

**Function `SelectTile`** (parameter: `TileUID`, Number):
- Action: System → *Pick* `LetterTile` by *unique ID* = `Function.Param(0)`
- Action: `LetterTile` → *Set value* `IsSelected` to `1`
- Action: `LetterTile` → *Set color* to the highlight tint (or *Set effect* if you're using an effect-based highlight)
- Action: System → *Set value* `CurrentWord` to `CurrentWord & LetterTile.Letter`
- Action: `CurrentWordText` → *Set text* to `CurrentWord`
- Action: `SelectedOrder` → *Push* `Function.Param(0)` to back
- Action: System → *Set value* `LastRow` to `LetterTile.Row`
- Action: System → *Set value* `LastCol` to `LetterTile.Col`

**Event — Begin a new selection**
- Condition: `Touch` → *On touched* `LetterTile`
- Condition: System → *Compare two values*: `CurrentWord = ""` (only fires for the first tile of a fresh drag — Event B below handles every tile after it)
- Action: System → *Call function* `SelectTile`, parameter `LetterTile.UID`

**Event — Extend the selection while still dragging**
- Condition: `Touch` → *Is in touch* (finger/mouse button still held down)
- Condition: `Touch` → *On touched* `LetterTile`
- Condition: `LetterTile` → *Compare instance variable*: `IsSelected = 0`
- Condition: System → *Compare two values*: `abs(LetterTile.Row - LastRow) <= 1` **and** `abs(LetterTile.Col - LastCol) <= 1` (adjacency check — only a tile touching the last-selected one horizontally, vertically, or diagonally can extend the word)
- Action: System → *Call function* `SelectTile`, parameter `LetterTile.UID`

### Validating on release

**Function `ClearSelection`** (no parameters):
- Action: System → *For each* `LetterTile` where `IsSelected = 1` → *Set value* `IsSelected` to `0`, *Set color* back to default (no tint)
- Action: System → *Set value* `CurrentWord` to `""`
- Action: `CurrentWordText` → *Set text* to `""`
- Action: `SelectedOrder` → *Set size* to `(0, 1, 1)` (empties the array)

**Event — Release: word is valid**
- Condition: `Touch` → *On touch end*
- Condition: System → *Compare two values*: `len(CurrentWord) >= 3`
- Condition: System → *Compare two values*: `WordList.IndexOf(CurrentWord) != -1` (membership check against the word-list array — this is the validation line)
- Action: System → *Add* a score amount to a global `Score` variable (wired up fully in Phase 2)
- Action: System → *For each* `LetterTile` where `IsSelected = 1` → *Set color* to the "correct" flash (green)
- Action: `Audio` → *Play* `correct.wav`
- Action: System → *Call function* `ClearSelection`

**Event — Release: word is invalid**
- Condition: `Touch` → *On touch end*
- Condition: System → *Else* (i.e., the condition pair above — length ≥ 3 and found in `WordList` — was false)
- Action: System → *For each* `LetterTile` where `IsSelected = 1` → *Set color* to the "wrong" flash (red)
- Action: `Audio` → *Play* `wrong.wav`
- Action: System → *Wait* `0.3` seconds
- Action: System → *Call function* `ClearSelection`

### The word-list-as-array approach

`WordList` is a Construct **Array** object loaded from JSON, not a hand-typed set of conditions. For this phase, type a short literal JSON string directly into an action's parameter:

**Event — Load the test word list**
- Condition: System → *On start of layout*
- Action: `WordList` → *Load from JSON string* `["CAT","DOG","BIRD","STAR","MOON","TREE","FISH","BLOOM"]` — keep every entry uppercase, since `LetterTile.Letter` is generated uppercase in `BuildGrid` and the `IndexOf` comparison is case-sensitive.

Phase 4 replaces this literal string with the full bundled dictionary loaded from a project file.

**Checkpoint:** dragging across tiles that spell one of the test words (e.g. `CAT`) adds to score, flashes the tiles green, and clears the selection. Dragging any combination *not* in the list flashes red and clears with no score change. Test both paths before moving on.

---

## Phase 2 — Scoring, levels, hints

### Scoring

**Event — Release: word is valid** (extend the event from Phase 1)
- Action (add before `ClearSelection`): System → *Add* `(len(CurrentWord) - 2) * 15` to global `Score` — a 3-letter word adds 15, a 4-letter word adds 30, a 5-letter word adds 45, and so on, rewarding longer words without needing a lookup table.
- Action: `ScoreText` → *Set text* to `"Score: " & Score`
- Action: System → *Add* `1` to global `WordsFoundThisLevel`

### Level progression

Add globals: `Level` (Number, `1`), `WordsFoundThisLevel` (Number, `0`), `WordsNeededThisLevel` (Number, `5`).

**Function `NextLevel`** (no parameters):
- Action: System → *Add* `1` to `Level`
- Action: System → *Set value* `WordsFoundThisLevel` to `0`
- Action: System → *Set value* `WordsNeededThisLevel` to `5 + Level * 2` (each level asks for two more words than the last)
- Action: `LevelText` → *Set text* to `"Level " & Level`
- Action: System → *For each* `LetterTile` → *Destroy*
- Action: System → *For each* `LetterLabel` → *Destroy*
- Action: System → *Call function* `BuildGrid`

**Event — Level complete**
- Condition: System → *Compare two values*: `WordsFoundThisLevel >= WordsNeededThisLevel`
- Action: System → *Call function* `NextLevel`

### Hint system

Add a `HintButton` sprite and a global `HintCost` (Number, `50`). Because a hint that reveals letters toward *any* dictionary word is unbuildable without pathfinding logic a no-code event sheet can't reasonably express, Word Bloom's hint nudges toward a short **per-level target list** instead: add an Array `TargetWords` (e.g. 3-5 curated words per level, set alongside `BuildGrid`) and a same-length Array `TargetFound` tracking which of them the player has already spelled.

**Event — Hint button tapped, itch build (no ad SDK — see platform-web-portals.md's own-ads rule)**
- Condition: `Touch` → *On touched* `HintButton`
- Condition: System → *Compare two values*: `Score >= HintCost`
- Action: System → *Subtract* `HintCost` from `Score`
- Action: System → *Call function* `RevealLetter`

**Event — Hint button tapped, portal build (ad-gated)**
- Condition: `Touch` → *On touched* `HintButton`
- Action: call the portal's rewarded-ad action from its SDK plugin (added in the Ship-it Challenge below) — e.g. *Call Rewarded Ad*
- Separate event, condition: the SDK plugin's *On Rewarded Ad Completed* trigger → Action: System → *Call function* `RevealLetter`

**Function `RevealLetter`** (no parameters):
- Action: System → *Pick* the first entry in `TargetWords` whose matching `TargetFound` entry is still `0`
- Action: System → *Pick* one `LetterTile` where `IsSelected = 0` whose `Letter` matches the next unrevealed letter of that target word
- Action: `LetterTile` → *Set color* to a gold "hint" flash for 2 seconds — this nudges the player toward a tile, it does not auto-select it for them, so the word still has to be dragged out by hand.

Keep the two hint-button events mutually exclusive per exported build — the itch export keeps the cost-based event and drops the SDK one; the portal export does the reverse. Phase 5 and the Ship-it Challenge cover why you'll maintain two build variants.

**Checkpoint:** finishing `WordsNeededThisLevel` correct words advances `Level`, rebuilds the grid, and resets the counter — get from level 1 to level 3 in one play session without restarting the project. Tapping the hint button (cost-based version) spends `HintCost` points and visibly flashes a tile toward one of that level's target words.

---

## Phase 3 — Asset spec sheet

Follow the placeholder-then-final workflow in [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) — mechanics first, real art last. Construct has one advantage worth using during the placeholder pass: double-click any Sprite's frame thumbnail in its Properties panel to open Construct's **built-in image editor** and draw directly inline (flat colors, simple shapes) without leaving the browser tab or opening an external tool.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `letter_tile.png` | 96×96 PNG | rounded-square tile background, neutral color, subtle bevel | Kenney |
| SPRITE | `letter_tile_selected.png` | 96×96 PNG | same tile, warm highlight glow, selected state | generated |
| SPRITE | `letter_tile_correct.png` | 96×96 PNG | tile flash frame, green glow, correct-word feedback | generated |
| SPRITE | `letter_tile_wrong.png` | 96×96 PNG | tile flash frame, red glow, wrong-word feedback | generated |
| BACKGROUND | `bg_main.png` | 1280×720 PNG | soft pastel garden/bloom theme behind the grid | generated |
| ICON | `hint_button.png` | 128×128 PNG, transparent | lightbulb icon button | Kenney |
| ICON | `settings_button.png` | 96×96 PNG, transparent | gear icon | Kenney |
| FONT | `ui_font.ttf` | rounded sans, legible small | score/level/UI text | Google Fonts |
| FONT | `letter_font.ttf` | bold sans/display face | big single-letter tile labels | Google Fonts |
| AUDIO | `bgm_loop.ogg` | ~60-90s seamless loop | light, cheerful background music | OpenGameArt |
| SFX | `tap.wav` | <0.3s | soft tile-tap click | generated |
| SFX | `correct.wav` | <0.6s | bright success chime | generated |
| SFX | `wrong.wav` | <0.4s | soft low buzz, not harsh | generated |
| SFX | `level_up.wav` | <1s | short fanfare | generated |

**Checkpoint:** the full game runs end-to-end with nothing but placeholders (Construct-editor-drawn boxes or the free Kenney fallbacks) in every slot on the sheet — no missing-asset errors in the Construct Preview console, every tile, button, and sound plays something even if it's not final.

---

## Phase 4 — The word list

### Sourcing it

Word Bloom needs a large, real English word list, not just Phase 1's 8-word test set — and it needs to be one you're actually allowed to ship. Use an openly-licensed list such as the **ENABLE** word list (a public-domain English word list widely used in word-game projects) or a comparable **SCOWL**-derived list. **Verify the license on the source page yourself before shipping it** — confirm it's actually public-domain or permissively licensed, not just "free to download," and note the source and license in a `CREDITS.md` in the project so the record travels with the game.

### Loading it into the array

1. Clean the raw word list into a single JSON array of uppercase strings — one pass to uppercase every entry, strip anything with non-`A`-`Z` characters or under 3 letters, and de-duplicate. Save it as `wordlist.json`.
2. In Construct's Project bar, right-click **Files** → **Add files** → add `wordlist.json` so it ships inside the exported build.
3. Replace Phase 1's literal-JSON loading event with this pair:

**Event — Request the bundled word list**
- Condition: System → *On start of layout*
- Action: `AJAX` → *Request project file* `"wordlist.json"`, tag `"loadwords"`

**Event — Word list finished loading**
- Condition: `AJAX` → *On completed* (tag = `"loadwords"`)
- Action: `WordList` → *Load from JSON string* `AJAX.LastData`

Keep this separate from `BuildGrid`'s `On start of layout` event — both conditions are true at layout start, so both actions fire; Construct runs every matching event on the same tick, in top-to-bottom order.

### Preload note

A full dictionary is a large file — swapping it in is exactly what triggers break-fix drill 3 below. Keep that in mind now: the *fix* belongs to that drill, but the *symptom* first shows up as soon as you make this swap.

**Checkpoint:** a wide variety of real English words you didn't hand-type into a test list — not just the original 8 — validate correctly, and a deliberately fake string (`ZZZQX`) still correctly rejects. Validation is now running against the full list, not the Phase 1 stub.

---

## Phase 5 — HTML5 export

1. **Project** menu → **Export** → choose the **Web (HTML5)** target in Construct's export wizard.
2. If Export is greyed out or a plan-upgrade dialog interrupts you here, that's the free-tier export gate flagged back in Phase 0 — this is exactly where it bites.
3. Construct outputs a folder containing `index.html` plus your assets. Because the game fetches `wordlist.json` (and other assets) via relative-path requests, opening `index.html` directly as a `file://` URL will fail — most browsers block that kind of local request as a CORS violation, and you'll see the game hang on load with a console error instead of a helpful message.
4. Serve the exported folder over a real local HTTP server before testing it: `npx serve <export-folder>` or, from inside the folder, `python -m http.server`, then open the printed `http://localhost:<port>` address in a browser.

**Checkpoint:** the exported build, served over `http://` (not `file://`), loads with zero errors in the browser's DevTools Console/Network tabs, and you can play a full round — form a word, watch score and level update, trigger a level-up — entirely from the exported files.

---

## Ship-it challenge

Ship two build variants from here on — one for itch, one for a portal — because of the own-ads rule in [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md) Section 6: **no portal SDK in the itch build, no ad network of your own in the portal build.**

**itch.io build:**
1. Zip the Phase 5 export so `index.html` sits at the root of the zip, not nested in a subfolder.
2. On itch.io, create a new project, set **Kind of project** to **HTML**, upload the zip, and check **"This file will be played in the browser"**.
3. Set the viewport width/height to match your game's canvas resolution, and turn on **Mobile friendly** since this is a touch-driven game.
4. Under **Pricing**, choose **"$0 or donate"** (pay-what-you-want) with an optional suggested amount.
5. Publish — itch has no review queue, it's live immediately. Full step detail is in `platform-web-portals.md` Section 1.

**Portal build:**
1. Pick one open-signup portal (CrazyGames or GameDistribution, per `platform-web-portals.md` Sections 2 and 4).
2. In Construct, open the **Addon Manager** (View menu) and install that portal's community/official SDK plugin — it wraps the portal's JavaScript SDK in visual actions like *Call Interstitial Ad*, *Set Gameplay Start*, *Set Gameplay Stop*.
3. Wire those actions into your event sheet: init on layout start, *Gameplay Start*/*Gameplay Stop* around actual play sessions, and an interstitial or the hint system's rewarded-ad call (Phase 2) at natural breaks — never mid-drag.
4. Export a second, portal-specific HTML5 build with that plugin included, and submit it through the portal's developer dashboard.

**Acceptance for this game: Word Bloom playable on itch.io, and submitted to a portal.** Both halves are required — an itch page with no portal submission, or a portal submission with no itch page, is not done.

---

## Break-fix drills

Diagnose before you open a hint. State the symptom, form a hypothesis, test it.

**Drill 1 — Export requires the paid tier**

You reach Phase 5, click **Project → Export → Web (HTML5)**, and either the option is disabled or a dialog interrupts asking you to upgrade before it will produce any output files. Figure out exactly which limit you hit — a project-size cap (event sheets/layouts) versus an export-specific gate — before deciding whether to trim the project down or upgrade the plan.

**Drill 2 — Validation rejects valid words**

You drag out a word you're sure is spelled correctly and real (say, `HOUSE`), the tiles clear as if it were wrong, but a shorter word using some of the same tiles validates fine moments later. Diagnose exactly what's different between what `CurrentWord` actually contains at the moment of the `IndexOf` check and what's actually stored inside `WordList`, before touching either side of the comparison.

**Drill 3 — A large word list slows load**

Right after the Phase 4 swap from the 8-word test list to the full bundled dictionary, the game's first load takes noticeably longer — worse on a phone-class device or inside a portal's iframe. Figure out where the time actually goes (the AJAX fetch itself, versus the `Load from JSON string` parse, versus something else entirely) before picking a fix, and design a preload strategy that keeps the player looking at something other than a blank canvas while it happens.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: Construct's plan tiers gate two different things — how big a project you're allowed to build, and whether you're allowed to export it at all. Read the exact wording of whatever dialog interrupted you, and cross-check it against the current plan comparison at Construct's own pricing page — "can't add another event sheet" and "can't export this project" are two different walls that look similar from inside the editor.
- Drill 2: Add a temporary debug `Text` object that displays `CurrentWord` wrapped in brackets (e.g. `"[" & CurrentWord & "]"`) right before the `IndexOf` check fires, and look closely at what's between the brackets versus what you typed into (or loaded into) `WordList` — case and stray whitespace are both invisible in a normal text display but not invisible between brackets.
- Drill 3: Time the AJAX request and the array parse as two separate steps, not one — a debug `Text` object showing a timestamp before the request, after the request completes, and after `Load from JSON string` finishes will show you which one is actually slow. Then decide whether the player needs the *entire* dictionary loaded before they can take their first drag, or whether a small starter list could let them start immediately while the full list finishes loading in the background.

</details>

---

## Done when

- [ ] Grid-based drag-to-select word formation works: valid words score and flash green, invalid ones clear and flash red (Phase 1)
- [ ] Scoring and level progression carry a player through at least 3 levels, and the hint system reveals a letter for a cost or an ad view (Phase 2)
- [ ] Every asset on the Phase 3 spec sheet is replaced with a final or properly licensed asset, with no missing-asset errors (Phase 3)
- [ ] The full bundled dictionary is loaded from a project file and used for validation, with its license verified and recorded (Phase 4)
- [ ] The HTML5 export runs cleanly from a local server with zero console errors (Phase 5)
- [ ] All three break-fix drills diagnosed and resolved
- [ ] Submitted to a web portal, and Word Bloom is live on itch.io.
