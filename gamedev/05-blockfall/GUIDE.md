# Guide — Game 05: Blockfall

This guide assumes you already have a working Godot 4 install and have exported at least one Android build before — that setup happens once in Game 01 and isn't repeated in full here. What's new in this game is the match-3 engine itself (Phase 1), and mediated ads (Phase 4), which have more moving parts than the plain single-network AdMob setup in Game 01. Read `../reference/assets-pipeline.md`, `../reference/platform-google-play.md`, and `../reference/monetization-ads.md` once before you start — this guide links back into them at the phases where they matter instead of repeating them.

---

## Phase 0 — Godot 4 mobile setup (reuse Game 01)

If you completed Game 01, you already have: Godot 4 installed, the Android SDK + a JDK configured under Editor Settings > Export > Android, an upload keystore generated and backed up, and at least one export preset that's produced a working `.apk` or `.aab` on a real or emulated device. None of that setup is genre-specific — reuse it as-is for Blockfall.

What's actually new for this project:

1. Create a fresh Godot 4 project named `blockfall` (or your own project name — this guide uses `blockfall` in every path below).
2. Run **Project > Install Android Build Template** once in the new project — this is per-project, not something that carries over from Game 01's project folder.
3. Add a new **Android** export preset (Project > Export > Add... > Android) and point its Keystore fields at the same `upload-keystore.jks` you already generated and backed up in Game 01 — you do not need a second keystore per game, one upload key covers every app you publish under the same Play Console account.
4. Set **Package / Unique Name** to your own reverse-domain ID for this game specifically (e.g. `com.yourstudio.blockfall`) — this must be different from Game 01's package name, since Play treats package name as the app's permanent identity.

**Checkpoint:** Android export ready — from the fresh `blockfall` project, Project > Export produces a working `.apk` (debug is fine at this stage) that installs and opens on a real device or emulator without crashing on launch.

---

## Phase 1 — Match mechanic

This is the core engine: a grid model, adjacent-cell swapping, match detection, clearing, gravity, refill, and combo/cascade scoring. Everything below lives in one script, `Board.gd`, attached to a `Node2D` named `Board` in your main scene.

The match-detection approach matters more than it looks: don't check only the two cells touched by a swap. Instead, scan every row and every column independently for runs of 3+ identical gem types, and union whatever you find into one set of cells to clear. Scanning full rows and columns — not just the swap point — is what makes L-shaped and T-shaped clusters clear correctly, since a single cell can belong to a horizontal run and a vertical run at the same time. A narrower "only check near the swap" version looks correct in casual testing (every match you create *by hand* is a straight line) and then silently misses matches that form from a cascade drop instead of a direct swap — that's exactly the bug in Break-fix drill 1 below, so build the full scan from the start.

