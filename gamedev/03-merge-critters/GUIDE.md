# Guide — Game 03: Merge Critters

This is the track's first Unity build, so Phase 0 spends real time on editor and Android module setup — later Unity missions (06, 09) assume you've already done this once. Everything below lives in a single Unity project named `MergeCritters`. Script files go in `Assets/Scripts/`; the one editor-only tool in Phase 3 goes in `Assets/Editor/`. Reference docs this mission links back to instead of repeating: `../reference/assets-pipeline.md`, `../reference/platform-google-play.md`, `../reference/monetization-ads.md`.

---

## Phase 0 — Unity Hub, Unity 6 LTS, Android module

1. Install **Unity Hub** from [unity.com/download](https://unity.com/download) and sign in with (or create) a free Unity account — Hub requires an account even for personal use.
2. In Hub's **Installs** tab, click **Install Editor** and choose **Unity 6 LTS** (the current Long Term Support release — LTS matters here because Play's minimum-target-API-level requirement changes yearly, and LTS releases get the longest patch window against that).
3. On the module-selection screen of that install, check **Android Build Support**, and make sure its two sub-items are also checked: **OpenJDK** and **Android SDK & NDK Tools**. Unity bundles a JDK/SDK/NDK combination that's known to match this editor version — this pairing is exactly what breaks in this mission's first break-fix drill if you install mismatched versions separately instead of letting Hub manage them. Full detail on why this split (upload key vs. Play's own signing key, AAB vs. APK) is in `../reference/platform-google-play.md`.
4. In Hub's **Projects** tab, click **New Project**, pick the **2D (URP)** template (or **2D Core** if URP isn't listed for your version), name it `MergeCritters`, and confirm Unity 6 LTS as the editor version before creating it.
5. Once the editor opens, press **Play** on the empty default scene. Confirm the Game view enters Play mode with no red errors in the Console, then press **Play** again to stop.

**Checkpoint:** an empty project builds/runs in the editor — Play mode starts and stops cleanly with zero Console errors.

---

## Phase 1 — the merge mechanic

### 1.1 Scene setup

