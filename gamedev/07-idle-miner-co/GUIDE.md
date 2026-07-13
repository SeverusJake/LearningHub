# Guide — Game 07: Idle Miner Co

Reference docs: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), [`../reference/platform-google-play.md`](../reference/platform-google-play.md), [`../reference/monetization-ads.md`](../reference/monetization-ads.md), [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md). Deploy path reuses [`../../money/03-micro-tools/`](../../money/03-micro-tools/) and [`../../devops/`](../../devops/).

## Phase 0 — Setup check

You built a Vite/JS web game in Game 02. Same stack here with PixiJS.

```bash
npm create vite@latest idle-miner -- --template vanilla
cd idle-miner
npm install pixi.js
npm run dev
```

In `main.js`, mount a PixiJS app:

```javascript
import { Application } from 'pixi.js';

const app = new Application();
await app.init({ background: '#101820', resizeTo: window });
document.body.appendChild(app.canvas);
```

**Checkpoint:** `npm run dev`, the browser shows a dark PixiJS canvas filling the window, no console errors.

## Phase 1 — Incremental core

Keep game logic separate from rendering. `game.js`:

```javascript
// Each generator: base cost, cost growth, base output per second, count owned.
export const GENERATORS = [
  { id: 'miner',    name: 'Miner',    baseCost: 10,    growth: 1.15, baseRate: 0.2 },
  { id: 'drill',    name: 'Drill',    baseCost: 150,   growth: 1.15, baseRate: 2.5 },
  { id: 'elevator', name: 'Elevator', baseCost: 2000,  growth: 1.15, baseRate: 30  },
  { id: 'refinery', name: 'Refinery', baseCost: 25000, growth: 1.15, baseRate: 350 },
];

export function newState() {
  return {
    resources: 0,
    counts: { miner: 0, drill: 0, elevator: 0, refinery: 0 },
    prestigeMult: 1,
    prestigePoints: 0,
    lastSeen: Date.now(),
  };
}

// Cost of the next unit rises geometrically with how many you already own.
export function costOf(gen, owned) {
  return Math.floor(gen.baseCost * Math.pow(gen.growth, owned));
}

// Resources produced per second across all generators, scaled by prestige.
export function ratePerSecond(state) {
  let rate = 0;
  for (const g of GENERATORS) rate += g.baseRate * state.counts[g.id];
  return rate * state.prestigeMult;
}

export function buy(state, genId) {
  const gen = GENERATORS.find(g => g.id === genId);
  const owned = state.counts[genId];
  const cost = costOf(gen, owned);
  if (state.resources >= cost) {
    state.resources -= cost;
    state.counts[genId] += 1;
    return true;
  }
  return false;
}

// Advance the simulation by dtSeconds (used by both the live tick and offline catch-up).
export function advance(state, dtSeconds) {
  state.resources += ratePerSecond(state) * dtSeconds;
}
```

Offline progress + persistence in `save.js` — **clamp elapsed time** so a long absence (or a bad clock) can't produce an absurd payout (that's Break-fix drill 1):

```javascript
import { advance } from './game.js';

const KEY = 'idleMinerSave';
const MAX_OFFLINE_SECONDS = 8 * 3600; // cap offline earnings at 8h

export function save(state) {
  state.lastSeen = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function load(fresh) {
  const raw = localStorage.getItem(KEY);
  if (!raw) return fresh;
  const state = JSON.parse(raw);
  const elapsed = Math.min((Date.now() - state.lastSeen) / 1000, MAX_OFFLINE_SECONDS);
  if (elapsed > 0) advance(state, elapsed);   // catch-up for time away
  return state;
}
```

The live tick loop in `main.js`:

```javascript
import { newState, advance, ratePerSecond } from './game.js';
import { save, load } from './save.js';

let state = load(newState());

app.ticker.add((ticker) => {
  advance(state, ticker.deltaMS / 1000);
});

setInterval(() => save(state), 5000);       // autosave
window.addEventListener('beforeunload', () => save(state));
```

**Checkpoint:** buying a generator raises the per-second rate; reload the page after waiting and offline resources have accrued (capped at 8h).

## Phase 2 — Prestige + PixiJS UI

Prestige: spend accumulated resources for permanent multiplier points. `prestige.js`:

```javascript
export function prestigeGain(state) {
  // sqrt curve so each prestige needs exponentially more resources
  return Math.floor(Math.sqrt(state.resources / 1e6));
}

export function doPrestige(state) {
  const gain = prestigeGain(state);
  if (gain < 1) return false;
  state.prestigePoints += gain;
  state.prestigeMult = 1 + state.prestigePoints * 0.1; // +10% per point
  // reset progress but keep prestige
  state.resources = 0;
  for (const k in state.counts) state.counts[k] = 0;
  return true;
}
```

Build the UI with PixiJS `Text` and clickable `Container` buttons — one row per generator showing name, count, next cost, and a buy button; a header showing resources and rate; a prestige button showing the pending gain. Update the labels each tick from `state`. Format big numbers (e.g. 12.3K, 4.56M) with a helper so they stay readable.

**Checkpoint:** the UI shows live resources/rate, buy buttons work and grey out when unaffordable, and prestige resets progress while boosting the multiplier.

## Phase 3 — Asset spec sheet

