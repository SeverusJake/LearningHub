# Guide — Game 09: Card Forge

Reference docs: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), [`../reference/platform-steam.md`](../reference/platform-steam.md).

## Phase 0 — Setup check

Unity from Games 03/06. New 2D project `CardForge`, Unity 6 LTS.

**Checkpoint:** the empty project runs in Play mode, no errors.

## Phase 1 — Deckbuilder core

Cards are **data**, not code — a `ScriptableObject` per card so designers (you + AI) add cards without touching logic.

`Scripts/CardData.cs`:

```csharp
using UnityEngine;

public enum CardType { Attack, Skill, Power }
public enum EffectType { Damage, Block, Draw, Energy }

[System.Serializable]
public struct CardEffect { public EffectType type; public int amount; }

[CreateAssetMenu(menuName = "CardForge/Card")]
public class CardData : ScriptableObject
{
    public string cardName;
    [TextArea] public string description;
    public CardType type;
    public int energyCost;
    public CardEffect[] effects;   // resolved in order
    public Sprite art;
}
```

`Scripts/CombatManager.cs` — the turn loop, energy, and an **effect queue** so effects resolve in a defined order (Break-fix drill 1):

```csharp
using System.Collections.Generic;
using UnityEngine;

public class CombatManager : MonoBehaviour
{
    public int maxEnergy = 3;
    public int energy, playerHp = 70, playerBlock;
    public Enemy enemy;
    public DeckManager deck;

    void Start() => StartPlayerTurn();

    public void StartPlayerTurn()
    {
        energy = maxEnergy;
        playerBlock = 0;
        deck.DrawHand(5);
        enemy.RollIntent();   // telegraph what the enemy will do
    }

    public bool PlayCard(CardData card)
    {
        if (card.energyCost > energy) return false;
        energy -= card.energyCost;
        foreach (var e in card.effects) ResolveEffect(e);   // ordered resolution
        deck.Discard(card);
        if (enemy.Hp <= 0) OnWin();
        return true;
    }

    void ResolveEffect(CardEffect e)
    {
        switch (e.type)
        {
            case EffectType.Damage: enemy.TakeDamage(e.amount); break;
            case EffectType.Block:  playerBlock += e.amount; break;
            case EffectType.Draw:   deck.Draw(e.amount); break;
            case EffectType.Energy: energy += e.amount; break;
        }
    }

    public void EndTurn()
    {
        deck.DiscardHand();
        int incoming = Mathf.Max(0, enemy.IntentDamage - playerBlock);
        playerHp -= incoming;
        if (playerHp <= 0) { RunManager.Instance.EndRun(false); return; }
        StartPlayerTurn();
    }

    void OnWin() => RunManager.Instance.OnCombatWon();
}
```

`Scripts/DeckManager.cs` — draw/hand/discard piles with reshuffle:

```csharp
using System.Collections.Generic;
using UnityEngine;

public class DeckManager : MonoBehaviour
{
    public List<CardData> drawPile = new(), hand = new(), discardPile = new();

    public void DrawHand(int n) { hand.Clear(); Draw(n); }

    public void Draw(int n)
    {
        for (int i = 0; i < n; i++)
        {
            if (drawPile.Count == 0) Reshuffle();
            if (drawPile.Count == 0) return;
            hand.Add(drawPile[0]);
            drawPile.RemoveAt(0);
        }
    }

    void Reshuffle()
    {
        drawPile.AddRange(discardPile);
        discardPile.Clear();
        for (int i = 0; i < drawPile.Count; i++)
        {
            int j = Random.Range(i, drawPile.Count);
            (drawPile[i], drawPile[j]) = (drawPile[j], drawPile[i]);
        }
    }

    public void Discard(CardData c) { hand.Remove(c); discardPile.Add(c); }
    public void DiscardHand() { discardPile.AddRange(hand); hand.Clear(); }
}
```

`Scripts/Enemy.cs` telegraphs an intent each turn (`RollIntent` sets `IntentDamage`), and `TakeDamage` reduces `Hp`.

**Checkpoint:** you draw a hand, spend energy playing cards to damage/block, the enemy shows its intent and hits you on end-turn, and reducing enemy HP to 0 wins the fight.

## Phase 2 — Run structure, relics, persistence

- **Map:** a node graph of encounters (fight / elite / shop / rest / boss) with branching paths; the player picks a path node to node up to a boss.
- **Rewards:** after a fight, choose one of three card rewards to add to the deck; gold drops.
- **Relics:** passive `ScriptableObject` upgrades (e.g. "+1 energy each turn", "start combat with 5 block").
- **Shop:** spend gold on cards/relics/card-removal.
- **Persistence:** serialize the full run state (deck, HP, map position, relics, gold) to JSON on every node transition and on quit, so a mid-run quit resumes (Break-fix drill 2).

**Checkpoint:** a full run from first node to boss works, and quitting mid-run and relaunching resumes exactly where you left off.

## Phase 3 — Asset spec sheet

