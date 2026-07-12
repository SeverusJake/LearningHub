# Monetization & Ads (Reference)

This is the shared ad-monetization manual for the mobile game GUIDEs in this track (01, 03, 05, 06, 07). Each GUIDE's own instructions cover the actual integration code for its engine and genre; this doc covers the concepts, account setup, and rules that don't change from game to game, so they aren't repeated five times. If you're advanced in IT generally but new to ad monetization specifically, read this once before starting any of those GUIDEs.

## 1. Ad models

| Ad type | Best-fit genre | Placement rules |
|---|---|---|
| Banner | Idle/incremental, hyper-casual, puzzle — anything with a persistent screen (menu, board, main HUD) | Low value per impression but passive — it sits on screen and earns without interrupting play. Dock it at the top or bottom edge, never over tappable gameplay elements or buttons. Never stack a banner where a mis-tap sends the player into the ad instead of the game. |
| Interstitial | Endless runners, arcade, level-based puzzers, casual action | Show **between** natural breaks — after a level ends, on a game-over screen, on return-to-menu, between sessions. Never mid-gameplay: don't fire one while the player is mid-run, mid-level, or mid-input. An interstitial that interrupts active play reads as a bug and tanks retention, not just annoys. Cap frequency (e.g., one per N level completions or one per M minutes) so it doesn't fire on every single transition. |
| Rewarded video | Idle/incremental, roguelike, puzzle-with-hints, any game with lives/currency/continues | Always opt-in, never forced. The player taps a button for a concrete, named benefit — extra life, double currency, a continue, a hint, a speed-up — and only then sees the ad. This format pays the most per view of the three because the player is voluntarily engaged and watching to completion. Never auto-play a rewarded ad and never make core progression impossible without it — it's a bonus lane, not a toll gate. |

The three formats aren't interchangeable defaults — pick the one that matches how the player is actually using the screen at that moment, not just "whichever this SDK example uses."

## 2. AdMob (mobile)

AdMob is Google's ad network and the default choice for both Godot and Unity mobile exports. Setup path, in order:

1. **Create an AdMob account** at admob.google.com, signed in with the same Google account you use for Play Console.
2. **Link it to your Play Console app.** AdMob will ask you to either link an existing published (or in-progress) Play listing or register a new app record — do this even before the game is live, since ad units need an app ID to attach to.
3. **Create ad units** inside that AdMob app — one ad unit per placement type you're using (e.g., a Banner unit for the HUD, an Interstitial unit for level-end, a Rewarded unit for continues). Each ad format needs its own ad unit, not one shared unit reused everywhere.
4. **Copy the ad unit IDs** (format `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`) into your project's ad config. This is the ID your code requests ads against.

