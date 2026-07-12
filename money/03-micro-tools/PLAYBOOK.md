# Playbook — Micro Tools

## Phase 1 — Idea selection + build sprint

1. **[AI+YOU]** Score each candidate idea 1-5 on five axes, then multiply (or sum, your call, just be consistent) to rank them:
   - **Pain frequency** — is this a thing the target user hits weekly, or once a year? Weekly pain scores higher.
   - **Search demand** — eyeball this for free before trusting your gut: type the core phrase into Google and read the autocomplete suggestions (real queries people actually type); check Google Trends (free) for relative interest over time; run it through Ahrefs' free Keyword Generator or Ubersuggest's free daily lookup allowance for a ballpark volume number. If autocomplete returns nothing close and Trends is flat, that's a low score no matter how much you personally want to build it.
   - **Payment willingness** — bias toward B2B/prosumer tools (developers, ops teams, freelancers billing clients) over consumer tools. A dev who bills $75/hr will pay $10 to save 20 minutes; a hobbyist usually won't.
   - **Buildable in a weekend** — can a Claude Code session produce a working MVP (not a prototype, a thing that actually does the job) in one focused weekend? If it needs a database with real scale, background job queues, or third-party API integrations with approval delays, score it low.
   - **Existing-competition gap** — search for the obvious competitors. Total absence of competition is a red flag (nobody wants this), not a green light. The sweet spot is 2-5 existing tools that are outdated, ugly, missing an obvious feature, or overpriced for what they do.

   **12 seed ideas to score:**
   1. Niche invoice generator (for a specific vertical — e.g. freelance devs, consultants)
   2. Cron builder + explainer pro (build a cron expression visually, explain any existing one in plain English)
   3. Regex tester with a saved library (test regex live, save/tag/share patterns instead of re-writing them)
   4. YAML/env/JSON converter pro (bulk conversion, schema validation, diffing between formats)
   5. Image-to-favicon-pack generator (one upload → full favicon/manifest set for every platform)
   6. Meta-tag/OG preview generator (paste a URL or tags, see exact Twitter/Slack/Discord/LinkedIn card previews)
   7. Changelog generator from git log (paste/connect a repo's commits, get a formatted, categorized changelog)
   8. Timestamp converter, team edition (convert across timezones for a whole team/meeting at once, shareable link)
   9. Markdown-to-styled-PDF (markdown in, a properly typeset PDF out, with selectable themes)
   10. DNS record checker with monitoring (check records now, plus paid alerting when they change/break)
   11. QR batch generator (bulk-generate branded/styled QR codes from a CSV, with trackable short links)
   12. Pricing-page A/B mockup tool (generate 2-3 pricing-page layout variants from a product description, for founders to test)

   **[YOU]** picks one — the highest scorer, unless you have a strong personal reason to prefer a lower-scoring one you'll actually stay motivated to promote. Motivation to launch it 3+ times matters more than a half-point scoring difference.

2. **Build sprint (one focused weekend):**
   - **[AI]** Builds the MVP in a Claude Code session: static frontend + Cloudflare Workers/Pages Functions for any serverless logic, all on Cloudflare's free tier — no paid infrastructure needed to launch.
   - **[AI]** Writes the landing page using this headline formula: **"[Verb] [specific task] without [the specific pain]"** or **"[Task], for [specific audience] — [the one differentiator]."** Examples: "Convert cron expressions to plain English, instantly." / "Regex testing with a library that remembers your patterns — built for backend teams." Hard rule: never state a user count, testimonial, or "trusted by" line unless it is literally true and you can name the source. Zero customers means the page has no social-proof section at all — it does not invent one.
   - **[AI]** Wires the Lemon Squeezy checkout:
     1. Create a Store in the Lemon Squeezy dashboard.
     2. Add a Product — "Single Payment" for the $5-15 one-time tier, "Subscription" for the $3-5/mo pro tier.
     3. If a feature needs gating (not just a page), turn on License Keys in the product's fulfillment settings — Lemon Squeezy generates and validates keys via their API, so your tool can check a key server-side.
     4. Grab the Checkout Overlay embed snippet (or the hosted checkout URL) from the product's Share tab.
     5. Add the buy button on the landing page, pointing at that checkout.
   - **[YOU]** Buys the domain (~$10 of this folder's budget), creates the Cloudflare and Lemon Squeezy accounts if not already done, deploys the site, and switches the Lemon Squeezy store to **Test Mode** (Settings → toggle) to run a full test purchase with LS's test card before ever taking it live. Only flip test mode off once that end-to-end test purchase actually completes and the license key (if used) actually validates.

## Phase 2 — Operating loop (weekly)

1. **1 launch action per week.** **[AI]** drafts a Show HN post, 2-3 posts for subreddits relevant to the tool's audience, and an X thread (skeletons below), plus a list of 10 named directories to submit to: Product Hunt, BetaList, Indie Hackers (Products), AlternativeTo, SaaSHub, Uneed, Fazier, TinyLaunch, StartupStash, Launching Next. **[YOU]** reads every draft, adjusts anything that doesn't sound like you, checks each subreddit's self-promo rules before posting, and actually posts them.
2. **1 SEO content page per week.** **[AI]** writes a page targeting one real keyword variant surfaced in Phase 1's search-demand check (a "how to X" guide, a comparison page, a use-case page). **[YOU]** fact-checks every claim in it against the actual tool before publishing — an SEO page that oversells the free tier is a compliance problem, not just a marketing one.
3. **Respond to all user feedback** — bug reports, feature requests, pricing pushback — using **[AI]**-drafted replies (skeleton below) that **[YOU]** reads and sends.
4. **Ship 1 improvement from feedback each week**, even a small one. A tool that visibly responds to its first users is far more likely to get a second wave of word-of-mouth than one that goes quiet after launch.

## Phase 3 — Scaling

A tool that clears the README's scale bar (real revenue plus repeat traffic) gets an SEO content cluster (5-10 interlinked pages instead of 1-2), affiliate/adjacent-tool cross-links (link out to complementary tools, get linked back), and becomes the natural candidate for the cross-track Capstone A build: containerized with the Dockerfile pattern from `devops/02-docker-deep/`, run through the pipeline in `devops/03-cicd-forge/`, promoted via the GitOps setup in `devops/07-gitops/`, deployed to your own Proxmox k3s cluster from `proxmox/08-k8s-on-proxmox/`, and instrumented per `devops/08-observability/`. See [capstones/README.md](../../capstones/README.md) for the full spec. Moving a winner off Cloudflare's free tier and onto your own cluster is optional from a revenue standpoint — do it for the portfolio/learning value, not because Cloudflare's free tier will actually run out for a tool this size.

## Templates and prompts

### Show HN post skeleton

> Show HN: [ToolName] – [one-line description of what it does and for whom]
>
> Hi HN, I built [ToolName] because [specific personal pain point or story, 1-2 sentences — real, not invented]. It [what it does, in plain language, no jargon].
>
> It's free to [core action], with a paid tier ($X one-time / $X/mo) for [the specific pro feature — name it exactly, never "more features"].
>
> Built with [honest, brief stack note — e.g. "Cloudflare Workers + a static frontend"]. No signup required to try the free tier.
>
> Would love feedback, especially on [one specific open question — pricing, a rough edge, a feature you're genuinely unsure about].

### Reddit post skeleton

> **Title:** I built [ToolName] — [what it does], feedback welcome
>
> Hey r/[subreddit], long-time lurker. I made [ToolName] to solve [specific problem], because [where you personally hit this problem].
>
> What it does: [2-3 sentence plain description]
> Free tier: [what's actually free, with real limits]
> Paid tier: [$X, exactly what it unlocks — no pressure to buy, genuinely here for feedback]
>
> I'm the sole builder, not a marketer — I want to know if this is useful to people who deal with [the problem] regularly, or if I'm missing something obvious. Happy to answer questions.
>
> [link]

*(Read the subreddit's self-promotion rule before posting — flair requirements, minimum account age, and comment-to-post ratios vary by sub and getting this wrong gets the post removed or you banned.)*

### X thread skeleton

> 1/ Built [ToolName] this weekend: [one-line hook — the pain point, punchy, concrete].
>
> 2/ The problem: [1-2 sentences, a specific example, not an abstraction].
>
> 3/ What it does: [plain description — attach a screenshot or short screen-recording gif if you have one].
>
> 4/ Free to [core action]. $X [one-time/mo] unlocks [the specific pro feature].
>
> 5/ Built on [stack, one sentence]. Live now: [link]. Feedback very welcome — reply or DM.

### Landing-page copy skeleton

> **H1:** [headline formula from Phase 1 — "[Verb] [task] without [pain]" or "[Task], for [audience] — [differentiator]"]
> **Subhead:** one sentence naming the exact user and the exact outcome — no adjective you can't prove.
> [Try it now — an inline demo/input box, no signup required for the free action]
> **Free tier:** [bullet list with exact limits, e.g. "up to 10 conversions/day"]
> **Pro tier ($X one-time / $X per month):** [bullet list of exactly what unlocks]
> [Buy button → Lemon Squeezy checkout]
> **FAQ:** 3-5 real questions — what data do you store, can I cancel, is there an API, what's the refund policy.
> **Footer:** link to the privacy policy, a contact email, and a plain "built by [name], a solo project" disclosure.

### Feedback-reply skeleton

> Thanks for trying [ToolName] — [restate their specific point in one sentence, so they know you actually read it].
>
> *If a bug:* Confirmed, that's on me — I'll have a fix out by [a specific day, never "soon"].
> *If a feature request:* That's a reasonable ask. [Either: "Added to the roadmap, aiming for next week" — or an honest "Not planning to build this because [reason] — happy to be talked out of that."]
> *If pricing pushback:* [Explain the reasoning briefly, or note you're logging it as a data point for the next price review. Don't get defensive.]
>
> Appreciate you taking the time to write in — this is exactly the kind of feedback that shapes what I build next.