Swap finals per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md), same paths.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITE | `public/art/mine_bg.png` | 720×1280 PNG | mine shaft background | AI-generated |
| SPRITE | `public/art/miner.png` | 128×128, transparent | miner worker icon | Kenney |
| SPRITE | `public/art/drill.png` | 128×128, transparent | drill icon | Kenney |
| SPRITE | `public/art/icon_resource.png` | 64×64, transparent | ore/coin resource | Kenney |
| SPRITE | `public/art/ui_button.png` | 240×72, 9-slice | button background | Kenney UI |
| SFX | `public/audio/buy.wav` | <0.3s | purchase click | generated |
| AUDIO | `public/audio/bgm.ogg` | ~2min loop | calm industrial ambience | OpenGameArt |

Placeholders now: PixiJS `Graphics` rectangles/circles with tinted fills.

**Checkpoint:** the game runs with placeholder graphics.

## Phase 4 — PWA + TWA (Play) wrapper

**PWA.** `public/manifest.json`:

```json
{
  "name": "Idle Miner Co",
  "short_name": "IdleMiner",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#101820",
  "theme_color": "#101820",
  "icons": [
    { "src": "/art/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/art/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

A cache-versioned service worker `public/sw.js` — **bump `CACHE` on every deploy** so users don't get stuck on a stale build (Break-fix drill 2):

```javascript
const CACHE = 'idle-miner-v1';   // bump to v2, v3, ... each deploy
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

Register it and link the manifest in `index.html` (`<link rel="manifest" href="/manifest.json">`, `navigator.serviceWorker.register('/sw.js')`).

**TWA → Play AAB** with Bubblewrap, after the web build is deployed at your domain:

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://YOURDOMAIN/manifest.json
bubblewrap build
```

This produces an `.aab`. Bubblewrap requires **Digital Asset Links** — host `.well-known/assetlinks.json` at your domain with the app's signing fingerprint, or the TWA opens with a browser address bar (Break-fix drill 3).

Ads honesty: a TWA is a web wrapper, so mobile AdMob doesn't drop in like a native SDK — you run **web ad slots** in the page (which also serve inside the TWA) rather than AdMob interstitials. Keep ad placements gentle (a banner slot, a rewarded-style "watch to double offline earnings" web ad). See [`../reference/monetization-ads.md`](../reference/monetization-ads.md).

**Checkpoint:** the site is installable as a PWA (browser shows an install prompt) and `bubblewrap build` produces an `.aab`.

## Phase 5 — Deploy

- Deploy the `vite build` output to **Cloudflare Pages** — reuse the workflow from [`../../money/03-micro-tools/`](../../money/03-micro-tools/) and your [`../../devops/`](../../devops/) skills. Buy a domain (~$10) and point it at the Pages project.
- Host `.well-known/assetlinks.json` at that domain.
- Run `bubblewrap build` against the live manifest URL, then upload the AAB to Play internal testing (see [`../reference/platform-google-play.md`](../reference/platform-google-play.md)).

**Checkpoint:** the game is live at your public URL and the AAB is uploaded to Play internal testing.

## Monetization integration

Ads are web ad slots (banner + a rewarded-style web ad for an offline-earnings boost) plus an optional "remove ads" / "starter pack" IAP. Ads are the primary model; keep them non-intrusive. Full detail in [`../reference/monetization-ads.md`](../reference/monetization-ads.md).

## Ship-it challenge

1. Deploy the web build to Cloudflare Pages on your own domain; confirm it loads and is installable as a PWA.
2. Host `assetlinks.json`, run Bubblewrap, and upload the resulting AAB to Play internal testing.

**Acceptance:** the game is live as a web PWA at a public URL, and the AAB is in Play internal testing.

## Break-fix drills

Ask Claude in-session to introduce each; diagnose before Hints.

1. **Offline earnings explode** — leaving the game overnight (or with a wrong system clock) grants a preposterous pile of resources.
2. **Users get a stale build** — you deploy an update but returning players still see the old version.
3. **The TWA opens with a browser address bar** across the top instead of full-screen — it's not being trusted as your app.

## Hints

<details>
<summary>Hints (open only when stuck)</summary>

1. `load()` must clamp `elapsed` with `Math.min(..., MAX_OFFLINE_SECONDS)`. If you remove the cap, a huge `Date.now() - lastSeen` feeds straight into `advance()`. Keep the cap, and consider validating that `lastSeen` isn't in the future.
2. The service worker serves from `caches.match` first. If `CACHE` keeps the same name across deploys, the old cached files win forever. Bump the `CACHE` constant every deploy so `activate` purges the old cache.
3. Digital Asset Links is how Android verifies the TWA belongs to your domain. `.well-known/assetlinks.json` must be reachable at the exact domain and contain the app's SHA-256 signing fingerprint. Re-run `bubblewrap fingerprint` and confirm the file matches.

</details>

## Done when

- [ ] Generators, exponential cost curves, a tick loop, and clamped offline progress all work and persist to localStorage
- [ ] Prestige resets progress and applies a permanent multiplier
- [ ] The PixiJS UI updates live and formats big numbers readably
- [ ] Final AI-generated assets are swapped in over placeholders
- [ ] The PWA is installable and Bubblewrap produces an AAB with working Digital Asset Links
- [ ] The game is live as a web PWA at a public URL and the AAB is in Play internal testing