```gdscript
# Board.gd — Blockfall core grid: swap, match, clear, gravity, refill, combo scoring
extends Node2D

const COLS := 8
const ROWS := 8
const GEM_TYPES := 6          # matches the 6 gem colors in the asset spec sheet (Phase 3)
const CELL_SIZE := 96.0       # on-screen pixels per cell
const GEM_COLORS := [
	Color(0.90, 0.20, 0.20), # red
	Color(0.20, 0.55, 0.90), # blue
	Color(0.25, 0.80, 0.35), # green
	Color(0.95, 0.85, 0.20), # yellow
	Color(0.75, 0.30, 0.85), # purple
	Color(0.95, 0.55, 0.15), # orange
]

var grid: Array = []          # grid[x][y] -> int gem type, -1 = temporarily empty mid-resolve
var gem_nodes: Array = []     # gem_nodes[x][y] -> ColorRect placeholder visual for that cell
var selected: Vector2i = Vector2i(-1, -1)
var busy := false             # true while a swap/cascade is resolving — blocks new input
var combo_count := 0
var score := 0

signal score_changed(new_score: int)
signal gems_cleared(types: Array)   # one int per cleared cell, captured before it's zeroed out
signal move_made                    # emitted once per valid swap, not once per cascade step

func _ready() -> void:
	randomize()
	_build_empty_grid()
	_fill_board_with_no_starting_matches()
	_draw_all_gems()

func _build_empty_grid() -> void:
	grid.clear()
	gem_nodes.clear()
	for x in COLS:
		grid.append([])
		gem_nodes.append([])
		for y in ROWS:
			grid[x].append(-1)
			gem_nodes[x].append(null)

# Fill every cell with a random gem type, re-rolling any cell that would
# create an immediate 3-in-a-row so the board doesn't start pre-solved.
func _fill_board_with_no_starting_matches() -> void:
	for x in COLS:
		for y in ROWS:
			var forbidden := []
			if x >= 2 and grid[x - 1][y] == grid[x - 2][y]:
				forbidden.append(grid[x - 1][y])
			if y >= 2 and grid[x][y - 1] == grid[x][y - 2]:
				forbidden.append(grid[x][y - 1])
			var gem_type := randi() % GEM_TYPES
			while gem_type in forbidden:
				gem_type = randi() % GEM_TYPES
			grid[x][y] = gem_type

func _draw_all_gems() -> void:
	for x in COLS:
		for y in ROWS:
			_spawn_gem_node(x, y)

func _spawn_gem_node(x: int, y: int) -> void:
	var rect := ColorRect.new()
	rect.size = Vector2(CELL_SIZE - 8, CELL_SIZE - 8)
	rect.position = Vector2(x * CELL_SIZE + 4, y * CELL_SIZE + 4)
	rect.color = GEM_COLORS[grid[x][y]]
	add_child(rect)
	gem_nodes[x][y] = rect

func _input(event: InputEvent) -> void:
	if busy:
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var local := to_local(event.global_position)
		var cell := Vector2i(int(local.x / CELL_SIZE), int(local.y / CELL_SIZE))
		if cell.x < 0 or cell.x >= COLS or cell.y < 0 or cell.y >= ROWS:
			return
		_on_cell_clicked(cell)

func _on_cell_clicked(cell: Vector2i) -> void:
	if selected == Vector2i(-1, -1):
		selected = cell
		return
	if selected == cell:
		selected = Vector2i(-1, -1)   # clicked the same cell twice — deselect
		return
	if _is_adjacent(selected, cell):
		_try_swap(selected, cell)
		selected = Vector2i(-1, -1)
	else:
		selected = cell               # non-adjacent click — treat it as a new selection

func _is_adjacent(a: Vector2i, b: Vector2i) -> bool:
	return abs(a.x - b.x) + abs(a.y - b.y) == 1

func _try_swap(a: Vector2i, b: Vector2i) -> void:
	_swap_values(a, b)
	var matched := _find_matches()
	if matched.is_empty():
		_swap_values(a, b)        # invalid move — no match, swap back
		_redraw_cells([a, b])
		return
	move_made.emit()
	busy = true
	_redraw_cells([a, b])
	combo_count = 0
	await _resolve_cascade()
	busy = false

func _swap_values(a: Vector2i, b: Vector2i) -> void:
	var tmp: int = grid[a.x][a.y]
	grid[a.x][a.y] = grid[b.x][b.y]
	grid[b.x][b.y] = tmp

# Line-scan match detection: scan every row and every column for runs of
# 3+ identical gem types and union the results into one set of positions.
# This is the flood-fill-style full-board scan described above — it finds
# every qualifying run regardless of where the triggering swap happened.
func _find_matches() -> Array:
	var matched := {}    # Dictionary used as a set: Vector2i -> true
	for y in ROWS:
		var run_start := 0
		for x in range(1, COLS + 1):
			var broke: bool = x == COLS or grid[x][y] != grid[run_start][y] or grid[run_start][y] == -1
			if broke:
				if x - run_start >= 3:
					for rx in range(run_start, x):
						matched[Vector2i(rx, y)] = true
				run_start = x
	for x in COLS:
		var run_start := 0
		for y in range(1, ROWS + 1):
			var broke: bool = y == ROWS or grid[x][y] != grid[x][run_start] or grid[x][run_start] == -1
			if broke:
				if y - run_start >= 3:
					for ry in range(run_start, y):
						matched[Vector2i(x, ry)] = true
				run_start = y
	return matched.keys()

func _resolve_cascade() -> void:
	while true:
		var matched := _find_matches()
		if matched.is_empty():
			break
		combo_count += 1
		_clear_matches(matched)
		_apply_gravity()
		_refill_top()
		_redraw_all()
		await get_tree().create_timer(0.15).timeout   # Phase 2 replaces this with tween juice

func _clear_matches(matched: Array) -> void:
	var types := []
	for pos in matched:
		types.append(grid[pos.x][pos.y])
	var gained: int = matched.size() * 10 * combo_count
	score += gained
	score_changed.emit(score)
	gems_cleared.emit(types)
	for pos in matched:
		grid[pos.x][pos.y] = -1

func _apply_gravity() -> void:
	for x in COLS:
		var write_y := ROWS - 1
		for y in range(ROWS - 1, -1, -1):
			if grid[x][y] != -1:
				var val: int = grid[x][y]
				if write_y != y:
					grid[x][y] = -1
				grid[x][write_y] = val
				write_y -= 1
		# every remaining slot at y <= write_y is empty; _refill_top fills it

func _refill_top() -> void:
	for x in COLS:
		for y in ROWS:
			if grid[x][y] == -1:
				grid[x][y] = randi() % GEM_TYPES

func _redraw_all() -> void:
	for x in COLS:
		for y in ROWS:
			gem_nodes[x][y].color = GEM_COLORS[grid[x][y]]
			gem_nodes[x][y].scale = Vector2.ONE   # undo any clear-animation scale from Phase 2

func _redraw_cells(cells: Array) -> void:
	for pos in cells:
		gem_nodes[pos.x][pos.y].color = GEM_COLORS[grid[pos.x][pos.y]]
```

