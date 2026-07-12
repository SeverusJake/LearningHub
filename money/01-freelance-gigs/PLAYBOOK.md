# Playbook — Freelance Gigs

## Phase 1 — Setup (once)

1. **[YOU]** Create your Fiverr and Upwork accounts under your real identity, verify email/phone on both, upload a real headshot photo (not a logo, not a stock image — buyers trust faces), and link PayPal as the payout method on both platforms. Confirm both show "verified" before moving on.
2. **[AI]** Draft your profile bio/overview for both platforms — one version each, 150-250 words, leading with the concrete outcome you deliver (working scripts, clean data, fixed bugs) not a list of tools. Example angle: "I turn messy spreadsheets and slow manual data work into scripts that run in seconds. 10+ years in IT, now focused on Python automation and data cleanup for small businesses and busy teams."
3. **[AI]** Write 3 Fiverr gig descriptions — one each for scraping, data cleaning, and Excel/Sheets automation — using the title formula: "I will [specific outcome] using [tool/method] for [audience]." e.g. "I will build a Python web scraper to extract your data automatically." Each gig gets 3 package tiers priced at $15 / $40 / $90 to start (Basic/Standard/Premium), an FAQ block, and a search-tag list. Full templates are in the Templates section below — copy, don't rewrite from scratch.
4. **[AI]** Build 3 portfolio samples, budgeting about 1 hour each, to attach to your gigs and reuse in Upwork proposals:
   - A small working Python scraper (e.g. pulls product names + prices from a public sample site into a CSV) with a short README.
   - A "before/after" data-cleaning demo: a messy sample CSV (duplicate rows, inconsistent casing, mixed date formats, blank cells) next to the cleaned output, with a one-paragraph note on what was fixed.
   - An Excel/Sheets automation demo: a macro or Apps Script that does something visibly useful (auto-formats a report, merges two tabs, sends a summary email) with a 30-second screen recording or GIF if possible.
5. **[YOU]** Publish the 3 Fiverr gigs with the AI-drafted copy and attach the portfolio samples as gig images/PDFs. Set your Upwork profile to "available now" and add the same 3 portfolio samples to your Upwork portfolio section.

## Phase 2 — Operating loop (daily · 45-90 min)

1. **[YOU]** Check Fiverr and Upwork messages first thing in your active hours, and again every hour or two while you're online. Reply to any buyer/client message in under 1 hour during active hours — this is the single biggest lever on Upwork's Job Success Score and search ranking, and on Fiverr it directly affects whether a lead converts before they message a competitor.
2. **[AI]** Browse the Upwork job feed (you paste in or describe the open jobs, or export a batch) and identify 5-10 jobs that actually fit your 3 niches — skip anything with 20+ proposals already in, a client with no payment verified, or a budget that's a race to the bottom. Draft a personalized proposal for each using the skeleton below (see Templates) — every proposal references something specific from that job post, not a generic pitch.
3. **[YOU]** Read each drafted proposal, adjust anything that sounds off, and send 5-10 proposals per day. Do this every day, weekends included if you can — gaps kill momentum on Upwork's ranking and on Fiverr's gig visibility.
4. **When an order/contract comes in:**
   - **[AI]** Does the actual work in a Claude Code session — writes the scraper, cleans the data, builds the automation, fixes the bug, or drafts the doc — against the exact spec the client gave.
   - **[YOU]** Reviews the output line-by-line and actually tests it (run the script, open the cleaned file, execute the macro) before it goes anywhere near the client. Never ship something you haven't personally verified works.
   - **[YOU]** Delivers the work with an AI-drafted summary note (see Templates) that you've read and adjusted to sound like you, explaining what was done and how to use it.
5. **Revision policy:** offer 2 free rounds of revisions per order, scoped to the original brief. Watch for scope-creep phrases that signal a client is trying to get new work for free under "revisions" — "while you're at it, can you also...", "one more small thing...", "can you also make it work for [entirely different data source/format]", "can you add [feature never mentioned in the original brief]". When you hear one of these, use the revision-response skeleton below to draw the line politely and quote the extra work separately.

## Phase 3 — Scaling