**ALWAYS use Google's public test ad unit IDs while developing and testing — never your real ad unit IDs until you're building a release candidate.** Requesting real ads from a dev build risks Google flagging your account for invalid traffic (your own repeated test impressions look like click fraud from the network's side), which can get an AdMob account suspended. The well-known Android test IDs, safe to hardcode during development:

| Format | Android test ad unit ID |
|---|---|
| Banner | `ca-app-pub-3940256099942544/6300978111` |
| Interstitial | `ca-app-pub-3940256099942544/1033173712` |
| Rewarded video | `ca-app-pub-3940256099942544/5224354917` |

Swap these for your real ad unit IDs only in the build you're actually submitting for release — keep them behind a debug/release flag rather than hand-editing them before every test run, so a real ID never accidentally ships in a debug build (and vice versa).

**Godot path:** Godot has no first-party ad SDK, so mobile ads go through a community AdMob plugin (available via the Godot Asset Library, packaged as an Android plugin/AAR). The outline: install the plugin into your project, rebuild your Android export template with the plugin enabled (Godot's custom Android build), add your AdMob App ID to the Android export preset, then call the plugin's load/show methods for each ad format from GDScript once the SDK reports it's initialized. The GUIDEs that use Godot walk through the exact plugin and code.

**Unity path:** Unity projects use Google's own **Google Mobile Ads Unity SDK** (referred to as GMA), imported as a package. The outline: import the SDK via Package Manager or the `.unitypackage`, set your AdMob App ID under the plugin's settings menu, call `MobileAds.Initialize()` once at app start, then construct a banner/interstitial/rewarded ad object per format, request it with the ad unit ID, and handle its load/show callbacks. The GUIDEs that use Unity walk through the exact calls.

## 3. Mediation

Mediation means you don't rely on a single ad network to fill every ad slot — you plug in several networks (AdMob, Meta Audience Network, AppLovin, Vungle, and others) behind one SDK, and they compete for each impression. Whichever network's bid or waterfall position wins actually serves that ad. The payoff is twofold: fill rate goes up (if one network has no ad to serve, the next one in line does), and average eCPM goes up (real competition between networks bids the price of an impression higher than any single network alone would pay).

The two common ways to get this: AdMob's own built-in mediation groups (simplest, stays inside the AdMob dashboard), or Unity's **LevelPlay** (the mediation platform that grew out of ironSource, now Unity-owned) — a dedicated mediation layer that plugs into Unity projects and manages the network waterfall/bidding for you.

Setup outline for LevelPlay: create a LevelPlay account and app entry, add the ad network SDKs you want in the mix (each has its own SDK key to register), build a mediation "instance" per ad format per network, arrange them in a waterfall (or enable bidding where the network supports it), and verify with LevelPlay's test suite before going live. Game 05 in this track uses LevelPlay mediation — see that GUIDE for the concrete setup.

## 4. Consent + privacy

- **GDPR (EU/EEA/UK users):** you're legally required to get consent before serving personalized ads to users in these regions. Google requires you to use its **UMP SDK (User Messaging Platform)** to show a consent form — it checks the user's region, displays the appropriate consent message, and reports the consent choice back to the ad SDK so it knows whether to request personalized or non-personalized ads for that user. Wire this in before you request your first ad, not after.
- **Apple ATT (iOS):** if you ship on iOS, Apple's App Tracking Transparency requires a system permission prompt before you can access the device's ad identifier (IDFA) for personalized/cross-app tracking. If the user declines, you still show ads — just non-personalized ones for that user.
- **COPPA / "designed for families" (kid-directed apps):** if your app is directed at children, you tag it as such in both Play Console's "Designed for Families" program and in your AdMob ad requests (tagging the ad request as child-directed / under the age of consent). This is not optional labeling — get the audience wrong and you're in violation of child-privacy law, not just an ad policy. The direct consequence: a child-directed tag forces non-personalized, contextual-only ads for that traffic — no behavioral targeting, no device-level ad ID use — which measurably lowers eCPM compared to personalized ads on the same impressions. That's the tradeoff, not a bug: it's the price of legally serving ads to kids.

## 5. Ad content rating

Set your ad content rating in the AdMob dashboard (under app settings) to match your actual app content rating from Play Console — options run from "General audiences" up through "Mature audiences." This controls what ad creatives Google is allowed to serve inside your app: a rating that's stricter than your real audience needlessly excludes advertisers and lowers fill; a rating that's looser than your real audience risks a mature ad creative showing up inside a game rated for children, which is a policy problem you own regardless of it being a third party's ad. Set it once, deliberately, rather than leaving it on whatever default AdMob picked.

## 6. Web-portal ads

If you're shipping to a web game portal (itch.io, CrazyGames, Poki, and similar) rather than — or in addition to — a mobile store, do **not** add your own AdMob/mediation SDK to that build. The portal itself serves the ads around and inside your game and pays you a revenue share from what it collects; adding your own ad SDK on top doesn't add income, it just conflicts with the portal's own ad slots and can get a submission rejected outright. See `platform-web-portals.md` for how portal revenue share actually works and what the portal expects from your build instead.

## 7. IAP

Ads are this track's primary monetization model, but a small in-app-purchase layer commonly sits alongside them: a handful of **consumables** (extra currency, a specific power-up, a cosmetic) and a one-time **"remove ads"** purchase for players who'd rather pay once than watch rewarded/interstitial ads. Treat IAP as a secondary lane you bolt on once ads are working, not a replacement for them — for the genres these GUIDEs cover, ad revenue from volume is doing most of the work, and IAP is topping it up.

## 8. Realistic revenue

Be honest with yourself about the numbers here: mobile ad revenue lives in cents-per-install territory, not dollars-per-install. A single install is worth very little on its own — what actually produces income is volume (enough installs that small numbers add up) and retention (players who keep opening the app keep generating impressions, instead of one install producing one ad view and disappearing forever). eCPM (revenue per thousand impressions) swings wildly by geography and ad format — a US or Western European impression can be worth many times a impression from a lower-ad-spend region, and within any one region rewarded video consistently pays more per impression than interstitial, which in turn pays more than banner. None of this is guaranteed: eCPMs drift with the ad market, fill rates vary by network and season, and a game with weak retention will underperform a game with mediocre installs but players who stick around. Plan around ranges and real usage data from your own game, not a single headline number someone else quoted you.