Swap finals per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md). **Card art is the biggest job** — one art slot per card; generate them in a consistent style with a batched prompt set.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `Assets/Art/card_frame_attack.png` | 300×420 PNG, transparent | attack card frame | AI-generated |
| SPRITE | `Assets/Art/card_frame_skill.png` | 300×420, transparent | skill card frame | AI-generated |
| SPRITE | `Assets/Art/cards/*.png` | 220×160 each | per-card art (many) | AI-generated, batched |
| SPRITE | `Assets/Art/enemy_*.png` | 256×256, transparent | enemy sprites | AI-generated |
| SPRITE | `Assets/Art/relic_*.png` | 96×96, transparent | relic icons | Kenney/AI |
| SPRITE | `Assets/Art/map_node.png` | 64×64, transparent | map node icons | Kenney |
| SFX | `Assets/Audio/card_play.wav` | <0.3s | card play | generated |
| AUDIO | `Assets/Audio/bgm.ogg` | ~3min loop | run theme | OpenGameArt |

Placeholders now: plain framed rectangles with the card name + description as text, colored boxes for enemies.

**Checkpoint:** the game plays fully with placeholder framed cards.

## Phase 4 — Steamworks + wishlists

- Create the app in Steamworks, get the AppID. Fill the **store page**: capsules and screenshots at exact dimensions (header 460×215, main 616×353, etc. — see [`../reference/platform-steam.md`](../reference/platform-steam.md)), tags (Deckbuilding, Roguelike, Card Game), a trailer, short + long descriptions.
- **Wishlists are the launch lever:** put the store page up as **Coming Soon** as early as possible (the 30-day-before-release rule and the wishlist algorithm both reward this). Concrete wishlist-building actions: post the demo/trailer to relevant subreddits and Discords with genuine participation (see the money track's distribution ideas in [`../../money/README.md`](../../money/README.md)), reach out to deckbuilder streamers, and run a demo during Steam Next Fest.
- **Demo:** build a demo (first act only) as a **separate AppID/depot** so it shows as a demo, not the full game (Break-fix drill 3).
- **Achievements:** define a few in Steamworks and unlock them via the Steamworks SDK (Steamworks.NET or Facepunch.Steamworks) — `SteamUserStats.SetAchievement("FIRST_BOSS")`.

**Checkpoint:** the store-page draft is complete and ready to submit for review.

## Phase 5 — Build + SteamPipe

- Windows build from Unity.
- Upload via SteamPipe (app-build + depot VDF, `steamcmd +run_app_build`) — see [`../reference/platform-steam.md`](../reference/platform-steam.md) — to a `default`/`beta` branch first for testing.

**Checkpoint:** the build uploads to a Steam branch and installs via the Steam client.

## Monetization integration

Premium, wishlist-driven. No ads. Revenue comes from the paid Steam release; the demo + wishlists are the marketing engine. Steam takes 30% (see [`../reference/platform-steam.md`](../reference/platform-steam.md)).

## Ship-it challenge

1. Create the Steamworks app (pay the $100 Direct fee if this is your chosen Steam release), complete tax/bank paperwork.
2. Build and publish the **store page** with real capsules/trailer/screenshots; set it to **Coming Soon** with wishlists open.
3. Upload a **demo** build (its own AppID/depot) and run at least three concrete wishlist-building actions.

**Acceptance:** a Steam store page is live with wishlists open, and a demo build is uploaded.

## Break-fix drills

Ask Claude in-session to introduce each; diagnose before Hints.

1. **Card effects resolve in the wrong order** — a card that says "deal damage, then draw" sometimes draws first, causing wrong outcomes.
2. **Run state is lost on quit** — quitting mid-combat and relaunching starts a new run instead of resuming.
3. **The Steam demo appears as the full game** — the demo download gives players the complete game.

## Hints

<details>
<summary>Hints (open only when stuck)</summary>

1. `PlayCard` iterates `card.effects` in array order and `ResolveEffect` must be synchronous (or queued) — if any effect starts a coroutine/animation that resolves later, ordering breaks. Resolve into a queue and process it in order before returning.
2. Persistence must serialize on *every* node transition **and** on `OnApplicationQuit`/`OnApplicationPause`, including mid-combat state. If you only save between fights, a mid-combat quit loses the run. Save the combat state too.
3. A Steam demo is a **separate app** (its own AppID and depot) linked to the main app as its demo in Steamworks — not a branch of the full game's depot. Create the demo AppID and upload the demo build there.

</details>

## Done when

- [ ] Cards-as-data, the energy/draw/play/discard turn loop, enemy intents, an ordered effect resolver, and HP/block all work
- [ ] A branching run map, rewards, relics, a shop, and resumable mid-run persistence work
- [ ] Final AI-generated card art and enemy sprites are swapped in over placeholders
- [ ] A Steam store page with capsules/tags and achievements is built
- [ ] A demo build (separate AppID/depot) and a Windows build upload via SteamPipe
- [ ] A Steam page is live with wishlists open and a demo build uploaded
