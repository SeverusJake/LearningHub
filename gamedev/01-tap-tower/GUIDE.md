# Guide — Game 01: Tap Tower

A one-tap stacker: a block slides, you tap to drop it, overlap trims the next block, a miss ends the run. This guide builds it in Godot 4 from empty project to a signed build live in Google Play internal testing.

Conventions used below:

- Shell commands run in a plain bash shell (Git Bash on Windows, or any Unix terminal).
- Every phase builds directly on the previous one's code — nothing gets rewritten from scratch later, only extended.
- Two shared reference docs get linked instead of repeated inline: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) (placeholder-to-final art workflow) and [`../reference/monetization-ads.md`](../reference/monetization-ads.md) (ad formats and AdMob concepts). [`../reference/platform-google-play.md`](../reference/platform-google-play.md) covers everything Play-Console- and signing-specific.

---

## Phase 0 — Install Godot 4, Android export templates, JDK + Android SDK

1. **Godot 4 itself.** Go to [godotengine.org/download](https://godotengine.org/download), grab the Windows 64-bit **Standard** build (not the .NET/C# build — this track uses GDScript), unzip it anywhere, and run the `.exe`. No installer, no admin rights needed.

   Verify from a terminal:

   ```bash
   ./Godot_v4.*_win64.exe --version
   ```

   Expected output: a version string like `4.3.stable.official.77dcf97d8`.

2. **Android export templates.** Inside Godot: **Editor > Manage Export Templates > Download and Install**. This pulls the templates matching your exact Godot version automatically. If you're offline or the auto-download fails, download the matching `.tpz` from [godotengine.org/download/archive](https://godotengine.org/download/archive) and use **Install from File** instead.

   Expected result: the Manage Export Templates window shows a green "Current Version Installed" line, not a red "not installed" one.

3. **JDK 17.** Godot 4's Android export needs a JDK to run Gradle. Install Eclipse Temurin 17 from [adoptium.net](https://adoptium.net).

   ```bash
   java -version
   ```

   Expected output: a line containing `openjdk version "17` (any 17.x build is fine).

4. **Android SDK.** Easiest path: install Android Studio from [developer.android.com/studio](https://developer.android.com/studio) and let it install the SDK during first-run setup — you don't need to open Android Studio itself again after this, Godot only needs the SDK folder it leaves behind (typically `%LOCALAPPDATA%\Android\Sdk` on Windows).

   ```bash
   sdkmanager --version
   ```

   Expected output: a short version string (exact number depends on which SDK command-line tools shipped with your Android Studio install — any recent version is fine).

5. **Point Godot at both.** In Godot: **Editor Settings > Export > Android**, set:
   - **Android SDK Path** — the SDK folder from step 4
   - **Java SDK Path** — the JDK folder from step 3 (skip this field if Godot auto-detects `JAVA_HOME`)

   Godot validates both paths live and shows green text next to each when they resolve correctly, red when they don't.

6. **Confirm the whole chain with a throwaway project.** Godot's Project Manager → **New Project** → name it anything → open it → **Project > Install Android Build Template** (adds an `android/` folder, needed for any custom export) → **Project > Export** → **Add... > Android**.

**Checkpoint:** Godot opens without error, and the Android export preset you just added shows no red "No export template found" or "Android SDK not correctly configured" banner — either a clean preset with no warnings, or only the expected placeholder warnings about an unset keystore (which Phase 5 fixes). Delete this throwaway project once confirmed; Phase 1 starts a real one.

---

## Phase 1 — Project + core mechanic

**New project setup.** Project Manager → **New Project** → name it `tap-tower`. Once it's open:

- **Project > Project Settings > Display > Window**: set **Viewport Width** `720`, **Viewport Height** `1280` (portrait, matches a phone), **Stretch > Mode** `canvas_items`, **Stretch > Aspect** `keep`.
- **Project > Project Settings > Display > Window > Handheld**: set **Orientation** to `portrait`.

**Scene tree.** In the Scene dock: create a new scene, root node type `Node2D`, rename it `Main`. Add one child: `Node2D` named `Tower`. Save as `res://Main.tscn`, and set it as the app's start scene (**Project > Project Settings > Application > Run > Main Scene**, point it at `Main.tscn`).

Attach a new script to the `Main` node, `res://Main.gd`, with this code:

```gdscript
extends Node2D

const BLOCK_HEIGHT := 40.0
const START_WIDTH := 200.0
const START_SPEED := 220.0

var blocks: Array = []
var current: Dictionary = {}
var current_node: ColorRect = null
var direction: int = 1
var slide_speed: float = START_SPEED
var score: int = 0
var game_over: bool = false

@onready var tower: Node2D = $Tower

func _ready() -> void:
	var viewport_size: Vector2 = get_viewport_rect().size
	tower.position = Vector2(0, viewport_size.y - 120)
	_spawn_base()
	_spawn_next_block()

func _spawn_base() -> void:
	var viewport_width: float = get_viewport_rect().size.x
	var base_x: float = (viewport_width - START_WIDTH) / 2.0
	blocks.append({"x": base_x, "width": START_WIDTH})
	_draw_block(base_x, START_WIDTH, 0)

func _draw_block(x: float, width: float, index: int) -> ColorRect:
	var rect := ColorRect.new()
	rect.size = Vector2(width, BLOCK_HEIGHT)
	rect.position = Vector2(x, -index * BLOCK_HEIGHT)
	rect.color = Color(0.2, 0.7, 0.9)
	tower.add_child(rect)
	return rect

func _spawn_next_block() -> void:
	var top: Dictionary = blocks[blocks.size() - 1]
	current = {"x": 0.0, "width": top["width"]}
	direction = 1
	current_node = _draw_block(0.0, top["width"], blocks.size())
	current_node.color = Color(1.0, 0.6, 0.1)

func _process(delta: float) -> void:
	if game_over or current_node == null:
		return
	var viewport_width: float = get_viewport_rect().size.x
	var new_x: float = current["x"] + direction * slide_speed * delta
	if new_x <= 0.0:
		new_x = 0.0
		direction = 1
	elif new_x + current["width"] >= viewport_width:
		new_x = viewport_width - current["width"]
		direction = -1
	current["x"] = new_x
	current_node.position = Vector2(new_x, current_node.position.y)

func _unhandled_input(event: InputEvent) -> void:
	if game_over:
		return
	if event is InputEventScreenTouch and event.pressed:
		_drop_block()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		_drop_block()
	elif event.is_action_pressed("ui_accept"):
		_drop_block()

func _drop_block() -> void:
	var top: Dictionary = blocks[blocks.size() - 1]
	var overlap_left: float = max(current["x"], top["x"])
	var overlap_right: float = min(current["x"] + current["width"], top["x"] + top["width"])
	var overlap_width: float = overlap_right - overlap_left

	if overlap_width <= 0.0:
		_end_game()
		return

	current["x"] = overlap_left
	current["width"] = overlap_width
	current_node.position = Vector2(overlap_left, current_node.position.y)
	current_node.size = Vector2(overlap_width, BLOCK_HEIGHT)
	current_node.color = Color(0.2, 0.7, 0.9)

	blocks.append(current.duplicate())
	tower.position = Vector2(tower.position.x, tower.position.y + BLOCK_HEIGHT)
	score += 1
	print("Score: %d" % score)

	current_node = null
	_spawn_next_block()

func _end_game() -> void:
	game_over = true
	if current_node:
		current_node.color = Color(0.9, 0.1, 0.1)
	print("GAME OVER — final score: %d" % score)
```

Notes on what this does, since the "why" matters more than the syntax here: `Tower` is a container whose `position.y` creeps downward by exactly `BLOCK_HEIGHT` every time a block lands — because each block's own local position also moves up by `BLOCK_HEIGHT` per index, the two cancel out and the newest block always renders at the same screen height, while older blocks visually sink. That's the whole "camera follows the tower" illusion, with no camera involved. The overlap math in `_drop_block` is just interval intersection: `max` of the two left edges, `min` of the two right edges — if the result is negative or zero, there's no overlap left and the run ends.

`ui_accept` is a built-in Godot input action already bound to Space and Enter by default — no Input Map setup needed for keyboard testing. Mouse click and touch are both handled directly in code so the same build works on your desktop while developing and on an Android device later.

**Checkpoint:** Press **F5** to run. A blue base block sits near the bottom, an orange block slides left-right above it. Click, press Space, or tap to drop it — it snaps to the overlap, turns blue, and a new orange block spawns above, sliding at the same speed. The Output panel at the bottom of the editor prints `Score: 1`, `Score: 2`, and so on with every successful drop. Deliberately let a drop miss (drop it while it's fully past one edge of the block below) — Output prints `GAME OVER — final score: N` and further taps/clicks do nothing. You can stack, and you can lose.

---

## Phase 2 — UI, game over + restart, difficulty ramp

**Scene tree additions.** Under `Main`, add a `CanvasLayer` named `UI`. Under `UI`:

- A `Label` named `ScoreLabel`. Set its **Text** to `Score: 0`, position it near the top of the screen (e.g. `position = (20, 40)` in the Inspector's Transform section).
- A `Control` named `GameOverPanel`. Select it, then in the toolbar above the viewport use **Layout > Anchors Preset > Full Rect** so it covers the whole screen. In the Inspector, uncheck **Visible** so it starts hidden.
  - Under `GameOverPanel`, add a `Label` named `GameOverLabel`, text `GAME OVER`, centered.
  - Add a `Label` named `FinalScoreLabel` below it, text `Final score: 0`.
  - Add a `Button` named `RestartButton` below that, text `Restart`.

Extend `Main.gd` — add these declarations near the top, alongside the existing `@onready var tower`:

```gdscript
const SPEED_INCREMENT := 14.0

@onready var score_label: Label = $UI/ScoreLabel
@onready var game_over_panel: Control = $UI/GameOverPanel
@onready var final_score_label: Label = $UI/GameOverPanel/FinalScoreLabel
@onready var restart_button: Button = $UI/GameOverPanel/RestartButton
```

Add one line at the end of `_ready()`:

```gdscript
	restart_button.pressed.connect(_on_restart_pressed)
```

Update `_drop_block()` — add these two lines right after `score += 1`:

```gdscript
	score_label.text = "Score: %d" % score
	slide_speed += SPEED_INCREMENT
```

Update `_end_game()` to show the panel instead of only printing:

```gdscript
func _end_game() -> void:
	game_over = true
	if current_node:
		current_node.color = Color(0.9, 0.1, 0.1)
	print("GAME OVER — final score: %d" % score)
	final_score_label.text = "Final score: %d" % score
	game_over_panel.visible = true
```

Add the restart handler:

```gdscript
func _on_restart_pressed() -> void:
	get_tree().reload_current_scene()
```

`reload_current_scene()` is the entire reset mechanism — it throws away every node and re-runs `_ready()` from a clean slate, so there's no manual bookkeeping to reset `score`, `slide_speed`, or `blocks` by hand.

**Checkpoint:** Run the scene. `Score: N` updates live in the top-left as you stack. Compare block 1's crawl speed to block 8's — it's visibly, noticeably faster (14 px/sec added per block adds up fast). Miss a drop: the Game Over panel covers the screen showing your final score, no further taps register on the tower underneath it, and clicking **Restart** reloads the scene back to `Score: 0` at the original slide speed.

---

## Phase 3 — Asset spec sheet (placeholders now, finals later)

Full placeholder-to-final workflow lives in [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) — this section is just Tap Tower's spec sheet, written per that doc's format, before any final asset exists.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `res://art/block.png` | 128×128 PNG, transparent background | flat-color block/brick tile, single object, centered, palette matching the in-game blue (stacked) / orange (active) blocks | Kenney (Puzzle Pack or Isometric Blocks) |
| BACKGROUND | `res://art/background.png` | 720×1280 PNG, portrait, matches project viewport | soft vertical gradient sky or minimal low-detail geometric backdrop — plain enough that falling blocks stay easy to read against it | Kenney, or generated |
| SFX | `res://audio/tap.wav` | WAV, under 0.5s | short, crisp tap/click, plays on every successful drop | generated |
| AUDIO | `res://audio/bgm_loop.ogg` | OGG, ~30-60s, seamless loop, ~120bpm | light chiptune or lo-fi loop, unobtrusive under active gameplay | OpenGameArt |

Placeholders right now: the `block.png` row is standing in for the `ColorRect` blocks already in the scene from Phase 1, and `background.png` is about to be a plain `ColorRect` too. `tap.wav` and `bgm_loop.ogg` don't need placeholder audio files at all — silent `AudioStreamPlayer` nodes with no stream assigned are the placeholder.

**Scene tree additions.** Add a `ColorRect` named `Background` as a child of `Main`, positioned **above** `Tower` in the Scene dock's list (earlier siblings draw behind later ones in 2D, so `Background` must be listed first). Give it **Layout > Anchors Preset > Full Rect** and a plain placeholder color (light gray or pale blue). Add two `AudioStreamPlayer` nodes as children of `Main`: `TapSFX` and `BGM` — leave both with no **Stream** assigned for now.

Extend `Main.gd`:

```gdscript
@onready var tap_sfx: AudioStreamPlayer = $TapSFX
@onready var bgm: AudioStreamPlayer = $BGM
```

Add to the end of `_ready()`:

```gdscript
	if bgm.stream != null:
		bgm.play()
```

Add to `_drop_block()`, right after the `slide_speed += SPEED_INCREMENT` line from Phase 2:

```gdscript
	if tap_sfx.stream != null:
		tap_sfx.play()
```

The `if ... != null` guards are the whole point: they let the game run cleanly with zero audio files in the project — no missing-resource errors, no crashes — and the moment a real `tap.wav`/`bgm_loop.ogg` gets dropped into `res://audio/` and assigned to these players' **Stream** field, sound starts playing with no other code change.

When the real assets are ready, follow [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) section 5's swap procedure exactly: drop files at the paths in the table above, reimport, then swap the `Background` `ColorRect` and each block's `ColorRect` for `Sprite2D`/`TextureRect` nodes referencing the new textures (stretched to each block's actual width × `BLOCK_HEIGHT` — the sprite is authored at 128×128 so it tiles/stretches cleanly at any in-game size) — and assign the two audio streams.

**Checkpoint:** Run the scene. A flat-color background fills the screen behind the tower, gameplay behaves exactly as in Phase 2, and the Output panel stays clean (no resource-not-found errors) even though `res://art/` and `res://audio/` don't have any files in them yet. That's "runs with placeholders."

---

## Phase 4 — AdMob (banner + interstitial, test IDs)

Read [`../reference/monetization-ads.md`](../reference/monetization-ads.md) section 2 (Godot path) before starting — it explains why test ad unit IDs are non-negotiable during development (real IDs risk your AdMob account getting flagged for invalid traffic from your own repeated test impressions).

1. In Godot: **AssetLib** tab (top of the editor, next to 2D/3D/Script) → search `admob` → install a plugin that explicitly lists Godot **4.x** support (plugin listings and exact API details shift over time — check the listing's own compatibility notes before installing).
2. **Project > Project Settings > Plugins** tab → enable the newly installed plugin.
3. **Project > Install Android Build Template** (skip if already done in Phase 0/1) — this is what lets the plugin's Android library get bundled into your export.
4. **Project > Export** → your Android preset → find the plugin's own section in the preset options and enable it there too (most Godot Android plugins need this second enable, separate from the Project Settings one).
5. Create `res://scripts/Ads.gd`:

```gdscript
extends Node

const TEST_APP_ID := "ca-app-pub-3940256099942544~3347511713"
const TEST_BANNER_ID := "ca-app-pub-3940256099942544/6300978111"
const TEST_INTERSTITIAL_ID := "ca-app-pub-3940256099942544/1033173712"

var interstitial_ready := false

func _ready() -> void:
	if not Engine.has_singleton("Admob"):
		print("Admob native singleton not found — this only exists inside an exported Android build, not the editor's Play button.")
		return
	Admob.initialize(true)
	Admob.load_banner(TEST_BANNER_ID, Admob.BANNER_SIZE.NORMAL, Admob.AD_POSITION.BOTTOM)
	Admob.load_interstitial(TEST_INTERSTITIAL_ID)
	Admob.interstitial_loaded.connect(func(): interstitial_ready = true)

func show_banner() -> void:
	if Engine.has_singleton("Admob"):
		Admob.show_banner()

func show_interstitial() -> void:
	if Engine.has_singleton("Admob") and interstitial_ready:
		Admob.show_interstitial()
		interstitial_ready = false
		Admob.load_interstitial(TEST_INTERSTITIAL_ID)
```

The exact singleton name, method names, and signal names above match the shape most Godot 4 AdMob plugins use, but versions do drift — right after installing, open the plugin's own bundled demo scene (usually under `res://addons/admob/`) and confirm the names in the code above match what your installed version actually exposes. The pattern that stays constant regardless of version: initialize once in test mode, load a banner and an interstitial against test IDs, show the banner during play, show the interstitial on game over, and immediately reload the next interstitial after each show so one is ready for next time.

6. Register it as an autoload: **Project > Project Settings > Autoload** tab → **Path** `res://scripts/Ads.gd` → **Node Name** `Ads` → **Add**.
7. Wire it into `Main.gd` — add to the end of `_ready()`:

```gdscript
	Ads.show_banner()
```

   And add to the end of `_end_game()`:

```gdscript
	Ads.show_interstitial()
```

**Checkpoint:** The native `Admob` singleton only exists inside an exported Android build — the editor's Play button alone won't show real ad creatives. Export a debug APK for this check (leave **Export With Debug** checked, save as `tap-tower-debug.apk`), install it, and open the app:

```bash
adb install tap-tower-debug.apk
```

Expected output: `Success`. Open the app on the device — a banner labeled as a test ad sits at the bottom of the screen during play, and missing a drop shows a full-screen test interstitial before the game-over panel appears underneath it.

---

## Phase 5 — Android export: keystore + AAB

Full detail on both steps below lives in [`../reference/platform-google-play.md`](../reference/platform-google-play.md) sections 2 (signing keys) and 3 (building an AAB, Godot subsection) — this phase is just Tap Tower's specific values.

1. Generate your upload keystore (do this once, ever, for this project — reuse it for every future update):

```bash
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 9125
```

   Expected: interactive prompts for a keystore password, your name/org/city/country, and a key password (Enter reuses the keystore password). Ends with `[Storing upload-keystore.jks]`.

2. **Back it up immediately** — copy `upload-keystore.jks` somewhere off this machine and save both passwords plus the alias (`upload`) in a password manager, per the reference doc's warning. Losing this file is recoverable but slow; losing it without a backup is not.

3. In Godot: **Project > Export** → your Android preset → **Keystore** section:
   - **Release / Release Keystore** → path to `upload-keystore.jks`
   - **Release / Release User** → `upload`
   - **Release / Release Password** → the key password from step 1

4. In the same preset, **Package > Unique Name** → your reverse-domain package id, e.g. `com.yourstudio.taptower` (permanent the moment you publish — pick it deliberately). **Version > Code** → `1`, **Version > Name** → `1.0.0`.

5. **Leave `Ads.gd`'s `TEST_*` constants exactly as they are.** The Ship-it Challenge below explicitly requires a test ad showing in internal testing — don't swap to real AdMob IDs for this build. Real-ID swap is a later, post-mission step for an actual public release, not part of this guide.

6. Click **Export Project**, uncheck **Export With Debug**, and save as `tap-tower.aab` (the `.aab` extension is what tells Godot to build an App Bundle instead of an APK).

```bash
ls -la tap-tower.aab
```

**Checkpoint:** `tap-tower.aab` exists, sized roughly 20-40MB (that baseline size is Godot's bundled Android runtime, not your game logic — don't expect it small). That file is what gets uploaded to Play Console next.

---

## Ship-it challenge

Get Tap Tower actually running on a real device through Play Console, not just sideloaded via `adb`.

1. In [Play Console](https://play.google.com/console), **Create app** — name it, set language, mark it **Free**, confirm the policy checkboxes. (Needs your $25 developer account from Phase "What you do" in README.md, already verified.)
2. Complete the minimum store listing fields Play Console requires before it accepts a testing-track upload (app name, short description, full description, app icon — a plain placeholder icon is fine for internal testing, it does not need to be final).
3. **Testing > Internal testing > Create new release** → upload `tap-tower.aab`.
4. **Internal testing > Testers** → add your own Google account email to a tester list → **Save** → copy the opt-in URL Play Console generates.
5. On your Android device, open that opt-in URL, accept, then install the app from the Play Store link it gives you (can take a few minutes to become available after upload — this isn't instant like a sideload).
6. Launch the installed app from the Play Store, not from a leftover sideloaded copy. Confirm the test banner shows during play and a test interstitial shows on game over, same as the Phase 4 checkpoint — but now via a real Play Store install.

**Acceptance:** the game is live in internal testing on your Play Console account, installed and running from the actual Play Store listing, showing a test ad.

---

## Break-fix drills

Diagnose before you look at the hint. State the symptom, form a hypothesis, test it.

**Drill 1 — Export fails.** Clicking **Export Project** shows a red error instead of producing a file — something about templates or the SDK.

**Drill 2 — Black screen on device.** The app installs and opens on your phone, no crash, but the screen just stays solid black — no tower, no UI, nothing.

**Drill 3 — Ad never loads.** No banner, no interstitial, ever, even with the device on wifi and plenty of time waited.

<details>
<summary>Hints (open only when stuck)</summary>

- Drill 1: **Editor Settings > Export > Android** shows a green/red status line per requirement — whichever line is red tells you directly whether it's the export templates or the SDK path that's missing, no guessing needed.
- Drill 2: **Project > Project Settings > Rendering > Renderer** — the default renderer targets desktop GPUs; mobile export needs the Mobile (or Compatibility, depending on your Godot 4.x minor version) renderer instead.
- Drill 3: check two things — is `Ads.gd` actually still using the `TEST_*` constants (a real, brand-new AdMob ID can take hours to days before it serves anything), and does the Output/logcat show the "Admob native singleton not found" print from `_ready()` (meaning you're testing from the editor's Play button instead of an exported, installed build)?

</details>

---

## Done when

- [ ] Godot 4, Android export templates, JDK, and Android SDK all installed and confirmed (Phase 0)
- [ ] Core mechanic playable end-to-end — block slides, tap drops it, overlap trims, a miss ends the run (Phase 1)
- [ ] Score label, game-over panel, and restart all work, and slide speed visibly ramps per block (Phase 2)
- [ ] Asset spec sheet written and the game runs clean with placeholders — no missing-resource errors (Phase 3)
- [ ] Test banner and test interstitial both confirmed showing on a real installed Android build (Phase 4)
- [ ] A signed `tap-tower.aab` produced (Phase 5)
- [ ] All three break-fix drills diagnosed and fixed
- [ ] The game is live in internal testing with a test ad
