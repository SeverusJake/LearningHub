# Playbook — Gumroad Products

## Phase 1 — Product pipeline (build #1 end-to-end in one burst)

1. **[AI]** Picks the first product to build from the three lines below. Start with whichever line matches a topic you already know cold — build speed and technical accuracy both come from real expertise, not from picking whatever sounds most marketable.
   - **Notion templates:** homelab tracker (rack/VM/service inventory, IP and port map, maintenance log), incident runbook pack (a duplicate-able incident page — severity levels, comms checklist, timeline log, postmortem template), job-hunt CRM (application tracker, contact log, interview-prep database, offer-comparison table).
   - **Boilerplates:** FastAPI + Stripe starter (auth, subscription billing, webhook handling, tests), Ansible role pack (production-grade roles — hardening, Docker install, monitoring agent, common services — with molecule tests), GitHub Actions workflow pack (reusable workflows for lint/test/build/deploy across a few common stacks, using the composite-action pattern).
   - **PDF cheatsheet packs:** Kubernetes troubleshooting (a symptom-to-command-to-fix decision-tree pack covering pod, networking, storage, and RBAC failures), Linux one-liners with explanations (each one-liner plus a 2-3 sentence breakdown of what every flag and pipe stage does, organized by task — text processing, process management, disk and network diagnostics).

2. **[AI]** Builds the product, by type:
   - **Notion template:** [AI] can't click inside Notion directly, so it writes the exact structure spec — page hierarchy, each database's properties/views/formulas, and starter example rows — for **[YOU]** to build in Notion in roughly 30-60 minutes of clicking, plus a separate "How to use this template" guide page (duplicated into the template itself) covering setup, what each view is for, and how to customize it.
   - **Boilerplate:** [AI] writes the full working repo (not a snippet) — code, a README covering setup/env vars/how to run and deploy it, and a short video-walkthrough script (60-90 seconds: what it solves, a 3-step quickstart, where to customize) that **[YOU]** records with a free tool (OBS or a phone screen recording) and links from the listing.
   - **PDF pack:** [AI] writes the full content in markdown first, every command and explanation fully drafted and technically checked, then it's styled into a PDF via pandoc (`pandoc cheatsheet.md -o cheatsheet.pdf --pdf-engine=xelatex --toc`) or Typst for tighter print-style layout control. The cover image comes from an AI image generator — [AI] drafts the prompt (a clean, high-contrast terminal/cheatsheet aesthetic naming the exact topic), **[YOU]** runs it and picks the export.

