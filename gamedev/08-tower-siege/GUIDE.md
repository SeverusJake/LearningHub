# Guide — Game 08: Tower Siege

Reference docs this mission uses: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), [`../reference/platform-steam.md`](../reference/platform-steam.md).

## Phase 0 — Setup check

You built Godot familiarity in Games 01 and 05. This is a desktop game, so no Android export needed.

- Godot 4 installed, `godot --version` prints 4.x.
- A new project `TowerSiege`, Forward+ or Mobile renderer is fine for desktop.

**Checkpoint:** the empty project opens and an empty 2D scene runs with F5, no errors.

## Phase 1 — Tower-defense core

Build against colored shapes; art comes in Phase 3.

**The path.** Use a `Path2D` with a drawn poly-line from spawn to base. Enemies are `PathFollow2D` children that advance along it by distance, so movement is **delta-based** (frame-rate independent — that matters for Break-fix drill 1).

`enemy.gd` (attached to a `PathFollow2D`):

```gdscript
extends PathFollow2D

@export var speed := 80.0
@export var max_hp := 30
var hp := 0

signal died(reward)
signal reached_end

func _ready():
	hp = max_hp

func _process(delta):
	progress += speed * delta   # delta-based: same speed at any frame rate
	if progress_ratio >= 1.0:
		reached_end.emit()
		queue_free()

func take_damage(amount: int):
	hp -= amount
	if hp <= 0:
		died.emit(10)   # currency reward
		queue_free()
```

**Waves.** `wave_manager.gd` spawns enemies onto the path from a data file (Phase 2 makes it data-driven):

```gdscript
extends Node

@export var enemy_scene: PackedScene
@export var path: Path2D
var lives := 20
var currency := 100

signal stats_changed(lives, currency)

func spawn_wave(count: int, interval: float):
	for i in count:
		var e = enemy_scene.instantiate()
		path.add_child(e)
		e.died.connect(_on_enemy_died)
		e.reached_end.connect(_on_enemy_reached_end)
		await get_tree().create_timer(interval).timeout

func _on_enemy_died(reward):
	currency += reward
	stats_changed.emit(lives, currency)

func _on_enemy_reached_end():
	lives -= 1
	stats_changed.emit(lives, currency)
	if lives <= 0:
		get_tree().change_scene_to_file("res://ui/game_over.tscn")
```

**Towers.** `tower.gd` — acquires the nearest in-range enemy, fires on cooldown, spawns a projectile:

```gdscript
extends Node2D

@export var range_px := 160.0
@export var damage := 10
@export var fire_rate := 1.0   # shots per second
@export var projectile_scene: PackedScene
var _cooldown := 0.0
var _target = null

func _process(delta):
	_cooldown -= delta
	_target = _acquire_target()
	if _target and _cooldown <= 0.0:
		_fire()
		_cooldown = 1.0 / fire_rate

func _acquire_target():
	var best = null
	var best_d := range_px
	for e in get_tree().get_nodes_in_group("enemies"):
		if not is_instance_valid(e): continue
		var d = global_position.distance_to(e.global_position)
		if d <= best_d:
			best_d = d
			best = e
	return best

func _fire():
	if not is_instance_valid(_target): 
		_target = null
		return
	var p = projectile_scene.instantiate()
	get_tree().current_scene.add_child(p)
	p.global_position = global_position
	p.launch(_target, damage)
```

Add enemies to an `enemies` group on spawn (`add_to_group("enemies")` in `enemy.gd._ready`). `projectile.gd` homes to the target and calls `take_damage`:

```gdscript
extends Area2D
var _target = null
var _damage := 0
@export var speed := 400.0

func launch(target, damage):
	_target = target
	_damage = damage

func _process(delta):
	if not is_instance_valid(_target):
		queue_free()
		return
	global_position = global_position.move_toward(_target.global_position, speed * delta)
	if global_position.distance_to(_target.global_position) < 8.0:
		_target.take_damage(_damage)
		queue_free()
```

Tower placement: on click at a buildable spot, if `currency >= cost`, instance a tower and subtract cost.

**Checkpoint:** place a tower, start a wave, the tower shoots and kills enemies walking the path; enemies reaching the base cost a life.

## Phase 2 — Tower types, upgrades, maps, wave data

- **Tower types** (≥3): reuse `tower.gd` with different exported stats — e.g. a fast weak "gun", a slow strong "cannon", a slowing "frost" tower (which sets a speed multiplier on hit enemies). Make them scenes with different stats.
- **Upgrades:** click a placed tower to spend currency raising `damage`/`range_px`/`fire_rate` a tier.
- **Maps** (≥2): each map is a scene with its own `Path2D` and buildable spots.
- **Wave data** — don't hardcode waves. A JSON (or `.tres` Resource) per map:

```json
{
  "waves": [
    { "enemy": "basic", "count": 8,  "interval": 0.8 },
    { "enemy": "fast",  "count": 12, "interval": 0.5 },
    { "enemy": "tank",  "count": 5,  "interval": 1.5 }
  ]
}
```

Load it and drive `spawn_wave` per entry, waiting for each wave to clear before the next.

**Checkpoint:** you can win a full map by clearing every wave, or lose it by running out of lives; a second map loads and plays.

## Phase 3 — Asset spec sheet

