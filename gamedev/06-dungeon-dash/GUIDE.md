# Guide — Game 06: Dungeon Dash

Reference docs this mission uses: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), [`../reference/platform-steam.md`](../reference/platform-steam.md).

## Phase 0 — Setup check

You built Unity familiarity in Game 03. Confirm the toolchain:

- Unity Hub installed, Unity 6 LTS installed with it.
- A new **2D (Built-In Render Pipeline)** project created, named `DungeonDash`.

**Checkpoint:** the empty 2D project opens and Play mode runs with an empty scene, no console errors.

## Phase 1 — Roguelike core

Build the core against plain colored squares — art comes in Phase 3.

**Dungeon generation.** `Scripts/DungeonGenerator.cs` — carves rooms on a grid and connects them with corridors so every room is reachable:

```csharp
using System.Collections.Generic;
using UnityEngine;

public class DungeonGenerator : MonoBehaviour
{
    public int width = 60, height = 40;
    public int maxRooms = 10;
    public int roomMin = 5, roomMax = 10;
    public GameObject floorTile, wallTile;

    // 0 = wall, 1 = floor
    private int[,] grid;
    public List<RectInt> Rooms { get; private set; } = new();

    public void Generate()
    {
        grid = new int[width, height];
        Rooms.Clear();

        for (int i = 0; i < maxRooms; i++)
        {
            int w = Random.Range(roomMin, roomMax);
            int h = Random.Range(roomMin, roomMax);
            int x = Random.Range(1, width - w - 1);
            int y = Random.Range(1, height - h - 1);
            var room = new RectInt(x, y, w, h);

            bool overlaps = false;
            foreach (var r in Rooms)
                if (r.Overlaps(new RectInt(room.x - 1, room.y - 1, room.width + 2, room.height + 2)))
                    { overlaps = true; break; }
            if (overlaps) continue;

            CarveRoom(room);
            if (Rooms.Count > 0)
                CarveCorridor(Rooms[Rooms.Count - 1].center, room.center);
            Rooms.Add(room);
        }
        Render();
    }

    void CarveRoom(RectInt r)
    {
        for (int x = r.x; x < r.xMax; x++)
            for (int y = r.y; y < r.yMax; y++)
                grid[x, y] = 1;
    }

    // L-shaped corridor guarantees connectivity between the last room and the new one
    void CarveCorridor(Vector2 a, Vector2 b)
    {
        int x = Mathf.RoundToInt(a.x), y = Mathf.RoundToInt(a.y);
        int tx = Mathf.RoundToInt(b.x), ty = Mathf.RoundToInt(b.y);
        while (x != tx) { grid[x, y] = 1; x += x < tx ? 1 : -1; }
        while (y != ty) { grid[x, y] = 1; y += y < ty ? 1 : -1; }
    }

    void Render()
    {
        foreach (Transform c in transform) Destroy(c.gameObject);
        for (int x = 0; x < width; x++)
            for (int y = 0; y < height; y++)
            {
                var prefab = grid[x, y] == 1 ? floorTile : wallTile;
                var t = Instantiate(prefab, new Vector3(x, y, 0), Quaternion.identity, transform);
                if (grid[x, y] == 0) t.layer = LayerMask.NameToLayer("Wall");
            }
    }

    public Vector2 FirstRoomCenter() => Rooms.Count > 0 ? Rooms[0].center : Vector2.zero;
}
```

`floorTile`/`wallTile` are 1×1 sprite prefabs (white square for floor, dark square for wall). Give the wall prefab a `BoxCollider2D` and put it on a `Wall` layer.

**Player.** `Scripts/PlayerController.cs`:

```csharp
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    public float speed = 6f;
    public int maxHp = 100;
    public int Hp { get; private set; }
    private Rigidbody2D rb;
    private Vector2 input;

    void Awake() { rb = GetComponent<Rigidbody2D>(); Hp = maxHp; }

    void Update()
    {
        input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")).normalized;
        if (Input.GetKeyDown(KeyCode.Space)) GetComponent<CombatSystem>().Attack();
    }

    void FixedUpdate() => rb.MovePosition(rb.position + input * speed * Time.fixedDeltaTime);

    public void TakeDamage(int dmg)
    {
        Hp -= dmg;
        if (Hp <= 0) RunManager.Instance.EndRun(false);
    }
}
```