Scene setup: a `Board` `Node2D` with this script attached is enough — the script spawns its own `ColorRect` children for gems, so there's nothing else to wire up in the editor for this phase.

**Checkpoint:** a swap that makes a match clears and refills — click two adjacent gems that produce a 3+ run, watch those cells clear, the column above drop down, and new random gems appear at the top. Click two adjacent gems that *don't* produce a match and confirm they swap back instead of clearing.

---

## Phase 2 — Levels, objectives, moves-limited mode, juice

Wrap `Board` in a `Level` node that tracks an objective and a moves counter, and add tween/particle juice so clears read as satisfying instead of instant and flat.

```gdscript
# Level.gd — objective + moves-limited win/lose wrapper around Board
extends Node2D

enum Objective { SCORE_TARGET, CLEAR_COLOR }

@export var objective_type: Objective = Objective.SCORE_TARGET
@export var target_score := 1000
@export var target_color := 0     # gem type index, only used for CLEAR_COLOR objectives
@export var target_color_count := 20
@export var max_moves := 15

var moves_left: int
var color_cleared := 0

@onready var board: Node2D = $Board

signal level_won
signal level_lost

func _ready() -> void:
	moves_left = max_moves
	board.score_changed.connect(_on_score_changed)
	board.gems_cleared.connect(_on_gems_cleared)
	board.move_made.connect(_on_move_made)

func _on_score_changed(new_score: int) -> void:
	if objective_type == Objective.SCORE_TARGET and new_score >= target_score:
		level_won.emit()

func _on_gems_cleared(types: Array) -> void:
	if objective_type != Objective.CLEAR_COLOR:
		return
	for gem_type in types:
		if gem_type == target_color:
			color_cleared += 1
	if color_cleared >= target_color_count:
		level_won.emit()

func _on_move_made() -> void:
	moves_left -= 1
	if moves_left <= 0 and not _objective_met():
		level_lost.emit()

func _objective_met() -> bool:
	match objective_type:
		Objective.SCORE_TARGET:
			return board.score >= target_score
		Objective.CLEAR_COLOR:
			return color_cleared >= target_color_count
	return false
```

Three levels means three `Level` scenes (or one scene with the `@export` fields overridden per level resource) — vary `objective_type`, `target_score`/`target_color`, and `max_moves` so level 1 is close to unloseable and level 3 is genuinely tight on moves.

For juice, swap `Board`'s plain `await get_tree().create_timer(0.15).timeout` cascade delay for a scale-pop tween plus a particle burst per cleared gem:

```gdscript
# Juice — call this from Board._resolve_cascade in place of the plain timer,
# right after _clear_matches and before _apply_gravity/_redraw_all.
func _play_clear_juice(matched: Array) -> void:
	for pos in matched:
		var node: ColorRect = gem_nodes[pos.x][pos.y]
		var tween := create_tween()
		tween.tween_property(node, "scale", Vector2(1.4, 1.4), 0.08)
		tween.tween_property(node, "scale", Vector2(0.0, 0.0), 0.12)
		var burst := CPUParticles2D.new()
		burst.position = node.position + node.size / 2
		burst.amount = 12
		burst.lifetime = 0.4
		burst.one_shot = true
		burst.color = node.color
		add_child(burst)
		burst.emitting = true
		burst.finished.connect(burst.queue_free)
	await get_tree().create_timer(0.25).timeout
```

Play the match SFX (Phase 3's `match.wav`) alongside this tween with a plain `AudioStreamPlayer.play()` call — one shared player node reused for every clear is enough, you don't need one player per gem.

**Checkpoint:** a level can be won/lost by moves — set `max_moves` low enough on a test level that you can deliberately run it out without hitting the score/color target, and confirm `level_lost` fires. Then confirm `level_won` fires on a level where you deliberately hit the objective before moves run out.

---

## Phase 3 — Asset spec sheet

Full spec-sheet format and placeholder philosophy is in `../reference/assets-pipeline.md` — this section is Blockfall's actual sheet, not a repeat of the general rules. Build and test every phase above against placeholders before touching this list for real.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `res://assets/gems/gem_red.png` | 128×128 PNG, transparent | round faceted gem, red, flat 2D game-asset style | Kenney |
| SPRITE | `res://assets/gems/gem_blue.png` | 128×128 PNG, transparent | round faceted gem, blue, same style as gem_red | Kenney |
| SPRITE | `res://assets/gems/gem_green.png` | 128×128 PNG, transparent | round faceted gem, green, same style as gem_red | Kenney |
| SPRITE | `res://assets/gems/gem_yellow.png` | 128×128 PNG, transparent | round faceted gem, yellow, same style as gem_red | Kenney |
| SPRITE | `res://assets/gems/gem_purple.png` | 128×128 PNG, transparent | round faceted gem, purple, same style as gem_red | Kenney |
| SPRITE | `res://assets/gems/gem_orange.png` | 128×128 PNG, transparent | round faceted gem, orange, same style as gem_red | Kenney |
| SPRITE | `res://assets/board/frame.png` | 900×900 PNG, transparent center | ornate board frame surrounding the 8x8 grid, single consistent style | Kenney |
| SPRITE | `res://assets/fx/clear_particle.png` | 32×32 PNG, transparent | small sparkle/star, used as the `CPUParticles2D` texture on clears | generated |
| SFX | `res://assets/audio/match.wav` | under 0.5s | crisp match-clear chime, bright and quick | generated |
| AUDIO | `res://assets/audio/bgm_loop.ogg` | ~60s seamless loop, ~100bpm | cheerful, unobtrusive puzzle bgm, loopable | OpenGameArt |

Placeholders for every `gem_*` row are the six `Color(...)` values already hardcoded in `GEM_COLORS` in Phase 1's `Board.gd` — you don't need placeholder image files at all for gems, the `ColorRect` nodes are the placeholder. The `128×128` spec column is the import size for the *final* PNG once you swap it in; it has no bearing on `CELL_SIZE` (96px on-screen), since the engine scales the imported texture into a `Sprite2D` at whatever size you set — texture source resolution and on-screen cell size are independent numbers.

**Checkpoint:** runs with placeholders — the game plays a full level start to finish (Phase 1 + Phase 2) using only the six `GEM_COLORS` rectangles, no board frame, no particle texture, and no audio, with every spec-sheet row above filled in with a real `fallback` value (not left blank) so you know where to get a same-spec replacement the moment AI generation doesn't produce something usable.

---

## Phase 4 — Ads with mediation

Read `../reference/monetization-ads.md` section 3 (Mediation) before this phase — it covers the concept once for every game in this track; this section is only Blockfall's concrete wiring. AdMob stays the base ad network underneath; LevelPlay (ironSource's mediation platform) sits on top of it and arbitrates which network actually serves each impression. In Godot, that means installing the Android-side LevelPlay plugin (from the Godot Asset Library, packaged as an AAR) alongside the AdMob adapter it mediates, rebuilding your custom Android export with the plugin enabled, and driving it from GDScript through Godot's `Engine.get_singleton()` bridge to the plugin's exposed native methods.