3. **[AI]** Writes the Gumroad listing:
   - **Title formula:** `[Specific outcome] for [specific role/tool]` — e.g. "Incident Runbook Pack for On-Call Engineers," "FastAPI + Stripe SaaS Starter," "Kubernetes Troubleshooting Cheatsheet — Symptom to Fix." Name the tool or role; never a vague noun like "productivity system."
   - **Description skeleton:** full text in the Templates section below.
   - **3 preview-image guidance notes:** (1) image 1 is a full-page or full-repo-tree screenshot showing real content, not a mockup or stock photo — buyers are judging whether the actual thing looks competent; (2) image 2 zooms into one specific high-value detail (a formula in the Notion database, a code snippet from the boilerplate, one dense cheatsheet section) so a browsing buyer sees depth, not just a cover; (3) image 3 is a plain-text summary card — what's included, page or file count, format — since some buyers only skim images and never read the description.
   - **Pricing strategy:** anchor with a free or pay-what-you-want "lite" version (fewer pages, roles, or sheets, still genuinely useful) alongside a $9-29 full version. Price toward $9-15 for a single-topic PDF pack or template, $19-29 for a multi-piece boilerplate or a template with several linked databases. Run the pay-what-you-want option (Gumroad's minimum-price slider) on at most one product at a time, as a test of what buyers actually value it at, rather than defaulting every product to it.

4. **[YOU]** Creates the Gumroad account, uploads the product files and listing content [AI] drafted, sets the price and the free/PWYW lite tier, publishes the listing, and connects PayPal in Settings → Payments before the first sale needs to pay out.

## Phase 2 — Operating loop (2 bursts/week)

1. **Distribution, both weekly bursts.** **[AI]** drafts value-first posts for the subreddits, X, and dev.to relevant to each product's audience (skeletons below). The rule for every post: teach the underlying thing in the post itself — a real troubleshooting technique, a real Notion setup tip, a real Actions workflow pattern — link the product only in context as "the rest of this is in the pack," and disclose that you made it. **[YOU]** reads each draft, checks that specific subreddit's self-promotion rules before posting (flair, account-age minimums, comment ratios), and posts it.
2. **Free-sample funnel.** Keep at least one free or pay-what-you-want lite version live per product line, wired through Gumroad's Follow feature — anyone who grabs the free version can opt into email follows, so every free download adds to an email list you own instead of just a Gumroad view count.
3. **Email broadcast per new product.** **[AI]** drafts a broadcast (skeleton below) to that list every time a new product ships, framed as "here's the new thing, and here's why it's useful to you specifically" rather than a bare announcement.
4. **Ship 1 new product every 2 weeks** until 5 products are live across the three lines. Once 5 are live, stop building new ones and double down on whichever single product has the best revenue-per-distribution-push ratio — more listing polish, a bundle, a tiered version, and more frequent posts about that product specifically.

## Phase 3 — Scaling

Bundle your top 2-3 sellers into a single higher-priced package — for example all three Notion templates as one "Dev Ops Notion Kit" at a discount off buying them separately — Gumroad supports multi-product bundles natively. Turn on Gumroad's affiliate program (Settings → Affiliates) for your best seller once it has proven repeat sales, with a 20-30% commission, so other creators in the same space have a reason to link it. If a tool in `03-micro-tools/` shares an audience with a product here — a Kubernetes-related micro-tool and the k8s troubleshooting cheatsheet, for example — cross-promote both directions with a footer link or a one-line mention in each listing, instead of running the two folders as unrelated efforts.

## Templates and prompts

### Listing description skeleton

> **What it is:** [one sentence — exact product, exact audience]
>
> **What's inside:** [bullet list, exact counts — "12 Notion pages," "4 GitHub Actions workflows," "40 troubleshooting entries" — never "tons of" or "a comprehensive set of"]
>
> **Who it's for:** [specific role or situation, not "everyone" — e.g. "solo homelab operators running 5+ services" or "backend engineers standing up their first Stripe integration"]
>
> **How it works:** [2-3 sentences — duplicate into your Notion workspace / clone the repo and run X / open the PDF and jump to your symptom]
>
> **Free / lite version:** [what the free tier includes, with real limits, if one exists for this product]
>
> **Format:** [Notion template link / .zip repo / PDF, page or file count, last-updated date]
>
> **Support:** [where buyers reach you with questions — a Gumroad message, an email address]

### Distribution-post skeletons

**Reddit** (post to the relevant subreddit — r/homelab, r/devops, r/sysadmin, r/kubernetes, and similar, depending on the product):

> **Title:** [the real technique, not the product name — e.g. "My incident runbook structure after 3 years of on-call (free template included)"]
>
> [2-4 paragraphs actually teaching the technique or structure — the real content, not a teaser.] At the end: "I turned this into a duplicate-able template with [the 2-3 extra things the paid version adds] — free/pay-what-you-want lite version here if useful: [link]. I made this myself, not affiliated with anyone else selling something similar."
>
> *(Read the subreddit's self-promotion rule before posting — flair requirements, minimum account age, and comment-to-post ratios vary by sub, and getting this wrong gets the post removed or you banned.)*

**X / Twitter thread:**

> 1/ [the technique or a specific painful moment, punchy, one line]
>
> 2-4/ [the actual teaching content — 2-3 posts of real value, a screenshot if it helps]
>
> 5/ Turned this into a full pack: [ProductName]. Free/pay-what-you-want lite version plus a $[X] full version with [specific extras]. Link: [link]. Made this myself — feedback welcome.

**dev.to post:**

> **Title:** [a specific how-to — e.g. "A Symptom-to-Fix Approach for Kubernetes Troubleshooting"]
>
> [Full technical article, 800-1500 words, real content, code blocks, actual depth.] Closing section, clearly separated: "If this was useful, I put together a more complete version as a [PDF pack / template / boilerplate] — [link]. Free/lite version available if you want to try it first."

### Email broadcast skeleton

> **Subject:** New: [ProductName] — [the one-line hook]
>
> Hey — just shipped [ProductName], a [one-sentence description].
>
> If you've dealt with [the specific pain this solves], this covers [2-3 concrete things it does, not vague benefits].
>
> [What's inside — 3-5 bullets, exact counts]
>
> It's $[X] here: [link]. [If applicable: "The free/lite version from [earlier product] is still up if you haven't grabbed it."]
>
> Thanks for being on this list — replies go straight to me if you have questions or requests for what to build next.