1. In the Hierarchy, confirm **Main Camera** is set to **Orthographic** projection (2D template projects default to this) — the drag math below assumes an orthographic camera.
2. Create an empty GameObject named `Grid`, reset its Transform to `(0, 0, 0)`. You'll attach `GridManager` to it shortly.
3. Create an empty GameObject named `CurrencyManager` at the root of the scene. You'll attach `CurrencyManager` to it shortly.
4. Create a new GameObject for the critter prefab: add a **Sprite Renderer**, a **Circle Collider 2D** (radius ~0.5), and you'll attach `CritterItem` and `DraggableItem` to it in the next step. Assign Unity's built-in **Knob** sprite (Window > any default 2D sprite, or `Sprite: Knob` in the Sprite Renderer's sprite picker) as a stand-in — Phase 3 replaces this with the real placeholder pipeline.
5. Drag that GameObject from the Hierarchy into `Assets/Prefabs/` to turn it into a prefab, then delete the scene instance.

### 1.2 Scripts

Create `Assets/Scripts/CritterItem.cs`:

```csharp
using UnityEngine;

// Attached to every critter prefab instance. Holds the data GridManager,
// DraggableItem, and MergeLogic all need: which tier this critter is,
// which grid cell it currently occupies, and a back-reference to the grid.
public class CritterItem : MonoBehaviour
{
    public int tier = 1;
    public int col;
    public int row;
    public GridManager grid;

    [SerializeField] private SpriteRenderer spriteRenderer;
    [SerializeField] private Sprite[] tierSprites; // index 0 = tier 1, index 1 = tier 2, etc.

    public void Init(GridManager owningGrid, int startTier, int startCol, int startRow)
    {
        grid = owningGrid;
        col = startCol;
        row = startRow;
        SetTier(startTier);
    }

    public void SetTier(int newTier)
    {
        tier = newTier;
        if (spriteRenderer == null || tierSprites == null || tierSprites.Length == 0) return;
        int index = Mathf.Clamp(tier - 1, 0, tierSprites.Length - 1);
        spriteRenderer.sprite = tierSprites[index];
    }
}
```

Create `Assets/Scripts/GridManager.cs`:

```csharp
using System.Collections.Generic;
using UnityEngine;

public class GridManager : MonoBehaviour
{
    [Header("Grid")]
    public int columns = 4;
    public int rows = 4;
    public float cellSize = 1.5f;

    [Header("Spawning")]
    public GameObject critterPrefab;
    public float spawnInterval = 5f;
    public int maxTier = 6;

    private CritterItem[,] _cells;
    private float _spawnTimer;

    void Awake()
    {
        _cells = new CritterItem[columns, rows];
    }

    void Update()
    {
        _spawnTimer += Time.deltaTime;
        if (_spawnTimer < spawnInterval) return;
        _spawnTimer = 0f;
        TrySpawnCritter();
    }

    public Vector3 CellToWorld(int col, int row)
    {
        float originX = -(columns - 1) * cellSize * 0.5f;
        float originY = -(rows - 1) * cellSize * 0.5f;
        return transform.position + new Vector3(originX + col * cellSize, originY + row * cellSize, 0f);
    }

    public bool TryGetCellAtWorld(Vector3 worldPos, out int col, out int row)
    {
        Vector3 local = worldPos - transform.position;
        float originX = -(columns - 1) * cellSize * 0.5f;
        float originY = -(rows - 1) * cellSize * 0.5f;
        col = Mathf.RoundToInt((local.x - originX) / cellSize);
        row = Mathf.RoundToInt((local.y - originY) / cellSize);
        return col >= 0 && col < columns && row >= 0 && row < rows;
    }

    public List<(int col, int row)> GetEmptyCells()
    {
        var empties = new List<(int, int)>();
        for (int c = 0; c < columns; c++)
            for (int r = 0; r < rows; r++)
                if (_cells[c, r] == null)
                    empties.Add((c, r));
        return empties;
    }

    private void TrySpawnCritter()
    {
        var empties = GetEmptyCells();
        if (empties.Count == 0) return; // grid is full — skip this tick, try again next timer
        var (col, row) = empties[Random.Range(0, empties.Count)];
        SpawnCritterAt(col, row, tier: 1);
    }

    public CritterItem SpawnCritterAt(int col, int row, int tier)
    {
        GameObject go = Instantiate(critterPrefab, CellToWorld(col, row), Quaternion.identity, transform);
        var item = go.GetComponent<CritterItem>();
        item.Init(this, tier, col, row);
        _cells[col, row] = item;
        return item;
    }

    public CritterItem GetItemAt(int col, int row)
    {
        if (col < 0 || col >= columns || row < 0 || row >= rows) return null;
        return _cells[col, row];
    }

    public void SetCell(int col, int row, CritterItem item) => _cells[col, row] = item;
    public void ClearCell(int col, int row) => _cells[col, row] = null;
}
```

Create `Assets/Scripts/MergeLogic.cs`:

```csharp
using UnityEngine;

// The merge rule itself, kept separate from grid bookkeeping (GridManager)
// and input handling (DraggableItem) so "what counts as a valid merge, and
// what happens when one resolves" lives in exactly one small place.
public static class MergeLogic
{
    public static bool CanMerge(CritterItem dragged, CritterItem target, int maxTier)
    {
        if (dragged == null || target == null || dragged == target) return false;
        return dragged.tier == target.tier && dragged.tier < maxTier;
    }

    // Destroys both source critters, spawns the next-tier critter in the
    // target's cell, and awards currency. Returns false with no side effects
    // if the two items don't actually qualify as a merge.
    public static bool TryMerge(GridManager grid, CritterItem dragged, CritterItem target)
    {
        if (!CanMerge(dragged, target, grid.maxTier)) return false;

        int newTier = dragged.tier + 1;
        int col = target.col;
        int row = target.row;

        grid.ClearCell(dragged.col, dragged.row);
        grid.ClearCell(target.col, target.row);

        Object.Destroy(dragged.gameObject);
        Object.Destroy(target.gameObject);

        grid.SpawnCritterAt(col, row, newTier);
        CurrencyManager.Instance.AddCurrency(newTier * 10);
        return true;
    }
}
```

Create `Assets/Scripts/DraggableItem.cs`:

```csharp
using UnityEngine;

[RequireComponent(typeof(CritterItem))]
public class DraggableItem : MonoBehaviour
{
    private CritterItem _item;
    private Vector3 _dragOffset;
    private Vector3 _startPosition;
    private Camera _cam;

    void Awake()
    {
        _item = GetComponent<CritterItem>();
        _cam = Camera.main;
    }

    void OnMouseDown()
    {
        _startPosition = transform.position;
        Vector3 mouseWorld = _cam.ScreenToWorldPoint(Input.mousePosition);
        mouseWorld.z = transform.position.z;
        _dragOffset = transform.position - mouseWorld;
    }

    void OnMouseDrag()
    {
        Vector3 mouseWorld = _cam.ScreenToWorldPoint(Input.mousePosition);
        mouseWorld.z = transform.position.z;
        transform.position = mouseWorld + _dragOffset;
    }

    void OnMouseUp()
    {
        GridManager grid = _item.grid;
        Vector3 dropPos = transform.position;
        dropPos.z = _startPosition.z;

        if (grid.TryGetCellAtWorld(dropPos, out int col, out int row))
        {
            CritterItem target = grid.GetItemAt(col, row);

            if (target != null && target != _item && MergeLogic.TryMerge(grid, _item, target))
                return; // this GameObject was destroyed inside TryMerge — stop here

            if (target == null)
            {
                grid.ClearCell(_item.col, _item.row);
                _item.col = col;
                _item.row = row;
                grid.SetCell(col, row, _item);
                transform.position = grid.CellToWorld(col, row);
                return;
            }
        }

        // invalid drop (off-grid, or dropped on a different-tier critter) — snap back
        transform.position = _startPosition;
    }
}
```

Create `Assets/Scripts/CurrencyManager.cs`:

```csharp
using System;
using UnityEngine;

public class CurrencyManager : MonoBehaviour
{
    public static CurrencyManager Instance { get; private set; }

    public int Currency { get; private set; }
    public event Action<int> OnCurrencyChanged;

    void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    public void AddCurrency(int amount)
    {
        Currency += amount;
        OnCurrencyChanged?.Invoke(Currency);
    }

    public bool TrySpend(int amount)
    {
        if (Currency < amount) return false;
        Currency -= amount;
        OnCurrencyChanged?.Invoke(Currency);
        return true;
    }

    public void SetCurrency(int amount)
    {
        Currency = amount;
        OnCurrencyChanged?.Invoke(Currency);
    }
}
```

### 1.3 Wire it up in the Inspector

1. On the `Grid` GameObject, add the `GridManager` component. Set **Critter Prefab** to the prefab from 1.1, **Columns**/**Rows** to `4`, **Cell Size** to `1.5`, **Spawn Interval** to `5`, **Max Tier** to `6`.
2. On the `CurrencyManager` GameObject, add the `CurrencyManager` component.
3. On the critter prefab, add `CritterItem` and `DraggableItem`. Drag the prefab's own Sprite Renderer into `CritterItem`'s **Sprite Renderer** field.
4. Add a UI `Text` (or TextMeshPro) element to a Canvas showing `CurrencyManager.Instance.Currency`, updated from its `OnCurrencyChanged` event — this is just so you can see the number move during testing; it isn't part of the merge logic.

### 1.4 Test the merge

Temporarily set **Spawn Interval** to `1` in the Inspector so critters appear quickly. Enter Play mode, wait for two tier-1 critters to spawn, then drag one onto the other.

**Checkpoint:** you can merge two items into one higher tier — dragging a tier-1 critter onto another tier-1 critter destroys both and spawns a tier-2 critter in the target's cell, and the currency counter increases.

---

## Phase 2 — save/load and the shop loop

### 2.1 Save data and the save/load system

Create `Assets/Scripts/GameSaveData.cs`:

```csharp
using System.Collections.Generic;

[System.Serializable]
public class CritterSaveData
{
    public int col;
    public int row;
    public int tier;
}

[System.Serializable]
public class GameSaveData
{
    public int currency;
    public List<CritterSaveData> critters = new List<CritterSaveData>();
}
```

Create `Assets/Scripts/SaveSystem.cs`:

```csharp
using System.IO;
using UnityEngine;

public static class SaveSystem
{
    private static string SavePath => Path.Combine(Application.persistentDataPath, "merge_critters_save.json");

    public static void Save(GridManager grid, CurrencyManager currency)
    {
        var data = new GameSaveData { currency = currency.Currency };
        grid.CollectSaveData(data.critters);
        File.WriteAllText(SavePath, JsonUtility.ToJson(data));
    }

    public static bool TryLoad(out GameSaveData data)
    {
        data = null;
        if (!File.Exists(SavePath)) return false;
        data = JsonUtility.FromJson<GameSaveData>(File.ReadAllText(SavePath));
        return data != null;
    }
}
```

Add these two methods to `GridManager.cs` (anywhere inside the class):

```csharp
public void CollectSaveData(List<CritterSaveData> into)
{
    for (int c = 0; c < columns; c++)
        for (int r = 0; r < rows; r++)
            if (_cells[c, r] != null)
                into.Add(new CritterSaveData { col = c, row = r, tier = _cells[c, r].tier });
}

public void RestoreFromSave(List<CritterSaveData> saved)
{
    for (int c = 0; c < columns; c++)
        for (int r = 0; r < rows; r++)
            if (_cells[c, r] != null)
            {
                Destroy(_cells[c, r].gameObject);
                _cells[c, r] = null;
            }

    foreach (var entry in saved)
        SpawnCritterAt(entry.col, entry.row, entry.tier);
}
```

### 2.2 The shop loop

A spawn-cost shop gives currency somewhere to go beyond just watching the grid fill on its own: spending currency to manually drop a new tier-1 critter into an empty cell, at a cost that rises each time you use it this session. Add this to `GridManager.cs` as well:

```csharp
[Header("Shop")]
public int manualSpawnBaseCost = 20;
private int _manualSpawnCount;

public bool TryManualSpawn()
{
    var empties = GetEmptyCells();
    if (empties.Count == 0) return false; // nowhere to put it — don't charge for nothing

    int cost = manualSpawnBaseCost * (_manualSpawnCount + 1);
    if (!CurrencyManager.Instance.TrySpend(cost)) return false;

    _manualSpawnCount++;
    var (col, row) = empties[Random.Range(0, empties.Count)];
    SpawnCritterAt(col, row, tier: 1);
    return true;
}
```

Add a UI Button labeled "Spawn Critter" whose **OnClick** calls `GridManager.TryManualSpawn()`. Optionally show the current cost (`manualSpawnBaseCost * (spawn count + 1)`) on the button label so the player knows what they're paying before they click.

### 2.3 Bootstrap: load on start, save on background/quit

Create `Assets/Scripts/GameBootstrap.cs`:

```csharp
using UnityEngine;

public class GameBootstrap : MonoBehaviour
{
    [SerializeField] private GridManager grid;
    [SerializeField] private CurrencyManager currency;

    void Start()
    {
        if (SaveSystem.TryLoad(out GameSaveData data))
        {
            currency.SetCurrency(data.currency);
            grid.RestoreFromSave(data.critters);
        }
    }

    void OnApplicationPause(bool paused)
    {
        // Android backgrounds the app by calling this with true — it does NOT
        // reliably call OnApplicationQuit when the user just switches apps.
        if (paused) SaveSystem.Save(grid, currency);
    }

    void OnApplicationQuit()
    {
        SaveSystem.Save(grid, currency);
    }
}
```

Add `GameBootstrap` to any always-present GameObject in the scene (the `CurrencyManager` object works fine) and assign the **Grid** and **CurrencyManager** references in the Inspector.

Also autosave right after a successful merge, so progress isn't only saved on quit/pause — add this call in `DraggableItem.cs`'s `OnMouseUp`, right where the merge succeeds:

```csharp
if (target != null && target != _item && MergeLogic.TryMerge(grid, _item, target))
{
    SaveSystem.Save(grid, CurrencyManager.Instance);
    return;
}
```

### 2.4 Test persistence

Enter Play mode, merge at least one pair (note the currency value), stop Play mode, then enter Play mode again. `GameBootstrap.Start()` loads the file written by the merge-triggered save from the previous run — this checks persistence without depending on quit/pause events firing correctly inside the editor.

**Checkpoint:** progress persists across a restart — currency and the grid's critters are exactly where you left them after stopping and re-entering Play mode.

---

## Phase 3 — asset spec sheet

Full placeholder-to-final workflow and licensing rules are in `../reference/assets-pipeline.md` — this section is just this game's spec sheet.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `Assets/Sprites/Critters/critter_tier1.png` | 256×256 PNG, transparent | tier-1 critter, smallest/simplest form | Kenney |
| SPRITE | `Assets/Sprites/Critters/critter_tier2.png` | 256×256 PNG, transparent | tier-2 critter, visibly bigger/more detailed than tier 1 | Kenney |
| SPRITE | `Assets/Sprites/Critters/critter_tier3.png` | 256×256 PNG, transparent | tier-3 critter | Kenney |
| SPRITE | `Assets/Sprites/Critters/critter_tier4.png` | 256×256 PNG, transparent | tier-4 critter | Kenney |
| SPRITE | `Assets/Sprites/Critters/critter_tier5.png` | 256×256 PNG, transparent | tier-5 critter | Kenney |
| SPRITE | `Assets/Sprites/Critters/critter_tier6.png` | 256×256 PNG, transparent | tier-6 critter, the top/final form | Kenney |
| SPRITE | `Assets/Sprites/Grid/cell_bg.png` | 256×256 PNG, transparent | grid cell background, rounded-square outline | Kenney |
| SPRITE | `Assets/Sprites/UI/coin_icon.png` | 128×128 PNG, transparent | currency coin icon | Kenney |
| FONT | `Assets/Fonts/ui_font.ttf` | rounded sans | legible at small UI sizes for the currency counter and shop button | Google Fonts |
| SFX | `Assets/Audio/merge_pop.wav` | <0.5s | short pop/chime on a successful merge | generated |
| SFX | `Assets/Audio/spawn_blip.wav` | <0.3s | soft blip when a new critter spawns | generated |
| AUDIO | `Assets/Audio/bgm_loop.ogg` | ~60s seamless loop | calm, upbeat idle-game background loop | OpenGameArt |

Rows are one-per-tier here (not collapsed into a single "×6" row) because each tier is a genuinely distinct sprite, not a palette-swapped repeat — the AI-generation pass in Section 4 of the assets doc needs a separate prompt per tier to keep the "small round creature" → "final evolved form" progression visually readable.

### Placeholders: numbered colored circles

Create `Assets/Editor/GeneratePlaceholderSprites.cs` (an editor-only tool — it runs from a menu item, it isn't shipped in the build):

```csharp
using UnityEditor;
using UnityEngine;

public static class GeneratePlaceholderSprites
{
    private static readonly Color[] TierColors =
    {
        new Color(0.90f, 0.30f, 0.30f), // tier 1 - red
        new Color(0.95f, 0.60f, 0.20f), // tier 2 - orange
        new Color(0.95f, 0.90f, 0.20f), // tier 3 - yellow
        new Color(0.35f, 0.80f, 0.35f), // tier 4 - green
        new Color(0.30f, 0.55f, 0.95f), // tier 5 - blue
        new Color(0.65f, 0.35f, 0.85f), // tier 6 - purple
    };

    [MenuItem("Tools/Merge Critters/Generate Placeholder Sprites")]
    public static void Generate()
    {
        System.IO.Directory.CreateDirectory("Assets/Sprites/Critters");
        for (int i = 0; i < TierColors.Length; i++)
        {
            Texture2D tex = DrawCircle(256, TierColors[i]);
            string path = $"Assets/Sprites/Critters/critter_tier{i + 1}.png";
            System.IO.File.WriteAllBytes(path, tex.EncodeToPNG());
        }
        AssetDatabase.Refresh();
        Debug.Log("Generated 6 placeholder critter sprites in Assets/Sprites/Critters/");
    }

    private static Texture2D DrawCircle(int size, Color color)
    {
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        Vector2 center = new Vector2(size / 2f, size / 2f);
        float radius = size * 0.45f;
        for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
                tex.SetPixel(x, y, Vector2.Distance(new Vector2(x, y), center) <= radius ? color : Color.clear);
        tex.Apply();
        return tex;
    }
}
```

Run it via **Tools > Merge Critters > Generate Placeholder Sprites**. This produces six colored-circle PNGs at the exact paths and dimensions the spec sheet lists — the filenames (`critter_tier1.png` through `critter_tier6.png`) are what tells the tiers apart during development; the tool doesn't rasterize a numeral onto the circle itself, so if you want the number visible on the sprite too, open the six generated files in any image editor and stamp a digit on each — a five-minute manual pass, not a blocker.

After generating them, select all six files in the Project window and set **Texture Type** to **Sprite (2D and UI)** in the Inspector (script-written PNGs import as a generic texture by default). Then assign them, tier 1 through 6, into the critter prefab's `CritterItem.tierSprites` array. `cell_bg.png` and `coin_icon.png` can stay as tinted copies of Unity's built-in **Square** and **Knob** sprites for now — they aren't part of the merge-tier progression, so they don't need the generator.

**Checkpoint:** the full merge loop from Phase 1-2 runs identically with these placeholder sprites in place of the built-in Knob sprite — nothing about the mechanic changes, only what's drawn on screen.

---

## Phase 4 — Unity Ads / LevelPlay integration

Concepts (what rewarded vs. interstitial are for, why test mode exists, consent/COPPA) are covered once in `../reference/monetization-ads.md` — this section is the Unity-specific wiring.

1. Go to the [Unity Dashboard](https://dashboard.unity3d.com) (Unity Gaming Services), create a project entry (or link your existing Unity Hub project), and enable the **Ads** service. Unity's mediation product has been rebranded **LevelPlay** in recent SDK versions while keeping the underlying Unity Ads account/dashboard — check which package name your installed Unity version currently ships (Package Manager search for "Advertisement" or "LevelPlay") before following the exact menu path, since this naming has moved before and can move again.
2. Note your **Android Game ID** from the dashboard's project settings — this is what `Advertisement.Initialize` needs, separate from your Play Console package name.
3. In the dashboard's ad placements, create (or confirm the defaults) two placements: `Rewarded_Android` and `Interstitial_Android`.
4. In Unity, install the Ads/LevelPlay package via **Window > Package Manager**.
5. Create `Assets/Scripts/AdsManager.cs`:

```csharp
using UnityEngine;
using UnityEngine.Advertisements;

public class AdsManager : MonoBehaviour, IUnityAdsInitializationListener, IUnityAdsLoadListener, IUnityAdsShowListener
{
    public static AdsManager Instance { get; private set; }

    [SerializeField] private string androidGameId = "YOUR_GAME_ID"; // from the Unity Dashboard
    [SerializeField] private bool testMode = true; // MUST stay true until you're building the real release candidate

    private const string RewardedAdUnitId = "Rewarded_Android";
    private const string InterstitialAdUnitId = "Interstitial_Android";
    private const int RewardedBonusAmount = 50;

    void Awake()
    {
        if (Instance != null && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
    }

    void Start()
    {
        Advertisement.Initialize(androidGameId, testMode, this);
    }

    public void OnInitializationComplete()
    {
        Debug.Log("Unity Ads initialized (test mode: " + testMode + ")");
        Advertisement.Load(RewardedAdUnitId, this);
        Advertisement.Load(InterstitialAdUnitId, this);
    }

    public void OnInitializationFailed(UnityAdsInitializationError error, string message) =>
        Debug.LogError($"Unity Ads init failed: {error} - {message}");

    public void ShowRewardedAd() => Advertisement.Show(RewardedAdUnitId, this);
    public void ShowInterstitialAd() => Advertisement.Show(InterstitialAdUnitId, this);

    public void OnUnityAdsAdLoaded(string adUnitId) { }
    public void OnUnityAdsFailedToLoad(string adUnitId, UnityAdsLoadError error, string message) { }
    public void OnUnityAdsShowFailure(string adUnitId, UnityAdsShowError error, string message) { }
    public void OnUnityAdsShowStart(string adUnitId) { }
    public void OnUnityAdsShowClick(string adUnitId) { }

    // This is the callback that actually grants the reward — the ad "showing
    // successfully" and the ad being "watched to completion" are different
    // events, and only the latter should ever pay out.
    public void OnUnityAdsShowComplete(string adUnitId, UnityAdsShowCompletionState state)
    {
        if (adUnitId == RewardedAdUnitId && state == UnityAdsShowCompletionState.COMPLETED)
        {
            CurrencyManager.Instance.AddCurrency(RewardedBonusAmount);
            Advertisement.Load(RewardedAdUnitId, this); // pre-load the next one
        }
        else if (adUnitId == InterstitialAdUnitId)
        {
            Advertisement.Load(InterstitialAdUnitId, this);
        }
    }

    // Interstitial fires when the player comes back to a session, not on
    // every scene change — "between sessions", not mid-gameplay.
    void OnApplicationPause(bool isPaused)
    {
        if (!isPaused) ShowInterstitialAd();
    }
}
```

6. Add `AdsManager` to a persistent GameObject (the same one carrying `GameBootstrap` works fine) and set your real **Android Game ID**. Leave **Test Mode** checked.
7. Add a UI Button ("Watch Ad: +50") whose **OnClick** calls `AdsManager.Instance.ShowRewardedAd()`.
8. Enter Play mode (or a device build), click the button, and watch the test ad through to completion — Unity's test creatives are visibly watermarked "Test Mode" so you can't confuse them with a real ad. Confirm the on-screen currency value increases by 50 only after you finish watching, not the moment the ad opens.

**Checkpoint:** a test rewarded ad grants its reward — clicking through a full test-mode rewarded ad increases currency by the bonus amount, and closing the ad early (skipping it) does not.

---

## Phase 5 — Android AAB build

Full first-timer detail (keystore generation, Play App Signing, exact Player Settings fields) lives in `../reference/platform-google-play.md` Section 3 — this is the Merge-Critters-specific pass through it.

1. **File > Build Settings**, select **Android**, click **Switch Platform** (this can take a few minutes the first time).
2. **Edit > Project Settings > Player > Android > Other Settings**:
   - **Package Name**: `com.yourstudio.mergecritters` (pick your own reverse-domain ID — this is permanent once published)
   - **Minimum API Level**: whatever Play's current minimum-target-API-level requirement implies as a safe floor — check the live number in the platform doc rather than assuming last year's
   - **Scripting Backend**: **IL2CPP**
   - **Target Architectures**: check **ARM64**, and leave **ARMv7** checked too
3. **Player > Publishing Settings**: point **Keystore** at your `upload-keystore.jks` (generate one with the `keytool` command in the platform doc if you haven't already), enter the keystore password, then pick your key alias and enter the key password.
4. Back in **Build Settings**, check **Build App Bundle (Google Play)**, click **Build**, and save as `MergeCritters.aab`.

**Checkpoint:** an `.aab` is produced — the file exists at the path you chose and is a plausible size (tens of MB, not a few KB, which would mean the build silently failed to include your assets).

---

## Ship-it challenge

Upload `MergeCritters.aab` to Play Console's **closed testing** track (Section 5, "Testing ladder," in `../reference/platform-google-play.md`). Add yourself (and ideally a couple of real testers) via the opt-in link, install the build on an actual Android device — not just the editor — and click through a rewarded ad to completion. Confirm the in-game currency actually increases by the reward amount on that real device, in the real closed-testing build, not just in the editor.

**Acceptance:** the game is in Play closed testing, and a rewarded ad watched on a real device grants its reward.

---

## Break-fix drills (no inline solutions)

**Drill 1 — Gradle build fails.** The Android build in Phase 5 fails during the Gradle step with a version-mismatch-flavored error, even though the same project built fine before you changed some Android-related settings (or updated a module outside of Unity Hub). Find which piece — SDK, NDK, or Android Gradle Plugin — is out of step with what this Unity version expects, and fix it without breaking the pairing again.

**Drill 2 — the rewarded callback never fires.** You call `Advertisement.Show(RewardedAdUnitId, this)`, the ad visibly plays and closes, but the player's currency never increases. Figure out where in `AdsManager` the completion event is supposed to be wired up, and why "the ad closed" isn't the same event as "the ad was watched to completion."

**Drill 3 — merged items desync from the save.** After adding your own extra autosave call somewhere in the drag/merge flow, you notice that after a restart, a pair of critters that were merged in the previous session sometimes both reappear on the grid alongside the critter they merged into — as if the merge never happened. Find where in the merge sequence the save call is landing relative to when the grid's bookkeeping (`ClearCell`, `SpawnCritterAt`) actually updates, and fix the ordering.

## Hints

<details>
<summary>Hints for the drills (open only when stuck)</summary>

- **Drill 1:** Unity Hub installs a JDK/SDK/NDK combination matched to your editor version under its own managed folders. If a previous manual Android Studio/SDK install is still referenced in **Preferences > External Tools**, Unity may be building against a JDK or NDK version its own Android Gradle Plugin wasn't tested with. Point External Tools back at the Hub-managed versions (or update them to match what your current Unity version's release notes list as supported) rather than mixing a manual install with Hub's.
- **Drill 2:** `OnUnityAdsShowStart` fires when the ad begins playing, and the ad closing (whether skipped or watched fully) is reported through `OnUnityAdsShowComplete`'s `UnityAdsShowCompletionState` parameter — check that the reward-granting code is inside the `state == UnityAdsShowCompletionState.COMPLETED` branch and not just anywhere in `OnUnityAdsShowComplete`, and that `AdsManager` was actually passed as the `IUnityAdsShowListener` in the `Show()` call that triggered this particular ad.
- **Drill 3:** trace exactly which line calls `SaveSystem.Save(...)` relative to `MergeLogic.TryMerge(...)` — if your added autosave call reads the grid's state (via `CollectSaveData`) before `TryMerge` has finished calling `ClearCell` on both source cells and `SpawnCritterAt` for the result, the JSON captures a mid-merge snapshot instead of the resolved one. The autosave shown in Phase 2.3 deliberately fires only after `TryMerge` already returned `true`, in the caller — not from inside `MergeLogic` itself.

</details>

## Done when

- [ ] Unity project builds/runs in the editor with Unity 6 LTS + Android Build Support installed
- [ ] Dragging two same-tier critters merges them into the next tier and awards currency
- [ ] Grid state and currency persist across a Play-mode (or device) restart
- [ ] The spawn-cost shop loop spends currency and places a new critter
- [ ] The full loop runs correctly on placeholder art before any final asset exists
- [ ] Rewarded video and interstitial ads are wired through Unity Ads/LevelPlay in test mode
- [ ] A signed `.aab` was built from Unity
- [ ] All three break-fix drills solved
- [ ] The game is in Play closed testing with a working rewarded ad