**Always develop and test against the well-known Android test ad unit IDs, never real ones, until you're building the actual release candidate:**

| Format | Android test ad unit ID |
|---|---|
| Banner | `ca-app-pub-3940256099942544/6300978111` |
| Rewarded video | `ca-app-pub-3940256099942544/5224354917` |

```gdscript
# Ads.gd — autoload singleton: LevelPlay-mediated rewarded "continue" + banner
extends Node

# Test IDs only — see ../reference/monetization-ads.md for why real IDs never
# belong in a dev build, and swap these behind a debug/release flag before
# building the release candidate in Phase 5.
const BANNER_TEST_ID := "ca-app-pub-3940256099942544/6300978111"
const REWARDED_TEST_ID := "ca-app-pub-3940256099942544/5224354917"

var rewarded_ready := false

signal rewarded_ad_completed
signal rewarded_ad_failed

func _ready() -> void:
	# LevelPlay's Android plugin registers itself as an Engine singleton once
	# the custom Android export build with the plugin AAR is running — this
	# branch is skipped entirely in the editor, which is expected.
	if Engine.has_singleton("LevelPlay"):
		var level_play := Engine.get_singleton("LevelPlay")
		level_play.connect("rewardedAdReady", Callable(self, "_on_rewarded_ready"))
		level_play.connect("rewardedAdRewarded", Callable(self, "_on_rewarded_earned"))
		level_play.connect("rewardedAdClosed", Callable(self, "_on_rewarded_closed"))
		level_play.init(REWARDED_TEST_ID)
		level_play.loadBanner(BANNER_TEST_ID)

func _on_rewarded_ready() -> void:
	rewarded_ready = true

func show_continue_ad() -> void:
	if not rewarded_ready:
		rewarded_ad_failed.emit()
		return
	Engine.get_singleton("LevelPlay").showRewarded()

func _on_rewarded_earned() -> void:
	rewarded_ad_completed.emit()

func _on_rewarded_closed() -> void:
	rewarded_ready = false
	Engine.get_singleton("LevelPlay").loadRewarded(REWARDED_TEST_ID)
```

Hook the "continue" offer into `Level.gd`'s existing `_on_move_made`, replacing the direct `level_lost.emit()` with an offer to watch a rewarded ad first:

```gdscript
# Level.gd — replaces the direct level_lost.emit() in _on_move_made from Phase 2
func _on_move_made() -> void:
	moves_left -= 1
	if moves_left <= 0 and not _objective_met():
		_offer_continue()

func _offer_continue() -> void:
	Ads.rewarded_ad_completed.connect(_on_continue_granted, CONNECT_ONE_SHOT)
	Ads.rewarded_ad_failed.connect(_on_continue_unavailable, CONNECT_ONE_SHOT)
	Ads.show_continue_ad()

func _on_continue_granted() -> void:
	Ads.rewarded_ad_failed.disconnect(_on_continue_unavailable)
	moves_left += 5   # extra moves granted for watching the rewarded ad

func _on_continue_unavailable() -> void:
	Ads.rewarded_ad_completed.disconnect(_on_continue_granted)
	level_lost.emit()
```

Dock the banner at the bottom edge of the screen, never over the grid itself — a mis-tap on a banner sitting on top of active gameplay is the single most common ad-placement rejection reason called out in `../reference/monetization-ads.md`.

**Checkpoint:** the rewarded "continue" grants extra moves in test mode — run out of moves on a test level with `max_moves` set low, confirm the rewarded ad (test creative) plays, and confirm `moves_left` increases by 5 afterward instead of the level ending. Also confirm the banner is visible and docked at an edge, not overlapping the grid.

---

## Phase 5 — AAB + closed testing

Full AAB build steps and account/keystore setup are in `../reference/platform-google-play.md` sections 2-3 (Godot path) — this phase is only what's specific to Blockfall on top of that.

