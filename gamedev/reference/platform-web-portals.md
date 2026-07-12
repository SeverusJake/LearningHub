# Web Portals Reference: itch.io, CrazyGames, Poki, GameDistribution

This doc covers the parts of publishing an HTML5 game that only you can do: creating accounts, uploading builds, wiring in a portal's ad SDK, and understanding how you get paid. It applies to games 02 (Neon Runner), 04 (Word Bloom), and 07 (Idle Miner Co) — all three ship as HTML5 builds and target one or more of these destinations. AI writes the game code and the SDK integration code; you create the accounts, run the actual uploads, and click submit/publish.

Read the whole doc once before you touch game 02. The four platforms differ enough (open-signup vs. application-gated, ad-revenue-share vs. storefront-sale) that skimming leads to wasted submissions.

## 1. itch.io

itch.io is the fastest path to a published, buyable game in this entire track. No review queue, no application, free to list.

1. Go to itch.io and create a free account (email + username + password). No developer fee, no identity verification required to publish a free or PWYW game.
2. Once logged in, go to your dashboard and click "Create new project."
3. Fill out the project page: title, short description, cover image, genre/tags, screenshots. This is your store page — treat it like a mini landing page, since it's what convinces someone to click play.
4. Set "Kind of project" to **HTML** (not "Downloadable" — HTML is what triggers itch's in-browser player).
5. Build your upload as a **zip file with `index.html` at the root** of the zip — not nested inside a subfolder. If `index.html` is one directory level deep, itch's browser player won't find it and the game won't launch. Verify this by unzipping the file yourself and confirming `index.html` sits next to (not inside) the other assets.
6. Upload the zip in the Uploads section of the edit page.
7. Check the box **"This file will be played in the browser"** next to that upload. This is the single most-missed step — without it, itch treats the zip as a downloadable file instead of an embedded game, and visitors get a download prompt instead of a play button.
8. Set the **viewport dimensions** (width/height in pixels) to match your game's canvas resolution. itch also gives you options for "Fullscreen button," "Mobile friendly" (enables touch-friendly scaling on phones), and "Automatically start on page load" — turn on Mobile friendly if your game supports touch input, since portal and itch traffic both include a large mobile share.
9. Set pricing under "Pricing" — choose one:
   - **Free** — no price, anyone can play instantly.
   - **Paid** — a fixed price; players must pay before they get access to the page/download.
   - **$0 or donate (pay-what-you-want / PWYW)** — visitors can play for free, but a payment box is presented and they can optionally pay any amount, including a suggested minimum you can set. This is the itch-native default for casual/experimental games and is what game 04 (Word Bloom) uses.
10. Publish the page. It's live immediately — no review, no waiting period.
11. **How the embed works:** itch serves your zip's contents from its own CDN inside an iframe sized to the viewport dimensions you set. Players never leave itch.io; the game runs client-side in their browser exactly like any other web page. If your game references assets with absolute paths or expects to run from a specific domain, it will break inside this iframe — see Section 7 for the fix.
12. **Getting paid:** in your itch.io account settings, under Payments, connect **PayPal or Stripe**. itch.io pays you directly through whichever processor you connect — itch never touches your money as an intermediary holding balance beyond the transaction. There is no minimum payout threshold; funds flow to your connected account as sales/donations happen (Stripe payouts follow Stripe's own payout schedule, e.g. rolling or daily/weekly depending on your account).
13. **Revenue split:** itch.io does not force a cut. When you set a price or enable PWYW, you also see a slider for "amount going to itch.io" — this defaults to a suggested 10% but you can set it anywhere from 0% to 100%. Setting it to 0% means itch takes nothing and you keep the entire sale price (minus your payment processor's own transaction fees, which are separate from itch and set by PayPal/Stripe, not itch).

itch.io is the one platform in this section that behaves like a storefront, not an ad-revenue portal — see Section 6 for why that distinction matters for what you're allowed to put in the build.

## 2. CrazyGames

CrazyGames is an open-signup ad-revenue-share portal — no application, no portfolio review to start, but every submission goes through a QA and content review before it goes live.

1. Create a free account at the CrazyGames developer portal (developer.crazygames.com).
2. Integrate the **CrazyGames SDK** into your build before you submit — this is not optional, submissions without it are rejected. The SDK is a JavaScript library you load in your HTML page. At minimum your game must:
   - Call the SDK's **init** function once on load, and wait for it to resolve before showing your own UI.
   - Call **ad request functions at appropriate moments** — a midroll/interstitial ad between levels or on game-over/retry, and optionally a rewarded-video call for an in-game bonus (extra life, double coins, etc.). Never call an ad function during active gameplay or immediately on load with no context — CrazyGames' review rejects ad placements that interrupt play or ambush the player.
   - Fire the **gameplay start and gameplay stop events** the SDK expects (`gameplayStart()` / `gameplayStop()` or equivalent) — CrazyGames uses these to know when it's safe to show an ad and when not to, and also for its own analytics on session length. Missing these is one of the most common rejection reasons.
   - Call the SDK's loading-progress and loaded events so CrazyGames' own loading screen can hand off cleanly to your game.
3. Before submitting, run through CrazyGames' **QA requirements checklist** yourself — reviewers check for exactly these:
   - Game loads and is playable with no console errors.
   - No links out to other websites, app stores, or your own domain anywhere in the UI (this includes "more games" buttons pointing off-platform).
   - No mention of other platforms/portals inside the game.
   - Runs correctly inside an iframe at the aspect ratio you declared.
   - No copyrighted/trademarked content you don't own the rights to.
   - Reasonable load time and file size (see Section 7).
   - Works with mouse/keyboard and touch if you declared mobile support.
   - No separate ad SDK of your own bundled in (see Section 6) — CrazyGames' ad calls are the only ads allowed.
4. Submit through the developer dashboard. **Review** is manual — expect it to take from a few days up to a few weeks depending on queue volume; you'll get feedback in the dashboard if something needs fixing before approval.
5. Once approved, the game goes live on crazygames.com and CrazyGames may also syndicate it to other sites in its own distribution network.
6. **Revenue share:** CrazyGames pays a majority share of ad revenue back to the developer (their published developer materials describe a competitive/majority split) — treat any specific percentage as **varies — check current terms** on their developer site, since ad-network splits get renegotiated over time.
7. **Payout:** PayPal is the standard payout method, paid out monthly once you clear their minimum payout threshold. Confirm the current threshold amount in your developer dashboard before you rely on a specific figure — **varies — check current terms**.

## 3. Poki

Be honest with yourself about Poki before you plan around it: it is **not open signup**. You apply, and Poki reviews your game/portfolio before deciding whether to work with you at all.

1. Go to Poki for Developers and submit an application — this typically asks for a game to review (a finished or near-finished build) plus basic studio/developer information. There is no guaranteed acceptance; Poki is selective about the quality bar and genre fit for its audience.
2. If accepted, you get access to Poki's developer portal and upload tooling, and from there the process resembles the other portals: upload your HTML5 build, integrate their SDK, pass review, go live.
3. Integrate the **Poki SDK** (`PokiSDK`) in your build:
   - Call `PokiSDK.init()` and wait for the returned promise before doing anything else.
   - Wrap ad opportunities in `PokiSDK.commercialBreak()` calls at natural breaks (level start, game-over, retry) — this is Poki's equivalent of an interstitial call and it handles whether an ad actually shows.
   - Call `PokiSDK.gameLoadingFinished()` once your asset loading is done, and `PokiSDK.gameplayStart()` / `PokiSDK.gameplayStop()` around actual play sessions, same purpose as CrazyGames' equivalents — Poki uses these to decide safe ad timing and to measure engagement.
   - Optionally call a rewarded-ad function for player-opt-in bonuses.
4. Test against the **Poki Inspector** before submitting anything — this is Poki's own testing tool (a hosted page you load your build into, or a local dev harness depending on current tooling) that simulates the Poki environment and shows you exactly what SDK calls your game is firing, in what order, with what timing. Reviewers expect you to have already caught SDK misuse yourself using this tool; showing up with an untested integration is a common rejection reason.
5. Submit for review once Inspector shows a clean integration. Poki's review looks at both technical SDK correctness and overall game quality/polish — this is a higher bar than CrazyGames' more mechanical QA checklist, consistent with Poki being curation-gated from the start.
6. **Revenue share:** Poki does not publish a single fixed public percentage the way some competitors imply — treat the exact split as **varies — check current terms** and get the number directly from your Poki developer agreement once accepted, rather than trusting any third-party figure.

Because Poki is application-gated, don't build game 02's launch plan around Poki being your day-one destination — treat CrazyGames and GameDistribution as your open-signup path, and submit to Poki as a bonus attempt in parallel.

## 4. GameDistribution

GameDistribution (owned by Azerion) is open signup and is built around one core idea: upload once, get distributed to many.

1. Create a free publisher account at gamedistribution.com.
2. Go through the publisher onboarding — this includes basic identity/payment details so they can pay you later, but does not gate whether you can start uploading games.
3. Upload your HTML5 build (zip, similar constraints to the other portals: correct entry point, reasonable size — see Section 7).
4. Integrate the **GameDistribution SDK** (`gdsdk`):
   - Load the SDK script and configure it with your game ID from the dashboard.
   - Call the SDK's init with callbacks for `onEvent` handling ad-related events (`SDK_READY`, `SDK_GAME_START`, `SDK_GAME_PAUSE`, ad-shown/ad-finished events, etc.).
   - Trigger the pause/resume events around actual gameplay so ads are only shown between sessions or at natural breaks, matching the same "don't interrupt active play" rule every portal enforces.
5. Submit for review through the dashboard.
6. **How syndication works:** this is GameDistribution's distinguishing feature — once your game is approved, it isn't just live on gamedistribution.com. GameDistribution licenses/syndicates the same build out to a large network of partner websites and portals that embed GameDistribution's catalog on their own pages. You upload one build one time; GameDistribution's own distribution deals do the work of getting it onto many third-party sites, each of which may run its own ad inventory around your embedded game.
7. **Revenue share:** GameDistribution pays a revenue share on the ad impressions served against your game across its syndicated network — the exact split is set in your publisher agreement and can change; treat the number as **varies — check current terms** rather than assuming a fixed percentage.
8. **Payout:** PayPal (and in some regions bank transfer) once you hit their minimum payout threshold, generally paid on a monthly cycle with a payment delay (NET-30-style) after the earning month closes. Confirm the current minimum threshold in your publisher dashboard — **varies — check current terms**.

## 5. Comparison table

| Portal | Open signup? | SDK required | Revenue model | Payout method | Payout threshold |
|---|---|---|---|---|---|
| itch.io | Yes, instant, no review | No | Direct sale (paid/PWYW) or free; you set the itch cut (0-100%, suggested 10%) | PayPal or Stripe, paid directly to you | None — funds flow as sales/donations happen (subject to your processor's own payout schedule) |
| CrazyGames | Yes, but every build goes through manual QA/content review | Yes — CrazyGames SDK (init, ad calls, gameplay start/stop events) | Ad revenue-share, majority to developer | PayPal | Varies — check current terms |
| Poki | No — application/portfolio-gated | Yes — Poki SDK (`PokiSDK.init`, `commercialBreak`, gameplay events), test via Poki Inspector before submitting | Ad revenue-share | Varies — check current terms | Varies — check current terms |
| GameDistribution | Yes, instant onboarding, builds still reviewed | Yes — GameDistribution SDK (`gdsdk`, event-driven ad calls) | Ad revenue-share across syndicated partner network | PayPal (bank transfer in some regions) | Varies — check current terms |

## 6. The own-ads rule (critical — a common rejection cause)

This is the single rule most likely to get a submission bounced, so treat it as a hard constraint, not a suggestion.

**Do not put your own ad SDK — AdMob, or any other ad network you integrate yourself — into a game headed for CrazyGames, Poki, or GameDistribution.** These are ad-revenue-share portals: the portal itself owns the ad inventory around and inside your game, sells that inventory to advertisers, and pays you a share of what it earns. Your job is to call the portal's SDK at the right moments (interstitial/rewarded calls) and let the portal decide what ad actually renders. If your build also tries to serve ads through your own network on top of that, you are competing with the portal's own monetization inside a page it doesn't fully control — every one of these portals treats that as a policy violation, and it's one of the fastest ways to get a submission rejected or a live game pulled.

**itch.io is different, and this is the key distinction to hold onto:** itch.io is a storefront, not an ad-mediated portal. There is no portal ad SDK on itch, no ad revenue-share, and no rule against you monetizing the game however you choose (including your own ads, if you wanted to, though none of the games in this track do that on itch — they use paid/PWYW pricing instead). On itch, you are selling or giving away a product directly to the player; on CrazyGames/Poki/GameDistribution, you are a content supplier inside someone else's ad-funded storefront.

Practical rule of thumb for this track: the same HTML5 build you submit to itch.io can carry pricing but must not carry any ad code; the build variant you submit to a web portal must carry that portal's ad SDK and only that portal's ad SDK. If a game targets both (game 04 ships to itch.io and web portals), you'll likely maintain two small build configs — one itch-only export with no ad SDK, one portal export with the required portal SDK wired in — rather than one universal build trying to serve both roles at once.

## 7. HTML5 export notes

Shared gotchas across the Phaser 3 (game 02), Construct 3 (game 04), and PixiJS (game 07) builds — check these before every submission, not just the first one.

1. **Use relative asset paths, not absolute ones.** Every image, audio file, and JSON/atlas reference in your build should be a relative path (`assets/player.png`, not `/assets/player.png` or `https://yourdomain.com/assets/player.png`). Portals load your game inside an iframe served from their own domain, not yours — an absolute path pointing at your original dev URL will 404 the moment it's embedded elsewhere, even though it worked fine when you tested it locally. This is the single most common "works on my machine, breaks on the portal" bug.
2. **Keep the build small.** Portals and itch both care about load time — a slow first load loses players before they ever click play, and some portals set explicit size limits or flag oversized submissions during review. Compress textures, use audio formats/bitrates appropriate for the web (compressed OGG/MP3 rather than uncompressed WAV for music), and strip any unused assets, debug logging, or dev-only libraries from the shipped zip. Check your engine's production/release export option specifically — dev exports are usually larger and include things you don't want in a submission.
3. **Support mobile touch input, not just mouse/keyboard.** A large share of portal and itch traffic is mobile. Make sure your control scheme has a touch equivalent (tap/drag/swipe mapped to whatever mouse/keyboard actions you built first), and that UI elements are large enough to hit reliably on a phone screen. If you enabled itch's "Mobile friendly" viewport option or declared mobile support to a portal, actually test on a phone-sized viewport before you rely on that claim.
4. **Test inside an actual iframe before you submit anywhere.** Don't trust a build that only ever ran as a standalone local file or full-page dev server — wrap your built `index.html` in a minimal local test page with an `<iframe>` at the same pixel dimensions you plan to declare, and play through the whole game inside that iframe. This surfaces the relative-path bug from point 1, any CSS/layout assumptions that only hold at full-page width, and any JavaScript that assumes it's the top-level window (e.g., code that reads `window.top` or tries to resize the outer browser window, both of which behave differently or get blocked inside a cross-origin iframe on a real portal).
