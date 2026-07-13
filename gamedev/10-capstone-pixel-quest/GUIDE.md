# Guide — Game 10: Capstone: Pixel Quest

**This guide is closed.** It states requirements and an acceptance checklist — not step-by-step instructions. You have shipped nine games across four platforms and three engines; those projects, and your own notes, are your toolkit now. Reach for the reference docs ([`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), [`../reference/platform-steam.md`](../reference/platform-steam.md), [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md)) and your prior games, not a walkthrough. There is no Hints section.

## Requirements

**1. A complete, small commercial game.** Pick **one** focused genre — an action-platformer or a top-down adventure — and build roughly 30-60 minutes of real, intentional content: a beginning, a middle, an ending, and a difficulty curve that was designed, not accidental. "Complete" is the operative word — a polished small game beats an ambitious unfinished one, and the whole point of the capstone is finishing.

**2. Built properly in Godot 4.** Clean project structure (scenes and scripts organized, not one giant node). A working **save system** (progress persists across sessions). An **options menu** (at minimum: volume, fullscreen/windowed, and a way to rebind or at least view controls). **Controller support** — the game is fully playable on a gamepad, using Godot's input actions so keyboard and controller both map cleanly.

**3. A free web demo that funnels to Steam.** Export a polished vertical slice (the first level or opening area) to **HTML5**, host it (reuse your web-portals knowledge and the Cloudflare/DevOps deploy path from Games 02/07 and [`../../money/03-micro-tools/`](../../money/03-micro-tools/)), and put a clear "Wishlist on Steam" call-to-action in the demo that links to your store page. The demo is marketing: it exists to convert players into wishlists.

**4. A real Steam release.** A store page with real capsules, a trailer, and screenshots at the exact required dimensions ([`../reference/platform-steam.md`](../reference/platform-steam.md)). Wishlists open on a "Coming Soon" page well before launch. The **$100 Steam Direct fee paid** for this app (this is the track's budgeted Steam release unless you already spent it on Game 08 or 09 — if so, decide honestly whether to fund a second). Tax and banking paperwork completed. A proper build uploaded via **SteamPipe**. **Achievements** defined and wired via the Steamworks SDK. A written launch-day checklist that you actually execute.

**5. Real final assets throughout.** No placeholders ship. All sprites, tilesets, UI, music, and SFX are AI-generated (or properly licensed) finals, consistent in style, per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md). Disclose AI-generated content wherever the store requires it.

## Acceptance checklist

All 20 must be true before the capstone is done.

1. The game has a start, ~30-60 minutes of content, and a real ending — it can be played start to finish.
2. The game is beatable, and you (or a tester) have beaten it end to end without a blocking bug.
3. A save system persists progress across a full quit-and-relaunch.
4. An options menu adjusts at least volume and fullscreen/windowed and applies immediately.
5. The game is fully playable on a controller, and input works cleanly on both keyboard and gamepad.
6. Project structure is clean — scenes/scripts organized, no single monolithic script running everything.
7. A vertical-slice **web demo** is exported to HTML5 and runs in a browser.
8. The web demo is **hosted at a public URL** and loads without errors.
9. The web demo has a working "Wishlist on Steam" link to your store page.
10. The Steam store page is built with real capsules at the correct dimensions.
11. The store page has a trailer and at least 5 screenshots.
12. The store page is live as **Coming Soon** with wishlists enabled.
13. The $100 Steam Direct fee is paid for this app (or consciously reused/decided per the budget).
14. Steam tax and banking paperwork is complete.
15. A build is uploaded via SteamPipe and installs through the Steam client.
16. At least three achievements are defined and unlock correctly in-game via the SDK.
17. A price is set for the full game.
18. A written launch-day checklist exists and has been executed (or is ready to execute on release day).
19. Wishlists exceed a target you set for yourself before launch (write the number down; judge honestly).
20. AI-generated content is disclosed wherever the store requires it, and no placeholder assets ship.

## Reflection

After the checklist is green, write a short `reflection.md` answering:

- **Engine + platform for next time.** Across the four platforms and three engines you shipped to, which would you choose for your *next* game, and why? What did each cost you in friction vs. what it earned you in reach or revenue?
- **What you'd reuse.** From your nine prior games, which code, systems, or workflows would you lift wholesale into the next project, and what would you rebuild differently now that you've shipped ten?
- **What "done" taught you.** What did finishing and actually publishing teach you that building never did?

This reflection is the real graduation: you now know, from having done it, how to take a game from empty project to a paid storefront — and which parts are worth your time next.