1. Before exporting, swap `BANNER_TEST_ID`/`REWARDED_TEST_ID` in `Ads.gd` for your real AdMob ad unit IDs (created under the same AdMob app you linked to this Play Console listing), gated behind a debug/release build flag so a debug build never accidentally requests real ads.
2. Confirm the LevelPlay app entry has your AdMob adapter installed and enabled (see Break-fix drill 3 below if ads stop showing after this swap) and that the mediation instance's ad unit references match what you just set.
3. In the Android export preset, confirm **Package / Unique Name** is your real `com.yourstudio.blockfall`-style ID (not a placeholder), version code incremented from any prior test upload, and the release keystore fields point at your real upload key.
4. Export with **Export With Debug** unchecked and a save path ending in `.aab`.

**Checkpoint:** `.aab` produced — a signed Android App Bundle exists on disk, and `bundletool` (or a device install via `bundletool build-apks` + install) confirms it installs and opens without crashing.

---

## Ship-it challenge

Upload the `.aab` from Phase 5 to Google Play closed testing (`../reference/platform-google-play.md` section 5 covers the testing ladder and the 12-tester/14-day continuous requirement that gates production access later). Add at least a few real testers by email, get them the opt-in link, and once at least one tester has the build installed, personally play through a level to exhaustion and confirm the rewarded "continue" ad actually plays and grants extra moves on that real uploaded build — not just in the editor.

**Acceptance:** Blockfall is in Google Play closed testing, and the mediated rewarded "continue" ad has been confirmed working on the actual uploaded build, on a real or emulated device, by a real tester opt-in — not just locally in the editor.

---

## Break-fix drills

No solutions below — these are symptoms to diagnose using what Phase 1 and Phase 4 already gave you.

**1. Match detection misses L/T shapes.** Suppose a refactor narrows `_find_matches` to only check the row and column that a swap actually touched, instead of scanning the whole board — every match you create by hand during testing still works (a straight 3-in-a-row from a direct swap always passes), but a cluster that only becomes an L or T shape after a *cascade* drop (not a direct swap) silently never clears.

<details>
<summary>Hint (open only if stuck)</summary>

Compare the narrowed version against Phase 1's actual `_find_matches` — it scans every row and every column on the whole grid, unconditionally, every time it's called, regardless of what triggered the call. Ask what information a "only check near the swap" version has access to versus what a full-board scan has access to, and where an L/T cluster's third arm could be sitting relative to the original swap point.

</details>

**2. The board deadlocks with no valid moves.** After enough cascades, the board can settle into a state where no adjacent swap anywhere on the grid produces a match — no error, no crash, the player is just stuck with an unwinnable board and doesn't know it.

<details>
<summary>Hint (open only if stuck)</summary>

Nothing in Phase 1 or Phase 2 ever checks whether the settled board *has* a legal move — `_resolve_cascade` stops the moment `_find_matches` comes back empty and just hands control back to the player. Think about what it would take to try every adjacent swap on a copy of the grid, right after a cascade finishes, without actually committing any of them — and what should happen to the whole board, not just one cell, if none of those trial swaps produce a match.

</details>

**3. Mediation shows no ads.** `LevelPlay.init()` runs with no errors, `rewardedAdReady` and any banner callback simply never fire — no crash, no exception, just permanent silence from the SDK.

<details>
<summary>Hint (open only if stuck)</summary>

A missing ad network adapter and a live (non-test) account with zero real demand produce the exact same symptom from the callback side: nothing fires, nothing errors. Check the LevelPlay dashboard for whether the AdMob adapter is actually listed as installed for this app's mediation instance, separately from whether your test device is registered for test-mode ads — one or the other being off is enough to look like total silence.

</details>

---

## Done when

- [ ] Grid engine works: adjacent swaps that make a match clear, gravity refills the column, cascades combo-score correctly, and L/T-shaped clusters clear (not just straight lines)
- [ ] At least 3 levels exist, each with a real objective and a moves-limited fail state, and both a win and a loss have been triggered deliberately
- [ ] Clears have tween scale-pop + particle juice and play a match SFX; a bgm loop plays during gameplay
- [ ] The asset spec sheet is filled in completely and every `gem_*`/frame/particle/SFX/bgm placeholder has been swapped for an AI-generated (or fallback-sourced) final
- [ ] AdMob banner and rewarded ad are wired through LevelPlay mediation and confirmed working in test mode, including the extra-moves grant on continue
- [ ] A signed `.aab` with real ad unit IDs has been exported and uploaded to Google Play
- [ ] Blockfall is in closed testing with a working rewarded ad
