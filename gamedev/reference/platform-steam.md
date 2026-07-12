# Reference — Steam

This is the shared Steam-publishing manual for every game in this track that touches Steam: game 06 ships a free Steam demo alongside its itch.io release, games 08 and 09 get a real Steam store page, and game 10 is this track's one full paid Steam release. Everything below is the part of Steam publishing that only you can do — Valve requires a real human, a real bank account, and a real signature behind every app, so none of it delegates to AI. Read this in full before you start game 08: the account and app-creation steps (sections 1-2) take the longest calendar time of anything in this doc, since tax/bank verification and the 30-day store-page rule both run on Valve's clock, not yours.

If you're advanced in IT but new to game publishing specifically, the mental model that matters most: Steam separates **the app** (an AppID, a permanent record Valve tracks everything against), **the build** (the actual game files, pushed via a tool called SteamPipe), and **the store page** (the public listing shoppers see). You will touch all three, and they move independently — you can have an AppID with no store page yet, a store page with no build uploaded, or a build uploaded that isn't the one live on the store page.

## 1. Steamworks account + Steam Direct fee

1. Go to `partner.steamgames.com` and sign in with the Steam account you want to operate as your publisher identity. If you don't already have one you're comfortable tying to a business/tax record, create a fresh Steam account at `store.steampowered.com` first — don't repurpose a personal gaming account you'd rather keep separate.
2. Click through to Steamworks registration and enter your real legal identity: legal name (or company name if you're incorporating), country, address, and phone number. This is the identity Valve pays and taxes against, so use your actual legal details, not a studio nickname.
3. Accept the Steamworks Distribution Agreement. This is the digital-signature step Valve requires once per partner account before you can create any app — you tick/sign electronically inside the Steamworks site, no physical paperwork.
4. Complete the tax interview under your Steamworks account settings (Steamworks shows this as an outstanding item on first login if you skip it). Steam routes US sales tax withholding through this form, same idea as Amazon/Google's contributor tax forms:
   - US persons or US-registered entities fill a **W-9**.
   - Everyone outside the US filing as an individual fills a **W-8BEN**.
   - Non-US entities (a foreign-registered company, not an individual) fill a **W-8BEN-E** instead.
   Get this wrong or leave it incomplete and Valve withholds tax at the default (higher) rate on your sales until it's fixed.
5. Enter payout banking details in the same account settings — domestic account/routing number, or IBAN + SWIFT/BIC if you're outside the US. Valve pays out to exactly this account once it's verified; there's no cash/PayPal option.
6. Start a **Steam Direct** application for your specific game and pay the fee: **$100 USD, per title**, charged at this step (not once per partner account — every AppID you ever create costs another $100). This fee is recoupable: once that specific title's gross sales on Steam reach **$1,000**, Valve credits the $100 back to your payout balance. Don't plan around getting it back — some titles never clear $1,000.
7. **The 30-day rule:** your store page has to be visible to the public for at least 30 days before the game can go on sale. This isn't a formality to skip — it's the single biggest lever behind section 5 (wishlists), because a page with no runway before launch collects near-zero wishlists and gets close to zero algorithmic push on launch day. Work backwards from your intended release date and get the store page live at least a month ahead of it.

## 2. Create an app

1. Once the Steam Direct fee for a specific game clears, Steamworks gives you a form to name the app (a working title is fine — you can rename the store-facing title later, before release) and submit it.
2. Valve issues an **AppID** immediately on submission — a permanent integer, for example `480` (Valve's own public test app, Spacewar). Write this number down: every tool from here on references your game by this ID — SteamPipe uploads, the Steamworks SDK's init call, achievements, depots, everything.
3. The AppID is a container, not a listing. Three things hang off it, and they're independent:
   - **The app record itself** — metadata, the AppID, your build history, your depot configuration.
   - **The store page** — the public-facing listing (title, description, screenshots, price, tags) that shoppers actually see. It can be set to "unlisted"/coming-soon or fully public independent of whether a build exists.
   - **The build** — the actual game files. You can upload a build with no public store page at all (useful for internal QA before you're ready to be seen), and you can have a live, public "Coming Soon" store page with zero builds uploaded yet.
4. Practical order for this track: create the app and get the AppID early, upload an internal build as soon as you have anything playable (section 3), and only flip the store page public once you have the assets in section 4 ready — a store page can go live before a build does, but don't publish a bare page with no assets; it just burns your 30-day clock producing a weak page.

## 3. SteamPipe build upload

Steam doesn't take a file upload through a web form — it uses a system called **SteamPipe**, driven by a command-line tool called **ContentBuilder** (bundled inside `steamcmd`, Valve's scriptable Steam client). The mental model: you describe your build in a small text config, point ContentBuilder at your build's output folder, and it uploads and registers that folder as a new build of your app.

1. Download `steamcmd` from Steamworks (Steamworks → your app → SteamPipe → Builds has the link, or grab it directly from Valve's SteamPipe documentation page). On Windows this unpacks to a folder containing `steamcmd.exe`.
2. Create a small scripts folder next to your build output, containing two VDF (Valve Data Format — just a nested key-value text format) files: an **app build script** and a **depot build script**.

A **depot** is simply a named bucket of files — usually one depot per platform (Windows/Mac/Linux) or one depot for a language pack or DLC. For a single-platform Windows release, one depot is enough. This minimal depot script maps your entire build-output folder into that depot:

```
"DepotBuildConfig"
{
	"DepotID"		"1000001"
	"contentroot"	"..\build\win64\"
	"FileMapping"
	{
		"LocalPath"		"*"
		"DepotPath"		"."
		"recursive"		"1"
	}
	"FileExclusion" "*.pdb"
}
```

The app build script ties one or more depots together into a single build of the app, and optionally marks that build "live" on a branch immediately:

```
"appbuild"
{
	"appid"			"1000000"
	"desc"			"Build 1 - internal QA"
	"buildoutput"	"..\output\"
	"contentroot"	"..\build\win64\"
	"setlive"		""
	"preview"		"0"

	"depots"
	{
		"1000001"	"depot_build_1000001.vdf"
	}
}
```

Notes on the fields that trip people up:
- `appid` and the depot ID under `"depots"` come from Steamworks — every depot you create in Steamworks → SteamPipe → Depots gets its own ID, separate from the app's own AppID.
- `"setlive" ""` means "don't flip any branch live" — safest for a first upload. Set it to `"default"` once you're ready for this build to be what buyers actually download, or to a beta branch name (e.g. `"beta"`) to push to testers only.
- `"preview" "1"` runs the whole process without actually uploading anything, so you can catch a broken VDF path before you burn a real upload.

3. Log in and run the build from the folder containing `steamcmd.exe`:

```bash
steamcmd +login <your_steamworks_username> +run_app_build ..\scripts\app_build_1000000.vdf +quit
```

Steamworks may prompt for a Steam Guard code the first time you log in from a new machine — that's expected, and the same account-security flow as logging into the Steam client itself.

4. Expected result: `steamcmd` prints per-file upload progress, then a `Success!` line with a build ID. That build now shows up under Steamworks → SteamPipe → Builds for the app, where you can promote it to a branch (including `default`, the branch regular buyers download) without re-uploading anything — branch assignment is a Steamworks web-UI action on a build you already pushed.

## 4. Store page assets

Everything here is prepared under Steamworks → your app → Store Presence. Every graphic asset below has an exact pixel size Valve enforces — uploads outside these dimensions get rejected or auto-cropped badly, so generate or crop to the exact size before uploading, not after.

1. **Header capsule** — `460×215` px. Shows in search results and top-seller lists; the single most-seen image of your game on the platform.
2. **Small capsule** — `231×87` px. Shows in tighter list views (tags pages, recommendation carousels) where the header capsule is too large to fit.
3. **Main capsule** — `616×353` px. Used on your own store page's featured/header area and in some front-page placements.
4. **Vertical capsule** — `374×448` px. Used in the mobile Steam app and some vertical-card placements — don't skip this one just because it looks redundant with the others; a missing vertical capsule shows as a broken/blank card on mobile.
5. **Page background** — a wide image (aim for `1920×1080` or larger) that sits behind your store page's text, heavily darkened/blurred by Steam's own overlay — design it knowing 80% of it will be obscured; put nothing important (logos, readable text) near the center where the page's own content sits on top.
6. **Screenshots** — at least 5, `1920×1080` recommended. These do more selling work than your description text: use them to show actual gameplay states (combat, a boss, an inventory screen, a level transition), not a single repeated title-screen shot five times. Real capture beats mockups — buyers can tell.
7. **Trailer** — one video, uploaded to YouTube and linked from Steamworks (or uploaded directly, depending on your current Steamworks account tier). Front-load it: the first 5-10 seconds need to show what the game actually is, since that's the window before a shopper scrolls past. A trailer is not strictly required to submit a page for review, but a Steam store page without one converts dramatically worse — budget the time to make one before you flip the page public.
8. **Short description** — one or two sentences, shown in search results and on your capsule hover. This is the pitch a shopper reads before they ever click into your page; write it last, after you know what actually excites playtesters.
9. **Long description** — the full store-page body: features list, screenshots interleaved with text, system requirements. Lead with what makes the game distinct, not a plot summary — shoppers decide to click "Add to Cart" in seconds, not after reading your lore.
10. **Tags** — pick your own set first (Steamworks lets you assign your game's own tags), then the community can vote to add more once the page is live. Put your most accurate, highest-search-volume tags first: tags are one of the main ways Steam's discovery and recommendation systems match your game to a shopper's browsing history, so a vague or padded tag list gets you shown to the wrong audience, and a wrong audience doesn't wishlist or buy.
11. **Genres** — pick from Steam's fixed genre list (Action, Adventure, Casual, Indie, RPG, Simulation, Strategy, and so on) as accurately as your tags. Genre and tags together are what most of Steam's automated "you may also like" and search-filter surfaces key off — accuracy here is a discovery mechanism, not paperwork.

Good capsule art and honest, specific tags aren't cosmetic — they're the primary inputs to Steam's discovery surfaces (search, tag pages, "similar to this," front-page carousels). A generic capsule or a padded tag list doesn't just look worse, it actively routes your page to the wrong shoppers, who bounce without wishlisting, which then tells Steam's own algorithm your page isn't converting — a bad first impression compounds.

## 5. Wishlists

A wishlist add is the strongest public signal Valve's systems have that a specific shopper wants your specific game. Steam's launch-day visibility — placement on "New & Trending," "Popular Upcoming," front-page feature slots, and the volume of "you may also like" impressions you get in your first week — is driven heavily by how many wishlists convert to purchases in a short window around release. A game that launches with 50 wishlists and a game that launches with 5,000 wishlists get fundamentally different algorithmic treatment on day one, even if the games themselves are comparable quality.

1. As soon as your store page goes live (even in Coming Soon state, before a release date is set), it starts collecting wishlists. This is the entire reason the 30-day rule in section 1 matters: a page that's only up for a few days before launch has had almost no time to accumulate any.
2. The **Coming Soon** page is just your normal store page with no release date confirmed yet (or a release date set but not yet reached) — Steam shows a "Wishlist" button in place of "Add to Cart," and that's the button you're optimizing sections 1-4 of this doc for. There's no separate setup step: getting your store page approved and public with assets in place (section 4) is what gets you a working Coming Soon page.
3. Building wishlists before launch is fundamentally a marketing/distribution problem, not a Steamworks configuration problem — it comes from getting your Coming Soon page's URL in front of people (social posts, devlogs, streamers, Steam events like Next Fest, cross-promotion from your itch.io or demo builds). This track's compliance and audience-building practices are covered generally in [../../money/README.md](../../money/README.md) — the same honest, no-fake-engagement rules apply to wishlist-building as to every other audience-building activity in this repo.
4. A free demo (game 06's Steam demo, and game 10's web-to-Steam funnel) is one of the highest-leverage wishlist tools available to a solo dev: someone who plays and likes a demo converts to a wishlist at a far higher rate than someone who only sees a capsule image, because they've already spent time with the actual game.

## 6. Review + release

1. **Build review.** The first build you ever set live on any branch for a new app goes through a Valve review pass before it can go live to the public — this checks for obvious violations (malware, broken installers, content policy issues), not a quality bar on your game design. Expect this to take some real turnaround time on a first submission; don't schedule your release date assuming same-day approval the first time you ever push a build.
2. **Store-page review.** Your store page itself (description, screenshots, capsule art, age-rating questionnaire) also goes through Valve review before it can go public, separate from build review. Submit the page for review as soon as your assets from section 4 are ready, well before you need it live — don't wait until launch week to find out a screenshot or description phrase got flagged.
3. **Setting the price.** Set a base price in USD; Steam auto-generates a full regional pricing table from it (which you can hand-adjust per region afterward — regional purchasing power varies enough that a straight currency conversion often prices you out of some markets and underprices you in others). Steam handles VAT/sales-tax collection and remittance in most jurisdictions automatically on top of whatever price you set — you don't need to build tax handling yourself.
4. **Release checklist**, in order: store page approved → build uploaded to the branch you intend to ship (usually `default`) → build review passed → price set → release date confirmed (or switch from "Coming Soon" to an exact date/time) → trailer and all capsule/screenshot assets finalized → age-rating questionnaire complete.
5. **Launch-day mechanics.** At your set release time, Steam automatically flips the store page from Coming Soon to live/purchasable and starts routing algorithmic visibility (new-release lists, wishlist-conversion emails to everyone who wishlisted, front-page placement eligibility) — you don't need to manually "publish" anything at the moment of launch beyond having everything above already in place before that timestamp hits.
6. **Launch discount (optional).** You can set a discount to run starting at launch instead of only applying one later. Keep a first-time launch discount modest (10-20%) unless you have a specific reason to go deeper — a launch discount also sets an early "lowest price seen" anchor that third-party price-tracking sites and shoppers will reference for the rest of the game's life, and Valve's discounting policy caps how deep and how often you're allowed to discount within a rolling period, so check the current rules in Steamworks before you set the number.

## 7. Revenue + payout

1. **Revenue share.** Steam's default split is **70% to you, 30% to Valve** on a given title's Steam revenue. This isn't a flat rate forever on a single title if it sells enough: Valve's tiered structure raises your share as a title's own lifetime Steam revenue crosses thresholds — your cut rises to 75% after that title clears **$10 million** in gross Steam revenue, and to 80% after it clears **$50 million**. For every game in this track, expect to be firmly in the base 70/30 tier — the higher tiers exist for genuine breakout hits, not a realistic planning assumption here.
2. **Payout threshold.** Valve holds your balance until it reaches a minimum payout threshold (roughly **$100** in most payout methods/currencies) — if a given month's earnings don't clear that bar, the balance simply rolls forward and accumulates until a future month does.
3. **Payout schedule.** Valve pays out roughly monthly — approximately 30 days after the end of the calendar month in which the revenue was earned, once your balance clears the threshold above. There's no faster/expedited option; budget around this lag rather than expecting near-real-time payouts the way an ad network dashboard sometimes shows.
4. **Payout method** is whatever you configured in section 1's banking step (bank wire/ACH/domestic transfer depending on country) — Steam does not pay out via PayPal or a card, only direct bank transfer to the verified account on file.