- Raise prices 25% every time a gig collects 5 five-star reviews (see README kill/scale criteria) — don't wait for buyers to push back on price, let proof drive the increase.
- Once you're consistently full on proposals/orders, start declining low-value work: rock-bottom-budget jobs, scope-creep-prone clients, and anything outside your 3 core niches. Your time becomes the scarce resource, not your gig count.
- Identify your best-selling gig (most orders, best margin, least revision drama) and productize it into a single fixed-scope, fixed-price package — a clearly bounded offer that's easy for a buyer to say yes to and easy for you to deliver without surprises.
- For clients who order more than once, offer a monthly retainer (e.g. "I'll run this scraper weekly and email you the updated CSV for $X/month") instead of repeating one-off orders — retainers are the highest-leverage income in this folder because they remove the daily proposal grind for that revenue.

## Templates and prompts

### Gig description skeleton 1 — Python scraping

**Title:** "I will build a Python web scraper to extract your data automatically"

**Description:**
> Need data pulled from a website, spreadsheet, or API on a regular basis without doing it by hand? I build Python scripts that extract exactly the data you need — product listings, prices, contact info, articles, whatever's public and structured — and deliver it as a clean CSV, Excel file, or JSON.
>
> What you get:
> - A working script tailored to your target site/source
> - Output in the format you need (CSV/Excel/JSON)
> - Basic error handling so the script doesn't silently fail
> - A short README so you (or anyone) can run it again later
>
> I test every script against your actual target before delivery — no "should work" hand-waving.

**Packages:**
- Basic ($15): single-page/single-source scrape, up to ~100 rows, delivered as CSV.
- Standard ($40): multi-page scrape (pagination handled), up to ~1000 rows, CSV or Excel, basic error handling.
- Premium ($90): multi-source or scheduled scrape, deduping, Excel output with light formatting, plus a 15-minute call to confirm requirements.

**FAQ:**
- *Can you scrape any website?* Most public sites, yes. I won't scrape sites that explicitly prohibit it in their terms, or anything behind a login that isn't yours.
- *Do you handle logins/paywalls?* Only for accounts you own and provide access to.
- *What if the site changes its layout later?* Scripts can break when a site redesigns. I offer a fixed-price update if that happens — just message me.
- *Can I get this on a schedule (daily/weekly)?* Yes, ask about the Premium tier or a retainer.

**Search tags:** python scraper, web scraping, data extraction, csv automation, python script

### Gig description skeleton 2 — Data cleaning (CSV/Excel)

**Title:** "I will clean and organize your messy CSV or Excel data"

**Description:**
> Messy spreadsheet with duplicate rows, inconsistent formatting, mixed date formats, or blank cells everywhere? I clean it up — deduped, consistently formatted, validated, and ready to actually use in a report, database, or analysis.
>
> What you get:
> - Duplicates removed, casing/formatting standardized
> - Dates, numbers, and text fields normalized to one consistent format
> - Blank/missing values handled the way you specify (flagged, filled, or removed)
> - A short before/after note explaining what was changed and why
>
> I review every fix manually against your original data before sending it back — automated cleaning without a human check is how real numbers get quietly corrupted.

**Packages:**
- Basic ($15): up to ~500 rows, single sheet, standard cleanup (dedupe, formatting).
- Standard ($40): up to ~5,000 rows, multiple sheets/tabs, custom rules (e.g. specific date/number formats, category standardization).
- Premium ($90): up to ~20,000 rows, cross-referencing between sheets, validation report included, plus a 15-minute call to confirm the cleaning rules.

**FAQ:**
- *Will you change my actual data values?* Only per your instructions — I'll flag anything ambiguous before deciding for you.
- *Can you merge data from multiple files?* Yes, ask about the Standard/Premium tiers.
- *Do you handle sensitive data?* I don't need to see anything beyond what's needed for the task, and I don't reuse or share client data. If your data is regulated (health, financial, etc.), tell me upfront so we can scope this correctly.
- *What formats do you accept/deliver?* CSV, XLSX, and Google Sheets exports, both directions.

**Search tags:** data cleaning, excel cleanup, csv cleaning, data entry cleanup, spreadsheet cleanup

### Gig description skeleton 3 — Excel/Sheets automation

**Title:** "I will automate your repetitive Excel or Google Sheets tasks"