Swap finals per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), same paths.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `art/tower_gun.png` | 64×64 PNG, transparent | top-down gun tower | Kenney "Tower Defense" |
| SPRITE | `art/tower_cannon.png` | 64×64, transparent | cannon tower | Kenney |
| SPRITE | `art/tower_frost.png` | 64×64, transparent | frost tower | Kenney |
| SPRITE | `art/enemy_basic.png` | 48×48, transparent | walker | Kenney |
| SPRITE | `art/enemy_fast.png` | 48×48, transparent | fast walker | Kenney |
| SPRITE | `art/enemy_tank.png` | 48×48, transparent | armored walker | Kenney |
| TILESET | `art/map_tiles.png` | 64×64 tiles | ground/path/blocked | Kenney |
| SPRITE | `art/projectile.png` | 16×16, transparent | shot | Kenney |
| SFX | `audio/shoot.wav` | <0.3s | tower fire | generated |
| SFX | `audio/enemy_die.wav` | <0.4s | enemy death | generated |
| AUDIO | `audio/bgm.ogg` | ~2min loop | driving strategy theme | OpenGameArt |

Placeholders now: colored squares for towers, colored triangles for enemies, a small circle for projectiles.

**Checkpoint:** the full game plays with placeholder shapes.

## Phase 4 — Steam integration

Use **GodotSteam** (a Godot build/GDExtension exposing the Steamworks SDK).

- Install GodotSteam per its docs (a GDExtension addon or a GodotSteam editor build), place `steam_appid.txt` with your test AppID (`480` is Valve's public test AppID for development) in the project root.
- Initialize on startup:

```gdscript
extends Node
func _ready():
	var init = Steam.steamInitEx()
	if init.status != 0:
		push_warning("Steam not running or init failed: %s" % init.verbal)
	else:
		print("Steam user: %s" % Steam.getPersonaName())
```

- Optional: define an achievement (e.g. "Clear Map 1") in Steamworks and unlock it with `Steam.setAchievement("MAP1_CLEAR")` + `Steam.storeStats()`.
- The **$100 Steam Direct fee** is per app and real — review the [`../reference/platform-steam.md`](../reference/platform-steam.md) doc and the "$100 decision" section in this game's README before paying it here.

**Checkpoint:** launched with Steam running, `getPersonaName()` prints your Steam name (the overlay initializes).

## Phase 5 — Builds

- **Windows:** Project → Export → add a Windows Desktop preset → Export Project → `TowerSiege.exe`. Confirm it runs standalone (with `steam_appid.txt` beside it for local Steam testing).
- **itch.io build:** the same Windows export, zipped, uploaded as a paid download.

**Checkpoint:** the exported `.exe` runs outside the editor.

## Monetization integration

Premium (one-time purchase), no ads. itch.io sells it immediately; Steam is the bigger premium storefront but costs the $100 Direct fee and has a 30-day store-page-before-release rule (see [`../reference/platform-steam.md`](../reference/platform-steam.md)). Build wishlists on the Steam "Coming Soon" page before launch.

## Ship-it challenge

1. Publish the paid Windows build to **itch.io** now (a few dollars, pay-what-you-want on).
2. **If** Tower Siege is your chosen Steam release (see README's "$100 decision"): create a Steamworks partner account, complete the tax/bank paperwork, pay the $100 Steam Direct fee for this app, create the app + AppID, fill the store page with real capsules/screenshots (exact dimensions in [`../reference/platform-steam.md`](../reference/platform-steam.md)), and set it to **Coming Soon**. Upload a build via SteamPipe.

**Acceptance:** a paid itch.io build is live, and a Steam "Coming Soon" store page is live (or, if you're saving the fee for Game 09/10, the itch build is live and the Steam steps are completed as a dry run).

## Break-fix drills

Ask Claude in-session to introduce each; diagnose before Hints.

1. **Enemies teleport past waypoints** at high refresh rates or move at different speeds on different machines — movement is tied to frames, not time.
2. **A tower keeps firing at a dead or out-of-range enemy**, wasting shots — the target reference isn't being cleared.
3. **The SteamPipe upload fails** — the depot or app-build VDF is misconfigured.

## Hints

<details>
<summary>Hints (open only when stuck)</summary>

1. Movement must multiply by `delta` (`progress += speed * delta`). If you ever write `progress += speed` with no delta, speed scales with frame rate. Check every `_process` that moves something.
2. `_acquire_target()` should re-run each frame and `_fire()` must re-validate `is_instance_valid(_target)` before shooting — a freed enemy leaves a stale reference. Clear `_target` when it's invalid or out of range.
3. The app-build VDF's `AppID`, the depot VDF's `DepotID`, and the content path must all line up, and the depot must be attached to the app in Steamworks. Re-read the SteamPipe section of the Steam reference doc and check each ID.

</details>

## Done when

- [ ] Path-based enemies, timed waves, placeable towers with range/damage/fire-rate, projectiles, and a currency+lives economy all work
- [ ] ≥3 tower types with upgrades, ≥2 maps, and a JSON/resource wave-data format
- [ ] Final AI-generated assets swapped in over placeholders
- [ ] GodotSteam initializes and prints the Steam user in a test build
- [ ] A standalone Windows `.exe` runs outside the editor
- [ ] A paid itch.io build is live; a Steam "Coming Soon" page is live (or the Steam steps completed as a dry run per the README decision)
