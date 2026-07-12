# Playbook — SEO Affiliate Site

## Phase 1 — Niche selection + site skeleton

1. **[AI+YOU] Pick a niche against explicit criteria — do not skip any of these four:**
   - **You can add genuine first-hand experience.** A homelab, self-hosting, or dev-tooling niche is a natural fit for this learner specifically — you already run the gear, hit the errors, and know the quirks that a paraphrased listicle can't fake. Examples: NAS/home server hardware, self-hosted app stacks (Proxmox, Docker, Home Assistant), networking gear (routers, mesh Wi-Fi, managed switches), or dev-tooling categories (mechanical keyboards for coding, monitor/desk setups, backup/NAS software).
   - **Real buyer-intent keywords exist.** Use a free-tier keyword tool (Google Keyword Planner via a free Google Ads account, or Ubersuggest's free daily searches) to confirm actual search volume on "best [product] for [use case]," "[product A] vs [product B]," and "how to [task]" phrasings inside the niche — not just that the topic sounds interesting.
   - **Page-1 results currently have weak spots.** Search your top 5-10 target keywords and check what's actually ranking: forum threads (Reddit, forums) standing in for a real guide, thin AI-generated listicles with no specifics, or outdated posts (checked date, dead links, old product models) are all signs there's room for a genuinely better page — a page 1 stacked with strong, current, detailed content from established sites is a sign to pick a different angle or niche.
   - **NOT medical/financial YMYL territory.** Google applies far stricter trust signals to "Your Money or Your Life" topics (health, medical, legal, financial advice) that a new site with no established authority won't clear for a long time. Hardware, software, gear, and how-to niches are the right lane for a new site; supplements, medical devices, and investment products are not.

2. **[YOU] Buy the domain (~$10)** from any registrar (Cloudflare Registrar, Namecheap, Porkbun) — a short, memorable, niche-relevant name, no need to overthink brandability.

3. **[YOU] Set up free Cloudflare Pages hosting with a static site generator.** Hugo (gohugo.io) is the recommended pick here: it's fast to build, has a large library of free themes, and Cloudflare Pages has first-class support for it (auto-detects Hugo builds with zero config in most cases). Astro is a solid alternative if you want more component-level control. Either way: git-push-to-deploy, free tier, no server to maintain — the same operating model as any other static site in this track.

4. **[AI] Builds the site skeleton:**
   - A fast, minimal theme (avoid heavy JS themes — page speed is itself a ranking factor, and a clean static build should load in well under a second).
   - A category structure matching the niche's natural sub-topics (e.g. for a self-hosting niche: /hardware/, /software/, /guides/, /comparisons/).
   - Standard pages every affiliate site needs from day one: an About page (who you are, why this site exists, genuinely — this is an E-E-A-T trust signal Google's own quality guidelines call out by name), a Disclosure page (the full affiliate disclosure policy, linked from every page's footer in addition to the per-page inline disclosure), a Contact page, and a Privacy Policy.

5. **[AI] Generates the 30-post cluster map** — 5 pillar posts (long, comprehensive, the "hub" for a sub-topic) plus 25 supporting posts (narrower, linking back to their pillar), using a buyer-intent mix:
   - **"Best X for Y"** roundup/roundup-style posts (e.g. "Best NAS for a 4-Bay Home Media Server")
   - **"X vs Y"** direct comparison posts (e.g. "Synology vs TrueNAS: Which One for a First Home Server")
   - **How-to guides** that solve a real task and naturally reference gear/software along the way (e.g. "How to Set Up Automated Backups on a Home NAS")

   Map every supporting post to the pillar it supports before writing anything, so internal linking has real structure from post 1 instead of being retrofitted later.

## Phase 2 — Operating loop (2-3 posts per week)

1. **[AI] drafts each post from its outline** (see the post-outline skeleton below) — structure, first-pass copy, and a list of exactly where the post needs a real personal detail plugged in.

2. **[YOU] supplies real notes, screenshots, or specifics from your actual lab/tools for every single post.** This is the non-skippable step. A specific benchmark number you actually ran, a screenshot of your own dashboard or rack, a mistake you made and how you fixed it, a setting that isn't in the manual but that you found through trial and error — this is what separates the post from the AI-content flood everyone else is publishing, and it is the entire reason this site has a chance to rank where a template-generated competitor doesn't.

3. **[YOU] fact-checks and publishes.** Verify every technical claim, every spec number, and every affiliate link actually points where it says it does before the post goes live.

4. **On-page SEO checklist — run this on every post before publishing:**
   - Title tag includes the primary keyword phrase near the front, under ~60 characters so it doesn't get truncated in search results.
   - Clear H2 structure: one H1 (the post title), H2s for each major section, matching the outline — no skipped heading levels.
   - At least 2-3 internal links per post: every supporting post links to its pillar, and pillars link out to their supporting posts.
   - Schema markup added (Article schema at minimum; Product or Review schema on comparison/roundup posts where genuinely applicable) — most static site generators support this via a theme partial or a small template snippet.
   - Every image has a descriptive alt text (what the image actually shows, not "image1.png" or a keyword-stuffed phrase).

5. **Submit each post to Google Search Console** immediately after publishing (URL Inspection tool → Request Indexing) — this doesn't guarantee fast indexing but it's free and it's the direct channel, so there's no reason to skip it.

6. **Monthly: [AI] analyzes GSC performance data** to find underperforming posts — pages with impressions but a low click-through rate (title/meta description isn't compelling), or pages ranking on page 2-3 for a keyword that's close but not converging (content likely needs more depth or a better structure) — and rewrites them accordingly.

7. **Monthly: [YOU] takes one white-hat link-building action.** Pick one per month, not all three:
   - A HARO-style expert-quote pitch (respond to a journalist/blogger request for an expert quote in your niche, with a link back to your site).
   - A genuine resource-page suggestion (find an existing "useful resources" or "recommended links" page in your niche and email the site owner suggesting your relevant post — only if it's actually a good fit, not a mass-blasted generic pitch).
   - A real guest post on a niche-adjacent site (offer to write something genuinely useful in exchange for an author-bio link, not a paid link placement).

8. **Only apply to Amazon Associates once the site is getting roughly 50 visits/day.** Before that, the 180-day qualifying-sales clock (README.md's compliance section) would very likely burn out before real traffic exists to generate the 3 required sales.

## Phase 3 — Scaling

Once README.md's scale bar is hit (a content cluster clearly outperforming the rest on impressions, clicks, and rankings together):

- **Expand the winning cluster** first — more supporting posts under that pillar, deeper coverage of sub-topics readers are already searching for within it, before starting a new cluster from scratch.
- **Add comparison tables** to the winning cluster's posts — a real side-by-side spec/price-tier/feature table reads as more useful (and ranks better for comparison-intent searches) than the same information in prose.
- **Build small interactive tools** reusing money/03-micro-tools' build skills — a cost calculator, a compatibility checker, a spec comparison widget. A working tool embedded in a content page is both a stronger ranking signal (dwell time, backlinks from people who find the tool useful) and something the AI-content flood can't trivially copy.
- **Consider display ads once the site reaches roughly 10,000 sessions/month** (Google AdSense at minimum traffic, or a premium ad network like Mediavine/Ezoic once traffic clears their higher minimums) as a second revenue stream alongside affiliate income — don't add ads earlier than this, since at low traffic they pay pennies and clutter a page that's still trying to earn Google's trust.

## Templates and prompts

### Niche-selection worksheet

For each candidate niche, check every box honestly before moving forward — a niche with any box unchecked needs a different angle or should be dropped:

- [ ] I have genuine first-hand experience or gear in this niche (list what you actually own/run: __________)
- [ ] Real buyer-intent keywords exist — confirmed via keyword tool, not guessed (list 5 target phrases with rough volume: __________)
- [ ] Page-1 results for my top keywords show real weak spots (forums, thin content, outdated posts — list what you found: __________)
- [ ] This is NOT medical/financial/legal YMYL territory
- [ ] At least one viable affiliate program exists for this niche (Amazon category, or a specialized/direct-to-merchant program — name it: __________)

### Post-outline skeleton

> **Target keyword:** [exact phrase, confirmed via keyword tool]
> **Post type:** [best-X-for-Y / X-vs-Y / how-to]
> **Pillar it supports:** [which of the 5 pillar posts this links back to]
> **H1 (title tag):** [under ~60 characters, keyword near the front]
> **Intro (2-3 sentences):** what the reader will get and why you're qualified to say it
> **H2 sections:** [list 3-6, matching what the searcher actually needs answered]
> **Where YOU inject real detail:** [specific spot(s) in the outline needing your screenshot/benchmark/story — named explicitly, not left implicit]
> **Affiliate links:** [which products/programs, and where the disclosure goes — above the first link, not just in the footer]
> **Internal links:** [which other posts this links to/from]

### On-page SEO checklist (per post, before publishing)

- [ ] Title tag: primary keyword near the front, under ~60 characters
- [ ] One H1, clean H2 structure matching the outline, no skipped heading levels
- [ ] 2-3+ internal links (pillar ↔ supporting post relationship intact)
- [ ] Schema markup present (Article at minimum, Product/Review where applicable)
- [ ] Every image has descriptive alt text
- [ ] Affiliate disclosure appears above the first affiliate link, in plain language
- [ ] Every affiliate link tested and pointing to the correct product/page
- [ ] Submitted to Google Search Console (Request Indexing) after publishing

### Monthly update-cycle checklist

- [ ] Pull GSC Performance report, trailing 8-12 weeks
- [ ] Identify underperforming posts (impressions but low CTR, or stuck page 2-3 rankings)
- [ ] Rewrite/expand identified underperformers
- [ ] Take one white-hat link-building action (HARO-style pitch, resource-page suggestion, or guest post — pick one)
- [ ] Check whether 50 visits/day threshold is hit yet (gate for applying to Amazon Associates)
- [ ] Update TRACKER.md's weekly rows and answer that month's assessment question
