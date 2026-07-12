# Reference: Publishing to Google Play

This doc covers the parts of Google Play publishing that only you can do — creating your own developer account, verifying your own identity, holding your own signing keys, and clicking your own "submit for review" buttons. An AI pairing with you cannot create accounts, prove who you are to Google, or hold secrets on your behalf. Games **01, 03, 05, and 07** in this track target Google Play — each of those games' `GUIDE.md` links back to this doc instead of repeating it.

You are an advanced IT person who has never published to Google Play before. This doc assumes zero prior Play Console experience and tells you exactly what to click and what you'll see.

---

## 1. Developer account

Every Android game that reaches real users on Google Play needs a Play Console developer account attached to a real, verified person (or organization). This is a one-time setup, done once for the whole gamedev track — you don't repeat it per game.

1. Go to `https://play.google.com/console/signup` and sign in with the Google account you want tied to your developer identity permanently (this account becomes the owner — choose one you control long-term, not a throwaway).
2. Choose the account type:
   - **Personal account** — you publish as yourself, under your own legal name. Simpler, faster to verify, right choice for a solo hobbyist or a first-timer. This is the default recommendation for this track.
   - **Organization account** — you publish under a registered business/studio name. Requires a D-U-N-S number (a free business identifier from Dun & Bradstreet) and takes noticeably longer to verify. Only choose this if you already have a registered business you want as the publisher of record.
3. Pay the **$25 one-time registration fee** by card. This is charged once, ever, per developer account — not a subscription, not per app.
4. Fill in the account details Google asks for: your **legal name** (must match a government ID — no nicknames or business names on a personal account), a **physical address** (used for tax and verification purposes, does not need to be public), and a **phone number** that you verify by entering a code Google texts or calls you with on the spot.
5. Complete **developer identity verification**. Google requires this for all new developer accounts (personal and organization) before an app can go live to the public. In practice this means Google may ask you to confirm the details above against a government-issued ID, and in some cases complete an additional verification step (such as a short video check) if your initial submission doesn't auto-clear. You cannot skip this — an unverified account can upload builds for internal testing but cannot publish to production.
6. Wait for approval. Account setup itself is instant, but the identity/account review typically takes **1-3 days**, and can stretch to a week or more if Google requests extra documents. Don't schedule a launch date against the assumption of same-day approval — start this step well before you need production access.

Once approved, this one account covers every game you publish in this track (01, 03, 05, 07, and anything after) — you don't create a new developer account per game.

---

## 2. Signing keys

Every release build you upload to Play must be cryptographically signed. This is a per-machine, per-you task — the key material must never leave your control, and an AI cannot generate a "your" signing identity for you (it can run the command, but you own the resulting file and passwords).

1. Generate an **upload keystore** with the JDK's `keytool` (ships with any JDK — Godot and Unity both require a JDK for Android builds anyway). Example, using an alias named `upload` and Google's own recommended 25-year validity window:

```
keytool -genkeypair -v -keystore upload-keystore.jks -alias upload -keyalg RSA -keysize 2048 -validity 9125
```

   `keytool` will interactively ask for a **keystore password**, then your name/organization/city/country (for the certificate's distinguished name — answer honestly, but it has no functional effect on the app), then a **key password** (you can press Enter to reuse the keystore password, or set a separate one).

2. Understand **Play App Signing**, which Google has required for all new apps since August 2021:
   - The key you just generated is your **upload key**. You use it to sign every AAB you build and upload to Play Console.
   - Google separately generates and holds the **app signing key** — the key that actually signs what end users download. When you upload an AAB signed with your upload key, Play Console verifies it against your registered upload key, then **re-signs it** with the app signing key before distributing it.
   - This split means if your upload key is ever lost or compromised, Google can help you reset it (via a request process in Play Console) without invalidating the app's real identity to end users — because the app signing key never left Google.

3. **Back up the keystore file and every password immediately**, before you do anything else with it:
   - Copy `upload-keystore.jks` to at least one location outside the machine you generated it on (a password manager's file storage, an encrypted cloud backup, a USB drive in a drawer — anywhere that survives a single disk failure).
   - Store the keystore password, key password, and key alias in a password manager. Do not rely on memory or a plaintext file next to the keystore.
   - Losing the upload key is recoverable but painful: you have to go through Google's upload-key-reset request in Play Console, which requires proving account ownership and can take days, and blocks you from shipping updates until it clears. Losing it is a self-inflicted delay, not a catastrophe — but only if you act fast when you notice, so treat this backup step as non-optional, not a someday task.

---

## 3. Building an AAB

Google Play requires new apps to be uploaded as an **Android App Bundle (`.aab`)**, not a plain APK. An AAB contains your compiled game plus all its resources; Play's servers generate optimized, device-specific APKs from it at install time, so users download less than they would from a universal APK. This section is engine-agnostic — each game's `GUIDE.md` in this track points back here and then adds only what's specific to that game.

### Godot

1. Install the Android SDK and a JDK on your machine, then in Godot open **Editor Settings > Export > Android** and confirm the Android SDK path is set correctly (Godot validates this and shows a red/green status).
2. In your project, run **Project > Install Android Build Template** once — this adds an `android/build` folder to your project and is required for a Gradle-based build (needed for setting permissions, adding the AdMob plugin later, and hitting Play's target API level requirements).
3. Open **Project > Export**, click **Add...** and choose **Android** to create an export preset. In that preset's **Keystore** section, set:
   - **Release / Release Keystore** — path to `upload-keystore.jks` (or wherever you moved it)
   - **Release / Release User** — the alias you used (`upload` in the example above)
   - **Release / Release Password** — the key password from step 2
   - **Package / Unique Name** — your app's reverse-domain package ID (e.g. `com.yourstudio.yourgame`) — this is permanent once you publish, so pick it deliberately
   - **Version / Code** and **Version / Name** — the internal integer version code (must increase on every upload) and the human-readable version string
4. Click **Export Project**, uncheck "Export With Debug" for a release build, and save the output file with an `.aab` extension — Godot builds an Android App Bundle when the save path ends in `.aab` (use `.apk` instead for a quick installable test build on a physical device).

### Unity

1. In Unity Hub, add the **Android Build Support** module (includes the Android SDK/NDK and an OpenJDK) to your Unity install if it isn't there already.
2. In your project, go to **File > Build Settings**, select **Android**, and click **Switch Platform**.
3. Open **Edit > Project Settings > Player** and set, under **Android > Other Settings**:
   - **Package Name** — your reverse-domain package ID, e.g. `com.yourstudio.yourgame` (permanent once published)
   - **Minimum API Level** — the oldest Android version you'll support (Play enforces a rising minimum target API level for new apps each year; check Play Console's current requirement before locking this in)
   - **Scripting Backend** — set to **IL2CPP** (Play requires 64-bit support, which Mono scripting backend cannot produce)
   - **Target Architectures** — check **ARM64** (mandatory for Play); include **ARMv7** too unless you have a reason not to
4. Under **Player Settings > Publishing Settings**, point **Keystore** at your `upload-keystore.jks`, enter the keystore password, then select your key alias and enter the key password.
5. Back in **Build Settings**, check **Build App Bundle (Google Play)**, then click **Build**.

Either path ends with one `.aab` file — that's what gets uploaded to Play Console in the next section.

---

## 4. Create the app in Console

1. In Play Console, click **Create app**. Enter the app name, choose default language, select **App** (vs. Pre-registration) and whether it's **Free** or **Paid**, and confirm the developer program policies and US export laws checkboxes.
2. Fill out the **store listing**, respecting Google's exact limits:
   - **App name**: max **30 characters**
   - **Short description**: max **80 characters** (shown above the fold on your store page)
   - **Full description**: max **4000 characters**
3. Prepare and upload the required graphic assets at their exact required dimensions:
   - **App icon**: **512x512**, 32-bit PNG (with alpha channel)
   - **Feature graphic**: **1024x500**, JPG or 24-bit PNG (no alpha channel) — this is the banner shown at the top of your store listing and in some promotional placements
   - **Phone screenshots**: at least **2**, aspect ratio either **16:9 or 9:16**, JPEG or 24-bit PNG (no alpha), each side between 320px and 3840px
4. Complete the **content rating questionnaire** (Play Console > App content > Content ratings). This runs through the **IARC** (International Age Rating Coalition) system — answer every question about violence, sexual content, drugs/alcohol references, gambling mechanics, and user-generated content honestly. IARC issues region-specific ratings from one questionnaire (ESRB for the US, PEGI for Europe, USK for Germany, and others) — you don't fill these out separately per region.
5. Complete the **Data safety** form (Play Console > App content > Data safety). Declare every type of data your game actually collects or shares (even data collected only by a third-party SDK you embedded, like an ad network or analytics tool), whether it's encrypted in transit, and whether users can request deletion. This must match what your privacy policy says — a mismatch is a common rejection reason (see Section 7).
6. Complete **Target audience and content** (Play Console > App content > Target audience). Select the age groups your game targets. If your game is directed at children (including if it's directed at children under 13 alongside a general audience), you must make the required Play Families / COPPA-adjacent declarations — this restricts you to Families-certified ad SDKs and imposes stricter ad-content and data-collection rules. Don't select a "kids" target audience unless the game is genuinely built and rated for it — it changes what monetization is allowed (see Section 6 and `monetization-ads.md`).

---

## 5. Testing ladder

Play doesn't let you jump straight from "built it" to "public production release." You move a release through tracks, each with its own reach and review characteristics:

1. **Internal testing** — up to **100 testers**, added by email address in Play Console. Builds become available to testers within minutes, with no real review gate. Use this for your own first-install sanity check and quick iteration with a few friends.
2. **Closed testing** — invite a specific list of testers (email list, or a Google Group) via an opt-in link. Builds here go through a real review pass, similar in kind to production review. **Important current requirement for new personal developer accounts**: before you can apply for production access, you must run a closed test with at least **12 testers opted in continuously for 14 days**. Plan for this lead time from the start — it's calendar time you can't compress by testing harder, only by starting earlier.
3. **Open testing** — a public opt-in link anyone can join, shown on your (not-yet-public) Play Store page with an "early access" label. You can cap the number of testers or leave it open. This is a good stage for a wider pre-launch crash/ANR signal before going fully public.
4. **Production**, with **staged rollout** — your real release. Don't ship to 100% on day one: set a rollout percentage (e.g. start at 5-10%), watch Play Console's Android vitals (crash rate, ANR rate) for that slice of users, and increase the percentage in steps once the numbers look clean. You can halt a staged rollout if something goes wrong, before it reaches everyone.

---

## 6. Payments/payout

There are two separate payment setups, for two separate revenue types — don't conflate them:

1. **Play Console payments profile** — needed if your game is a paid app, or sells in-app products/subscriptions through Google Play Billing. Set this up under Play Console > **Setup > Payments profile** (Play prompts you for this automatically the first time you try to mark an app Paid or add an in-app product). You'll provide your legal name and address, a bank account for payout (account/routing number or IBAN depending on your country), and complete a tax interview (a **W-9** if you're a US person, **W-8BEN** if you're a non-US individual, **W-8BEN-E** for a non-US entity). If your game is free with no in-app purchases, you can skip this entirely.
2. **AdMob payments profile** — needed if your game shows ads. This is a *separate* payments profile inside AdMob (`apps.admob.com`), not the Play Console one — it has its own legal-name/address/bank/tax steps, independent of whether you ever set up a Play Console payments profile. Linking your AdMob account to your app, adding ad units, and wiring the SDK into your game is covered in `monetization-ads.md` in this same reference folder — this doc only covers getting paid, not integrating the ads themselves.

---

## 7. Common rejection reasons

Keep these in mind before every submission — they account for the large majority of first-time rejections:

- **Broken functionality** — the game crashes, a core feature doesn't work, or it doesn't do what the store listing says it does.
- **Missing privacy policy** — required for essentially every app, since almost every game touches some user or device data (even just via an ads or analytics SDK). It must be a real, publicly reachable URL, not a placeholder.
- **Misleading store listing** — screenshots, description, or category that don't match what the app actually is or does, including exaggerated claims or keyword-stuffed descriptions.
- **Crashes on launch** — Google's automated pre-launch report runs your build on a farm of real devices before it goes live; a cold-start crash caught there will block release until fixed.
- **Ad policy violations** — ads that obscure the UI or system back button, layouts that induce accidental clicks, interstitials shown too frequently or at the wrong moment (e.g. immediately on launch or app switch), or reward ads that don't actually grant the promised reward.