Give the player a `Rigidbody2D` (Gravity Scale 0, Freeze Rotation Z) and a `CircleCollider2D`.

**Enemy AI.** `Scripts/EnemyAI.cs` — chase when the player is close, attack on contact cooldown:

```csharp
using UnityEngine;

public class EnemyAI : MonoBehaviour
{
    public float speed = 3f, aggroRange = 8f, attackCooldown = 1f;
    public int hp = 30, damage = 10;
    private Transform player;
    private float lastAttack;

    void Start() => player = GameObject.FindWithTag("Player").transform;

    void Update()
    {
        if (player == null) return;
        float d = Vector2.Distance(transform.position, player.position);
        if (d <= aggroRange && d > 0.9f)
            transform.position = Vector2.MoveTowards(transform.position, player.position, speed * Time.deltaTime);
        else if (d <= 0.9f && Time.time - lastAttack > attackCooldown)
        {
            lastAttack = Time.time;
            player.GetComponent<PlayerController>().TakeDamage(damage);
        }
    }

    public void TakeDamage(int dmg)
    {
        hp -= dmg;
        if (hp <= 0) { RunManager.Instance.OnEnemyKilled(); Destroy(gameObject); }
    }
}
```

**Combat.** `Scripts/CombatSystem.cs` — a melee swing hitting enemies in a small radius in front:

```csharp
using UnityEngine;

public class CombatSystem : MonoBehaviour
{
    public int damage = 15;
    public float range = 1.2f;

    public void Attack()
    {
        var hits = Physics2D.OverlapCircleAll(transform.position, range);
        foreach (var h in hits)
        {
            var e = h.GetComponent<EnemyAI>();
            if (e != null) e.TakeDamage(damage);
        }
    }
}
```

**Checkpoint:** enter Play mode, a dungeon generates, you walk through connected rooms with WASD/arrows, and pressing Space kills an adjacent enemy.

## Phase 2 — Floors, loot, and the run loop

`Scripts/RunManager.cs` — a singleton tracking the run, chaining floors, and ending on death:

```csharp
using UnityEngine;
using UnityEngine.SceneManagement;

public class RunManager : MonoBehaviour
{
    public static RunManager Instance;
    public int floor = 1, gold = 0, kills = 0;
    public bool demoMode = false; // set by build; see Phase 4

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this; DontDestroyOnLoad(gameObject);
    }

    public void OnEnemyKilled() { kills++; gold += 5; }

    public void NextFloor()
    {
        if (demoMode && floor >= 1) { EndRun(true); return; } // demo = first floor only
        floor++;
        FindObjectOfType<DungeonGenerator>().Generate();
        var p = FindObjectOfType<PlayerController>();
        p.transform.position = (Vector3)FindObjectOfType<DungeonGenerator>().FirstRoomCenter();
    }

    public void EndRun(bool won)
    {
        PlayerPrefs.SetInt("lastFloor", floor);
        SceneManager.LoadScene(won ? "Win" : "GameOver");
    }
}
```

Add an exit-stairs trigger in the last generated room that calls `RunManager.Instance.NextFloor()` on player overlap, loot pickups (a coin prefab that calls `OnEnemyKilled`-style gold add), and a simple upgrade (e.g. pick up a heart to raise `maxHp`). Build minimal `Win` and `GameOver` scenes with a "Restart" button that resets `RunManager` and loads the dungeon scene.

**Checkpoint:** dying loads GameOver; taking the stairs generates a fresh floor; restarting begins a brand-new run.

## Phase 3 — Asset spec sheet

Build ran on placeholders; now swap finals per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md). Same filenames/paths.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `Assets/Art/player.png` | 32×32 PNG, transparent | top-down hero, 4-dir or single | Kenney "Tiny Dungeon" |
| SPRITE | `Assets/Art/enemy_sheet.png` | 32×32/frame, 4 frames | walk cycle, one enemy type | Kenney |
| TILESET | `Assets/Art/tiles.png` | 32×32 tiles | floor + wall variants | Kenney |
| SPRITE | `Assets/Art/coin.png` | 16×16, transparent | loot coin | Kenney |
| SPRITE | `Assets/Art/heart.png` | 16×16, transparent | HP upgrade | Kenney |
| SFX | `Assets/Audio/hit.wav` | <0.4s | melee impact | generated |
| SFX | `Assets/Audio/pickup.wav` | <0.3s | coin/heart pickup | generated |
| AUDIO | `Assets/Audio/dungeon_bgm.ogg` | ~90s loop | tense dungeon ambience | OpenGameArt |

