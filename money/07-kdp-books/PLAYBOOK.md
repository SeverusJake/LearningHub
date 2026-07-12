# Playbook — KDP Books

## Phase 1 — Setup

1. **[YOU]** Create the KDP account, complete the tax interview (W-8BEN if non-US), and confirm bank transfer or Payoneer is live as your payout method — see README.md's eligibility check before doing anything else.
2. **[YOU]** Set up TRACKER.md as your running log before the first manuscript — one row per work session from day one, so Phase 3 scaling decisions have real data behind them instead of a gut feeling.
3. **[YOU]** Read KDP's current content-guidelines page end to end once, specifically the AI-content disclosure section. This is the one part of this folder that changes over time, and "I read it once last year" isn't good enough — re-check it before every publish, per README.md.

## Phase 2 — Per-book pipeline (burst: one book per weekend)

1. **Niche research (Saturday morning, 1-2 hrs).** **[AI]** researches candidate niches by searching Amazon's own store directly for a dozen candidate terms and reading what's actually on page 1: title patterns, price points, page counts, and — the critical signal — each page-1 competitor's review count and Best Sellers Rank (both visible on every product page under "Product details"). Score each candidate on the niche scoreboard below. **The core competition signal: if page-1 competitors for a specific search term mostly show fewer than 30 reviews, that's a real opening** — it means the term isn't yet owned by an entrenched bestseller with hundreds or thousands of reviews, which is close to unbeatable for a brand-new title. If every page-1 result already has 200+ reviews, drop that term and try a narrower one.

2. **Outline (Saturday, 30-60 min).** **[AI]** drafts a chapter-by-chapter outline using the outline skeleton below. Every chapter has to earn its place by solving one piece of the book's single stated problem — no filler chapters added just to hit a page-count target.

3. **Manuscript draft (Saturday afternoon-evening).** **[AI]** writes the full manuscript from the outline — 30-60 pages for a how-to ebook, or a workbook with real exercises (fill-in worksheets, prompts with actual space to respond, tracking grids) rather than decorative pages. Workbooks need genuinely usable structure: numbered pages, working cross-references, exercises that require real thought, not one line of prompt text repeated a hundred times.

4. **Self-edit pass (Saturday evening or Sunday morning).** **[AI]** reviews its own draft for factual consistency, repeated phrasing, tone drift, and structural gaps before handing it off — this catches the mechanical issues so your fact-check pass in step 5 can focus on substance instead of typos.

5. **[YOU] fact-check + voice pass against the 7 quality gates. This is the non-negotiable human step — no book skips this.** Check the manuscript against all seven gates before it moves to formatting:
   1. **Accuracy** — every factual claim, number, and named technique verified against a real source you checked yourself.
   2. **No filler chapters** — every chapter or section earns its place solving the book's one stated problem.
   3. **Real exercises in workbooks** — actual worksheets and prompts that require thought, not repeated one-liners or decorative blank space.
   4. **Correct formatting** — consistent headings, page numbers, no orphaned sections, matches KDP's formatting requirements for the format you're publishing (ebook vs. paperback).
   5. **Working table of contents** — every entry links (ebook) or points to the right page (paperback); test it, don't assume it works.
   6. **No obvious AI writing tells** — no repeated stock phrasing ("in today's fast-paced world," "it's important to note that"), no hallucinated citations, reads like someone who's actually done the thing wrote it.
   7. **Legible cover text** — title readable at thumbnail size (shrink the cover file down to the size it'll actually appear at in search results and check it there), no low-contrast text-on-image.

6. **Interior formatting.** Format the manuscript through a pandoc or Typst pipeline (Markdown source into a styled PDF/EPUB — scriptable and repeatable across the whole catalog) or KDP's own free formatting tools (Kindle Create, or the paperback manuscript template) if you'd rather not maintain a pipeline. Either way, output both an EPUB for the Kindle ebook and a print-ready PDF for the paperback, sized to KDP's current trim-size requirements.

7. **Cover.** **[AI]** drafts the cover concept — title treatment, imagery direction, color scheme — built to the exact dimensions from KDP's own cover-size calculator (kdp.amazon.com's cover calculator computes spine width from page count and trim size, which changes per book). Produce the actual file in Canva (the free tier covers this) or an AI art tool for any imagery, then apply the calculator's exact dimensions before export — a cover sized wrong gets rejected at upload.