**Description:**
> Doing the same manual spreadsheet task every week — reformatting a report, merging tabs, copying data between files, sending a summary email? I build a macro, formula system, or Apps Script that does it in one click instead of by hand.
>
> What you get:
> - A working automation (VBA macro, Google Apps Script, or formula-based system — whichever fits your tools)
> - A walkthrough of how to run/trigger it
> - Basic error handling so it fails loudly instead of silently
>
> I test the automation against a copy of your actual file before delivery, not a generic sample.

**Packages:**
- Basic ($15): single simple automation (one report reformatted, one merge, one recurring formula fix).
- Standard ($40): multi-step automation (e.g. pull data from one tab, transform it, output a formatted report), includes a short trigger (button or menu item).
- Premium ($90): multi-file or scheduled automation (e.g. weekly email of a summary report), plus a 15-minute call and one round of adjustment after you've used it for a week.

**FAQ:**
- *Does this work in both Excel and Google Sheets?* I build for whichever you use — tell me upfront, since VBA (Excel) and Apps Script (Sheets) aren't interchangeable.
- *Will this break if I add new columns/rows later?* I build with reasonable flexibility in mind, but structural changes to your sheet may need a quick update — ask about that separately if you expect frequent changes.
- *Do I need to install anything?* No — it lives inside your existing Excel file or Google Sheet.
- *Can this send emails or post to Slack/other tools automatically?* Often yes, for Google Sheets via Apps Script. Tell me what you need it to connect to and I'll confirm feasibility before you order.

**Search tags:** excel automation, google sheets automation, vba macro, apps script, spreadsheet automation

### Upwork proposal skeleton

> Hi [Name],
>
> [Hook referencing their specific problem — restate the exact pain point from their post in your own words, e.g. "Saw you need the pricing data from [their named source] pulled weekly instead of copy-pasting it by hand every Monday — that manual step is exactly the kind of thing I automate."]
>
> Here's how I'd approach it: [2-line plan — concrete, specific to their job, not generic]
> 1. [First concrete step, e.g. "Build a script that logs in/navigates to the pages you listed and pulls the fields you need into a clean CSV."]
> 2. [Second concrete step, e.g. "Add basic error handling so it flags a problem instead of failing silently, and hand it off with a short README."]
>
> For reference, here's a similar sample I built: [1 relevant sample — link or attach the closest-matching portfolio piece from Phase 1, and say one sentence on why it's relevant].
>
> [A question — something that shows you read the post and need one real detail to scope it precisely, e.g. "Quick question before I quote a firm price: roughly how many pages/rows are you expecting per run, and does this need to run on a schedule or just on demand?"]
>
> Happy to jump on a quick call if that's easier. Looking forward to hearing from you.
>
> [Your name]

### Delivery-note skeleton

> Hi [Client name],
>
> Here's your [scraper / cleaned dataset / automation / fix / document], delivered as [file(s)/format].
>
> What I did:
> - [Concrete summary point 1 — what was built/fixed/cleaned, in plain language]
> - [Concrete summary point 2 — any decisions you made on ambiguous points, and why]
> - [Concrete summary point 3 — anything the client should know before using it, e.g. limitations, assumptions, or edge cases]
>
> How to use it: [1-3 sentences — how to run the script, open the file, or trigger the automation]
>
> I tested this against [your actual data / a copy of your file / the live site] before sending it over. If anything's off or you'd like an adjustment within the original scope, let me know — you've got 2 free revision rounds included.
>
> Thanks for the order — happy to help again if you need this updated or extended down the line.
>
> [Your name]

### Revision-response skeleton (for scope creep)

> Hi [Client name],
>
> Glad the [deliverable] is working well for you. Happy to make [the specific in-scope adjustment they asked for] — that's a straightforward fit within the original brief, I'll have it back to you by [timeframe].
>
> On [the new/out-of-scope item they also asked for] — that goes a bit beyond what we originally scoped ([briefly restate original scope in one clause]), so I'd want to quote that separately rather than fold it into the free revisions, to keep things fair on both sides. Rough estimate would be [$X / X hours] — let me know if you'd like to move ahead with that as a separate small order, and I'll get the in-scope fix over to you either way.
>
> [Your name]