Placeholders now: white square (player), red square (enemy), grey/dark squares (tiles), yellow circle (coin).

**Checkpoint:** the full loop still plays with placeholder art in place.

## Phase 4 — Demo vs full build gating

The free demo is the first floor only; the paid build is the whole game. Gate content off one flag rather than maintaining two projects.

- Add a scripting define: **Project Settings → Player → Scripting Define Symbols** → add `DEMO_BUILD` for the demo build only.
- Set the flag at startup:

```csharp
void Start()
{
#if DEMO_BUILD
    RunManager.Instance.demoMode = true;
#endif
}
```

- In `RunManager.NextFloor()` (Phase 2) `demoMode` already ends the run after floor 1 with a "Thanks for playing the demo — get the full game" screen linking your itch.io page.
- Build the **demo** with `DEMO_BUILD` defined, then remove the define and build the **full** game.

**Checkpoint:** the demo build ends after floor 1 with the upsell screen; the full build continues past floor 1.

## Phase 5 — Windows build

- **File → Build Settings → Windows, Mac, Linux → Windows / x86_64 → Build.**
- Zip the entire output folder — the `.exe` **plus** the `DungeonDash_Data` folder and the Mono/IL2CPP DLLs. A zip missing `_Data` will not launch (that's Break-fix drill 3).

**Checkpoint:** unzip elsewhere, run the `.exe`, the game launches standalone.

## Monetization integration

This game is **premium**, not ad-funded: the free demo is the funnel, the paid build is the product. No ad SDK. Pricing: a small roguelike on itch.io typically lists a few dollars with pay-what-you-want above the minimum. The Steam store page and $100 Steam Direct fee are handled properly in Games 08–10 — see [`../reference/platform-steam.md`](../reference/platform-steam.md); for this game, itch.io is the storefront.

## Ship-it challenge

1. Create and verify an itch.io account.
2. Create a new project, set it to a **downloadable Windows game**, price the **full** build (e.g. $3–5, pay-what-you-want on).
3. Upload the full build zip; mark it as the paid download.
4. Upload the **demo** build zip as a separate free download on the same page, flagged as the demo.
5. Fill the store page (AI-drafted copy, your screenshots), publish.

**Acceptance:** a priced full build and a free demo build are both live and downloadable on your itch.io page.

## Break-fix drills

Ask Claude in-session to introduce each; diagnose before opening Hints.

1. **Disconnected rooms** — some rooms are unreachable (no corridor). The generator skipped the corridor pass for a room. Diagnose from the generation order.
2. **Enemies clip through walls** — enemies walk straight through wall tiles toward the player. A physics/navigation gap.
3. **The itch build won't launch** on another machine — double-clicking the `.exe` does nothing. Something's missing from the zip.

## Hints

<details>
<summary>Hints (open only when stuck)</summary>

1. `CarveCorridor` only runs when `Rooms.Count > 0` — if a room is added without ever connecting to the previous one (e.g. you reorder and add before carving the corridor), it floats. Every new room must carve a corridor to an existing room.
2. `EnemyAI` uses `MoveTowards` on `transform.position` directly — it ignores colliders. Either move via a `Rigidbody2D.MovePosition` so wall colliders block it, or add a simple wall-avoidance check. The wall tiles need colliders on the `Wall` layer.
3. A Unity build is the `.exe` **and** its `GAMENAME_Data` folder and runtime DLLs together. Zipping only the `.exe` produces a launcher with no game. Zip the whole build folder.

</details>

## Done when

- [ ] A dungeon generates with fully connected rooms every run
- [ ] Movement, enemy AI, and melee combat all work
- [ ] Floors chain, permadeath ends the run, restart makes a fresh run
- [ ] Final AI-generated assets are swapped in over placeholders
- [ ] A `DEMO_BUILD`-gated demo (first floor) and a full paid build both produce standalone `.exe`s
- [ ] A paid build and a free demo build are both live on itch.io
