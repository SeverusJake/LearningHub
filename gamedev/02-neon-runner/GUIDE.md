# Guide — Game 02: Neon Runner

Reference docs used throughout this guide: [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md) (placeholder-first workflow, spec-sheet format) and [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md) (itch.io, CrazyGames, Poki, GameDistribution — accounts, SDKs, the own-ads rule). Read the portals doc once before Phase 4; the own-ads rule in particular is the single most common reason a portal submission gets rejected.

All commands below assume a `game/` subfolder inside `gamedev/02-neon-runner/` holding the actual Phaser project — this GUIDE and the game code live side by side.

---

## Phase 0 — Node.js + a Phaser 3 project via Vite

Install Node.js from [nodejs.org](https://nodejs.org) (the LTS release) if you haven't already, then check it:

```bash
node --version
npm --version
```

Expected output: a version string for each (Node 18+ is fine). If either command isn't found, Node isn't installed or isn't on PATH yet — fix that before continuing.

Scaffold a Vite project into a `game/` subfolder and add Phaser:

```bash
npm create vite@latest game -- --template vanilla
cd game
npm install phaser
```

Expected output: `npm create vite@latest` prints a short "Done. Now run:" summary; `npm install phaser` adds Phaser to `package.json` and `node_modules`.

Clear out the default Vite counter demo and boot a bare Phaser canvas. Replace the contents of `game/src/main.js`:

```javascript
// game/src/main.js
import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 400,
  backgroundColor: '#101018',
  parent: 'app',
  scene: {
    create() {
      this.add.text(20, 20, 'Neon Runner boots.', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#39ff88',
      });
    },
  },
};

new Phaser.Game(config);
```

`game/index.html` (from the vanilla template) already has a `<div id="app">` — leave that div, remove the counter markup Vite scaffolded inside it, and keep the `<script type="module" src="/src/main.js"></script>` tag pointing at the file above.

Run it:

```bash
npm run dev
```

Expected output: Vite prints a local dev URL (usually `http://localhost:5173`).

**Checkpoint:** opening that URL in a browser shows an 800×400 dark canvas with the text "Neon Runner boots." — a blank Phaser canvas running at localhost, no gameplay yet.

---

## Phase 1 — endless-runner core

Replace `game/src/main.js` with the full scene: an auto-running world, jump on tap or space with ground collision, obstacles that spawn on a timer and scroll left, and a distance score.

```javascript
// game/src/main.js
import Phaser from 'phaser';

const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 400;
const GROUND_Y = 380;
const JUMP_VELOCITY = -620;

let player;
let ground;
let obstacles;
let scoreText;
let runSpeed = 300;
let distance = 0;
let isDead = false;
let spawnTimer;

function preload() {
  // Placeholders only for now — Phase 3 swaps these for real sprites/audio
  // per the spec sheet in ../reference/assets-pipeline.md.
}

function create() {
  // Ground — a static body the player collides with.
  ground = this.add.rectangle(WORLD_WIDTH / 2, GROUND_Y + 20, WORLD_WIDTH, 40, 0x2a2a3a);
  this.physics.add.existing(ground, true);

  // Player — a colored box standing in for the run-cycle sprite sheet.
  player = this.add.rectangle(120, GROUND_Y - 32, 64, 64, 0x39ff88);
  this.physics.add.existing(player);
  player.body.setCollideWorldBounds(true);
  this.physics.add.collider(player, ground);

  // Obstacles group + collision -> death.
  obstacles = this.physics.add.group();
  this.physics.add.collider(player, obstacles, hitObstacle, null, this);

  // Input: space bar or a tap/click both trigger a jump.
  this.input.keyboard.on('keydown-SPACE', tryJump, this);
  this.input.on('pointerdown', tryJump, this);

  // Score.
  distance = 0;
  isDead = false;
  scoreText = this.add.text(16, 16, 'Distance: 0', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffffff',
  });

  // Obstacle spawner, fixed interval for now — Phase 2 adds the ramp.
  spawnTimer = this.time.addEvent({
    delay: 1500,
    loop: true,
    callback: spawnObstacle,
    callbackScope: this,
  });
}

function tryJump() {
  if (isDead) return;
  const onGround = player.body.blocked.down || player.body.touching.down;
  if (onGround) {
    player.body.setVelocityY(JUMP_VELOCITY);
  }
}

function spawnObstacle() {
  if (isDead) return;
  const obstacle = this.add.rectangle(WORLD_WIDTH + 20, GROUND_Y - 32, 32, 64, 0xff3355);
  this.physics.add.existing(obstacle);
  obstacle.body.setAllowGravity(false);
  obstacle.body.setVelocityX(-runSpeed);
  obstacles.add(obstacle);
}

function hitObstacle() {
  if (isDead) return;
  isDead = true;
  this.physics.pause();
  player.fillColor = 0x555555;
}

function update(time, delta) {
  if (isDead) return;

  distance += (runSpeed * delta) / 1000;
  scoreText.setText('Distance: ' + Math.floor(distance));

  obstacles.children.each((obstacle) => {
    obstacle.body.setVelocityX(-runSpeed);
    if (obstacle.x < -40) obstacle.destroy();
  });
}

const config = {
  type: Phaser.AUTO,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#101018',
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 1200 },
      debug: false,
    },
  },
  scene: { preload, create, update },
};

new Phaser.Game(config);
```

Run `npm run dev` (if it isn't still running) and play it.

**Checkpoint:** you can run (the world auto-scrolls, obstacles drift left on their own), jump with space or a click/tap, and colliding with an obstacle freezes the game (physics pauses, the player box turns gray) — the death state has no restart yet, that's Phase 2.

---

## Phase 2 — difficulty ramp, death, and restart

Two additions to the same scene: `runSpeed` climbs the longer you survive instead of staying fixed at 300, and hitting an obstacle now shows a real game-over screen with a restart path instead of just freezing.

Add a ramp inside `update()`, right after the distance line:

```javascript
// inside update(time, delta), after distance += ...
runSpeed = 300 + Math.min(distance * 0.4, 350); // caps at 650 so it never becomes unfair
```

Replace `hitObstacle` and add a `restartGame` function:

```javascript
function hitObstacle() {
  if (isDead) return;
  isDead = true;
  this.physics.pause();
  player.fillColor = 0x555555;
  spawnTimer.remove();

  const overlay = this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x000000, 0.6);
  this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20, 'GAME OVER', {
    fontFamily: 'monospace', fontSize: '32px', color: '#ff3355',
  }).setOrigin(0.5);
  this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 20, 'Distance: ' + Math.floor(distance) + '  —  tap or press space to restart', {
    fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
  }).setOrigin(0.5);

  this.time.delayedCall(300, () => {
    this.input.keyboard.once('keydown-SPACE', () => restartGame.call(this), this);
    this.input.once('pointerdown', () => restartGame.call(this), this);
  });
}

function restartGame() {
  runSpeed = 300;
  this.scene.restart();
}
```

The 300ms `delayedCall` before re-arming the restart listeners matters: without it, the same tap/space press that caused the fatal jump-or-hit can also immediately fire the restart, and the death screen flashes past before you ever read your score.

Run it, die on purpose a few times, and watch the "Distance:" number needed to make the game visibly faster climb.

**Checkpoint:** run speed visibly increases the longer you survive (obstacles and background scroll noticeably faster after ~20-30 seconds than at the start), and dying shows a GAME OVER screen with your distance that a tap or space press restarts cleanly back to run speed 300.

---

## Phase 3 — asset spec sheet

Per [`../reference/assets-pipeline.md`](../reference/assets-pipeline.md): mechanics first, art last. The game above already runs fully on colored-rectangle placeholders — this phase writes the spec sheet those placeholders are standing in for, so the eventual swap is a file-copy, not a rebuild.

| TYPE | path | spec | description | fallback |
|---|---|---|---|---|
| SPRITESHEET | `assets/player-run.png` | 64×64/frame, 6 frames horizontal | neon-outlined runner character, looping run cycle, side view | Kenney.nl (CC0 platformer character packs) or AI-generated |
| SPRITE | `assets/obstacle.png` | 64×64 PNG, transparent background | glowing neon spike/crystal obstacle, single object, centered | Kenney.nl or AI-generated |
| BACKGROUND | `assets/bg-parallax.png` | 1024×400, seamless tileable, 2-3 layers (far skyline, mid buildings, near street) | dark neon city skyline, glowing window/sign lines, matches the runner's palette | AI-generated (explicitly prompt "seamless tiling texture, edges match on all sides") |
| SFX | `assets/jump.wav` | under 0.3s | short crisp synth blip, rising pitch | generated |
| AUDIO | `assets/bgm-loop.ogg` | 45-60s seamless loop, ~128bpm | driving synthwave, upbeat, loopable | OpenGameArt.org (check per-file license) or generated |

Swap procedure once a final asset exists (full version in the pipeline doc, Section 5): generate/source the asset at the exact `spec` above, save it at the exact `path` above so no code needs to change, load it in `preload()` (`this.load.spritesheet('player-run', 'assets/player-run.png', { frameWidth: 64, frameHeight: 64 })` for the runner, `this.load.image(...)` for static sprites, `this.load.audio(...)` for sound), then replace the `this.add.rectangle(...)` calls with `this.add.sprite(...)`/`this.physics.add.sprite(...)` using the loaded key, and play `jump.wav` in `tryJump()` and loop `bgm-loop.ogg` in `create()`. Swap and re-test one asset at a time, not all five at once — an animation frame count or a mis-set `frameWidth` is far easier to spot right after that one swap than after the whole batch.

**Checkpoint:** the game still runs exactly as before — this phase only produces the spec sheet and (optionally) the first real asset swapped in; nothing in the loop's behavior changes.

---

## Phase 4 — CrazyGames SDK integration

Per [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md) Section 2 and Section 6: **do not add your own AdMob or any other ad SDK to this build.** CrazyGames (and Poki, and GameDistribution) are ad-revenue-share portals — the portal owns the ad inventory and pays you a share of what it sells; a second ad SDK competing with the portal's own is a policy violation and a fast way to get rejected or pulled after going live.

Load the SDK script in `game/index.html`, before your module script tag:

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

Add a small portal wrapper — `game/src/portal.js` — that works whether or not the SDK is actually present, so local dev never breaks:

```javascript
// game/src/portal.js
const sdk = typeof window !== 'undefined' ? window.CrazyGames?.SDK : undefined;

export async function initPortal() {
  if (!sdk) {
    console.log('[portal-stub] CrazyGames SDK not present (local dev) — calls will log instead of firing.');
    return false;
  }
  await sdk.init();
  console.log('[portal] CrazyGames SDK initialized.');
  return true;
}

export function gameplayStart() {
  if (sdk) sdk.game.gameplayStart();
  else console.log('[portal-stub] gameplayStart()');
}

export function gameplayStop() {
  if (sdk) sdk.game.gameplayStop();
  else console.log('[portal-stub] gameplayStop()');
}

export function requestMidgameAd(onFinish) {
  if (sdk) {
    sdk.ad.requestAd('midgame', { adFinished: onFinish, adError: onFinish });
  } else {
    console.log('[portal-stub] requestMidgameAd() — no SDK present, continuing immediately.');
    onFinish();
  }
}
```

Wire it into the scene: call `initPortal()` and `gameplayStart()` once when the run begins, `gameplayStop()` the instant the player dies, and `requestMidgameAd()` on the game-over screen — never mid-run, per the portal's "don't interrupt active play" rule.

```javascript
// at the top of main.js
import { initPortal, gameplayStart, gameplayStop, requestMidgameAd } from './portal.js';

// inside create(), after the rest of the setup
initPortal().then(() => gameplayStart());

// inside hitObstacle(), right after isDead = true and this.physics.pause()
gameplayStop();
requestMidgameAd(() => {
  // ad finished (or was skipped/stubbed) — safe to show the restart prompt now
});
```

Run `npm run dev` and die once. With no portal present, the console should log, in order: `[portal-stub] CrazyGames SDK not present...`, `[portal-stub] gameplayStart()`, `[portal-stub] gameplayStop()`, `[portal-stub] requestMidgameAd()...` — the exact call sequence CrazyGames' real SDK expects, just logged instead of fired.

**Checkpoint:** the portal calls fire in the right order with no thrown errors — either for real (if you test inside CrazyGames' own dev harness) or as stub console logs during local dev.

---

## Phase 5 — HTML5 build

Build the production bundle:

```bash
npm run build
```

Expected output: a `game/dist/` folder containing `index.html`, a hashed JS bundle, and your assets.

Zip it — the zip must have `index.html` at its root, not nested one folder deep (see the portals doc, Section 1, step 5, for why this matters on itch specifically):

```bash
cd dist
# Windows PowerShell:
Compress-Archive -Path * -DestinationPath ../neon-runner-web.zip
cd ..
```

Test the built zip from a real static server before uploading anywhere — opening `dist/index.html` directly as a `file://` URL is not the same environment a portal or itch serves from, and some browsers block module scripts entirely under `file://`:

```bash
npx serve dist
```

Expected output: a local URL (e.g. `http://localhost:3000`) serving the built `dist/` folder. Open it and play a full run through — jump, die, restart — exactly as it will run once embedded elsewhere.

**Checkpoint:** the built zip, served from a static server (not opened as a local file), runs and plays identically to the dev version — auto-run, jump, obstacles, ramp, death/restart, portal calls logging cleanly.

---

## Ship-it challenge

Upload `neon-runner-web.zip` to itch.io as a browser-playable HTML5 game (Kind of project: **HTML**, check "This file will be played in the browser", set viewport to 800×400), then submit the same build to CrazyGames or GameDistribution through their developer dashboard, following the account/upload/review steps in [`../reference/platform-web-portals.md`](../reference/platform-web-portals.md).

**Acceptance:** the game is playable on itch.io directly in the browser (no download prompt), and it has been submitted to at least one portal's developer dashboard for review.

---

## Break-fix drills

Solve each of these by diagnosing the actual cause, not by guessing at a fix. No solutions given inline — expand the hint only after you've tried.

### Drill 1 — runs in dev but blank in the itch iframe

Setup: build and zip exactly as in Phase 5, upload to itch.io as an HTML embed, and load the itch project page.

Expected symptom: the game runs perfectly under `npm run dev` and even under `npx serve dist` locally, but the itch page shows a blank frame where the game should be, with errors in the browser console pointing at failed asset/script loads.

<details>
<summary>Hint</summary>

Open the built `dist/index.html` in a text editor and look at how the script and asset tags reference their files — by default, Vite emits absolute paths (starting with `/`) rooted at your site's domain. That's correct for a build served from your own domain's root, but itch serves your game's files from a path nested under itch's own CDN, not from `/`. An absolute path that worked under `npx serve dist` (which happens to serve from its own root too) silently 404s once the exact same files sit under a different, nested path. The fix lives in `game/vite.config.js` (create it if it doesn't exist) — set the build's `base` to a relative value so every emitted path is relative to wherever `index.html` itself ends up, then rebuild and re-zip. Confirm by testing the new build wrapped in a local `<iframe>` at a nested path before re-uploading, per the portals doc Section 7 point 4.
</details>

### Drill 2 — portal rejects the submission

Setup: submit the built zip to CrazyGames (or GameDistribution) and read the review feedback.

Expected symptom: the submission is bounced with feedback citing either a policy violation around ads, or missing required SDK calls.

<details>
<summary>Hint</summary>

There are two distinct failure modes hiding under this one symptom, and the fix differs completely depending on which one you actually have. Re-read `../reference/platform-web-portals.md` Section 6 (the own-ads rule) and Section 2 (CrazyGames' QA checklist) side by side against your build: first, grep your own source for any ad-network script or SDK you might have added yourself (AdMob, or anything besides the portal's own SDK loaded in Phase 4) — if you find one, remove it entirely, the portal's ad calls are the only ads allowed in this build. Second, independently check the console log sequence from Phase 4's checkpoint against what the portal's QA checklist actually requires — init before anything else renders, `gameplayStart`/`gameplayStop` firing around the real play session (not just once at load), and an ad call at a natural break rather than mid-run or immediately on load. Fix whichever of the two is actually present in your build, then resubmit.
</details>

### Drill 3 — mobile touch doesn't jump

Setup: open the running game on an actual phone, or resize a desktop browser to a narrow mobile-width viewport and switch to its touch-emulation mode, and try to jump.

Expected symptom: keyboard space bar jumps fine on desktop; tapping the screen on mobile does nothing.

<details>
<summary>Hint</summary>

Look back at the input wiring from Phase 1's `create()` — `tryJump` is attached to two listeners, but check whether both are actually reachable on a touch device the way they were written, and whether anything else on the page (the itch/portal frame chrome, a wrapping `<div>`, default touch behavior like scroll/zoom) could be intercepting the tap before Phaser's input system sees it. Compare against the portals doc Section 7 point 3 on mobile support, and check Phaser's own input config for whether touch needs to be explicitly enabled or whether a CSS/viewport setting on the page itself (not the game canvas) is swallowing the tap first. The fix is making sure a real touch event reaches the same `tryJump` handler keyboard input already uses — not writing a second, separate jump function for touch.
</details>

---

## Done when

- [ ] `npm run dev` boots a blank Phaser canvas at localhost (Phase 0)
- [ ] Auto-run, jump-to-dodge, procedural obstacle spawning, and a live distance score all work (Phase 1)
- [ ] Run speed ramps up with survival time, and death shows a working GAME OVER + restart screen (Phase 2)
- [ ] Asset spec sheet is filled in and at least the placeholder-to-final swap procedure has been run once (Phase 3)
- [ ] CrazyGames SDK calls (init, gameplayStart/gameplayStop, ad request) fire in order with no errors, real or stubbed (Phase 4)
- [ ] `npm run build` produces a `dist/` folder, zipped with `index.html` at the zip root, verified running from a static server (Phase 5)
- [ ] All 3 break-fix drills solved by diagnosis before opening the hints
- [ ] Build uploaded to itch.io as an HTML embed and submitted to at least one portal (CrazyGames or GameDistribution)
- [ ] Game is live on itch.io
