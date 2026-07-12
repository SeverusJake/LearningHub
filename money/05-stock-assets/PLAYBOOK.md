# Playbook — Stock Assets

## Phase 1 — Setup

**[YOU]** creates the Adobe Stock contributor account, submits the tax form (W-8BEN for non-US, W-9 for US), and connects PayPal as the payout method — confirmed working per the README's eligibility check.

**[AI]** researches niches by browsing Adobe Stock's own site the way a buyer would: its bestseller/trending categories, and what shows up repeatedly in top-download search results, favoring commercially-safe, no-face, no-logo territory:

- Abstract business backgrounds (gradients, geometric meshes, low-poly, particle fields — the generic backdrop every deck, landing page, and blog header needs)
- Textures (paper, fabric, wood grain, concrete, marble — flat, tileable, license-friendly surfaces)
- Seasonal and holiday themes, prepared 6-8 weeks ahead of the actual season (buyers search Christmas/Halloween/back-to-school content well before the date)
- Isolated objects on plain or transparent backgrounds (office supplies, food items, plants, tech gadgets — the "cut out and drop into any layout" category)
- Mockup-friendly flat-lays (desk setups, product-staging scenes with open negative space for a buyer to composite their own product photo onto)

**[AI]** keeps a running niche scoreboard — a simple table of niche name, assets submitted, acceptance rate, downloads, and revenue-to-date — so Phase 2's weekly review has real numbers to decide from instead of gut feel.

## Phase 2 — Operating loop (burst: one 3-4 hour session producing 40-60 assets)

1. **[AI]** builds a prompt matrix for the niche being worked that session — crossing a handful of base concepts against a handful of style treatments against a handful of colorways, so one afternoon covers real variety instead of 50 near-duplicates. See the example matrix below.
2. **[AI]** batch-generates from the matrix, then runs an upscale pass on everything that survives a first look — stock buyers expect large, sharp files, and Adobe's size requirements reward this.
3. **[YOU]** curates hard against the quality-gate checklist below. Expect to reject around half of what comes out of generation — that's the normal ratio here, not a sign the prompts were bad.
4. **[AI]** writes a title and 30-45 relevant keywords for each surviving asset, delivered in a CSV formatted for Adobe's bulk metadata upload (layout below).
5. **[YOU]** uploads the batch, applying the GenAI label to every single asset at submission (no exceptions — see README), then logs the session in TRACKER.md.
6. **Weekly:** **[YOU]** reviews which assets got accepted vs. rejected and why (Adobe gives a rejection reason per asset), **[AI]** updates the niche scoreboard from that week's numbers, and together you drop or deprioritize niches underperforming on acceptance rate or downloads.

## Phase 3 — Scaling

- Replicate proven niches across the full seasonal calendar, working 6-8 weeks ahead of each season or holiday so assets are live and indexed before buyer search volume peaks.
- For raster niches that prove out (background/texture styles that sell repeatedly), build a vector pipeline: image-trace the winning raster concepts into clean vector versions (Illustrator's Image Trace, Inkscape's Trace Bitmap, or a similar tool), since vectors reach a different buyer segment — print, large-format, editable-in-place use cases — from the same underlying concept.
- Consider a second platform only after independently verifying its current GenAI policy. Do not assume Shutterstock, Getty, or any other marketplace treats GenAI content the way Adobe does — their acceptance rules, labeling requirements, and even outright bans on AI content vary and change.

## Templates and prompts

### Example prompt matrix — "abstract business backgrounds" niche

| Base concept | Style treatment | Colorway | Example resulting prompt |
|---|---|---|---|
| Flowing wave mesh | Low-poly 3D render | Corporate blue/teal | "abstract low-poly geometric wave mesh, corporate blue and teal gradient, smooth flowing 3D shapes, soft studio lighting, wide empty copy space, no text, no logos, no people" |
| Flowing wave mesh | Soft watercolor texture | Warm autumn (rust/orange) | "abstract flowing wave shapes rendered as soft watercolor texture, warm autumn rust and orange tones, gentle paper-grain texture, wide empty copy space, no text, no logos, no people" |
| Geometric grid | Minimal line-art | Monochrome grayscale | "minimal abstract geometric grid pattern, thin line art, monochrome grayscale, clean negative space, no text, no logos, no people" |
| Geometric grid | Glossy 3D glass | Pastel pink/lavender | "abstract geometric grid of glossy glass panels, 3D render, soft pastel pink and lavender lighting, clean negative space, no text, no logos, no people" |
| Bokeh particle field | Photographic-style soft-focus render | Gold/black premium | "abstract bokeh particle field, soft-focus photographic render, premium gold and black color palette, dark background with wide copy space, no text, no logos, no people" |
| Bokeh particle field | Flat vector | Teal/white clean | "abstract bokeh-inspired flat vector illustration, clean teal and white palette, simple circular shapes, wide empty copy space, no text, no logos, no people" |

Cross each base concept against every style and colorway you're stocking that session — a 3x3x3 matrix (3 concepts, 3 styles, 3 colorways) alone gives 27 distinct prompts, comfortably covering a 40-60 asset session once you generate 2-3 variations per prompt.

### Metadata CSV layout (for Adobe's bulk metadata upload)

| Filename | Title | Keywords (comma-separated, 30-45) | Category |
|---|---|---|---|
| absbg-wave-001.jpg | Abstract flowing blue and teal geometric wave background | abstract, background, wave, geometric, blue, teal, corporate, business, technology, gradient, modern, digital, texture, design, backdrop, copy space, template, minimal, futuristic, smooth, banner, wallpaper, presentation, website, header, clean, style, concept, art, pattern | Backgrounds/Textures |

Note: the GenAI label itself is **not** a CSV field — it's a toggle you set per-asset in the contributor portal at the point of submission. The CSV speeds up titles, keywords, and category; the label still has to be set by hand (or via whatever bulk-labeling control the portal offers) every single time, so don't let a fast CSV workflow become the reason a label gets skipped.

### Quality-gate checklist (reject if any of these fail)

- No mangled, fused, or extra fingers/hands anywhere in frame — crop tighter or reject, don't try to "fix" it with more upscaling.
- No garbled pseudo-text, watermark-shaped artifacts, or hallucinated logo-like blobs anywhere in the image.
- No recognizable faces or human likenesses, even partial, blurred, or stylized — if a face is visible, reject it outright.
- No warped horizons, impossible shadows/reflections, or geometry that breaks under a close zoom-in.
- Composition includes genuine negative/copy space a buyer could actually drop text or a product mockup into.
- Passes a 100% zoom sharpness check — no upscale ringing, smearing, or noise at the edges.
- No trademarked shapes, brand-recognizable logos, or leftover "in the style of [artist/brand]" signatures from the prompt.
- Title and keywords actually describe what's in the image — no keyword-stuffing terms that don't match the visual content.