8. **Metadata.** Fill in KDP's title/subtitle, 7 backend keywords, and category fields using the metadata worksheet below. This is what makes the book findable, and it's where the "no keyword-stuffing" rule from README.md actually gets applied in practice.

9. **[YOU] publishes.** Re-verify the current AI-generated vs. AI-assisted definitions on KDP's content-guidelines page if it's been more than a few weeks since you last checked, answer KDP's AI-content question honestly, set both formats live, and log the publish in TRACKER.md.

## Phase 3 — Scaling

A niche that clears README.md's scale bar gets built into a series: a volume 2 going deeper on the same problem, a companion workbook to a how-to book (or vice versa), or a beginner/intermediate/advanced split of the same topic. Publish every title in the series in both paperback and ebook formats — paperback captures a different buyer (gift purchases, people who prefer a physical workbook) at a different price point. Add KDP's A+ content module (extra product-page images, comparison layouts) to any title with real sales traction — it's free and it lifts conversion on the product page. Run free promo days through KDP Select, if enrolled, within its actual terms to spike downloads and generate organic reviews from real readers. **Never buy reviews, never trade reviews with other authors, never ask friends or family to post reviews without an honest "I know the author" disclosure** — Amazon actively detects and strikes review manipulation, and it can take down the whole account, not just one book.

## Templates and prompts

### Niche scoreboard

Keep a running version of this table so a niche you've already researched never gets re-scored from scratch next burst.

| Niche/search term | Page-1 avg reviews | Page-1 avg price | Page count range seen | Opening? (<30 reviews on most page-1 results) | Score (1-5) | Notes |
|---|---|---|---|---|---|---|
| "meal prep workbook for night shift nurses" | 18 | $9.99 | 40-55pp | Yes | 4 | One dominant title with 400+ reviews, rest of page 1 under 20 |
| "CDL test log book" | 12 | $7.99 | 60pp | Yes | 4 | Narrow but real search volume, low competition |
| "productivity journal" | 3,000+ | $12.99 | varies | No | 1 | Dominated by entrenched bestsellers, skip |

### Outline skeleton

> **Book:** [title] — solves [one specific problem] for [specific audience]
> **Ch 1 — Problem framing:** why this specific problem matters to this specific reader, what fails when it's left unsolved
> **Ch 2-N — one sub-problem per chapter:** each chapter solves one concrete piece of the whole problem, and ends with an exercise, worksheet, or checklist the reader actually uses
> **Ch N+1 — putting it together:** a synthesis chapter or master template that ties the individual exercises into one ongoing system
> **Appendix (optional):** reference tables, blank extra worksheets, a resource list
>
> Every chapter must pass this test: "if I deleted this chapter, would the book fail to solve its stated problem?" If no, cut it.

### 7-item quality-gate checklist

1. Accuracy — every claim verified against a real source you checked yourself.
2. No filler chapters — every section earns its place solving the one stated problem.
3. Real exercises in workbooks — actual worksheets, not decorative prompts.
4. Correct formatting — consistent headings, page numbers, no orphaned sections.
5. Working table of contents — tested, not assumed.
6. No obvious AI writing tells — no stock phrasing, no hallucinated citations.
7. Legible cover text — readable at thumbnail size, good contrast.

### Metadata worksheet

> **Title:** [clear, accurate, describes the book — no keyword stuffing]
> **Subtitle:** [adds the specific angle or audience the title didn't fit — e.g. "A 30-Day Tracking System for Night Shift Nurses"]
> **7 backend keywords:** (KDP gives 7 keyword-phrase slots; use all 7, each a real search phrase a buyer would type, none repeating words already in the title/subtitle — repeating them there wastes a slot)
> 1. [phrase]
> 2. [phrase]
> 3. [phrase]
> 4. [phrase]
> 5. [phrase]
> 6. [phrase]
> 7. [phrase]
> **3 categories:** pick from KDP's category browser — 2 that match the obvious top-level genre, and 1 narrower, lower-competition sub-category where this book could realistically rank on page 1 of that category's own bestseller list
