# 08 — SEO Affiliate Site

**Model:** A niche content site (static, self-hosted for ~$10/yr) monetized through Amazon Associates plus one or two specialized affiliate programs, built around buyer-intent posts — "best X for Y," "X vs Y," how-to guides — that rank in Google and send readers through affiliate links · **First $ (typical):** 3-6 months · **Ceiling:** $0-1000+/mo · **Payout:** varies by program (Amazon: gift card or direct deposit depending on country; specialized programs: usually PayPal or direct deposit, check each one)

**AI does:** niche research, site skeleton, the full 30-post content plan, first-draft copy for every post, on-page SEO structure, and monthly Google Search Console analysis · **You do:** buy the domain, supply real first-hand notes/screenshots/specifics from your own homelab or dev tooling for every post, fact-check and publish, submit to Search Console, and do one white-hat link-building action per month

## Honest expectations

**This is the only folder in the money track with zero realistic chance of month-1 revenue — plan on 3-6 months before the first affiliate dollar, and treat that as normal, not as a sign something's wrong.** Two things stack against fast money here. First, Google's own indexing and ranking pipeline is slow by design: a brand-new domain has no history, new pages can take days to weeks just to get crawled and indexed, and ranking improvements on top of that typically play out over months, not days — there is no way to pay or hack around this timeline on a new site. Second, the current content environment is flooded with AI-generated affiliate sites that all say the same generic things about the same generic products, and Google's ranking systems (plus readers themselves) are increasingly good at ignoring that flood. The posts that actually rank and actually convert are the ones with something a template can't fake — a real screenshot from your own rack, a specific failure you hit and how you fixed it, a benchmark you actually ran. Generic AI paraphrase of other listicles is now a losing strategy, not a shortcut.

Because of that timeline, this folder is a **background compounding bet, not your primary experiment.** Work it in the margins — a couple of hours a week, 2-3 posts published — while your active weekend energy goes toward a faster-feedback folder elsewhere in this track (01, 02, or 05/06/07 for a quicker read on whether the work is landing). If this is the only thing you're running at once, you will spend months with no income signal and no faster experiment to learn from in parallel. Run it alongside something else, always.

## Rules and compliance

- **Affiliate disclosure is required on every single page that contains an affiliate link, not just a sitewide footer notice.** The FTC requires a clear, conspicuous disclosure placed near the affiliate content itself — above the fold, before the reader hits the first link, in plain language ("This post contains affiliate links; if you buy through them I may earn a commission at no extra cost to you"). A footer-only disclosure or a vague "sponsored" badge buried in a sidebar does not meet this bar.
- **Amazon Associates: you cannot display exact prices on your site.** The Associates Operating Agreement prohibits showing static price text you typed yourself, because prices change and a stale number is misleading — use Amazon's own API-driven price display (widgets/API) if you want live pricing shown at all, or simply link out and let the price live on Amazon's page instead of on yours.
- **Amazon Associates cookie window is 180 days** for the specific item a reader clicks through to, but Amazon also uses a shorter same-session window for items added to cart — know this is not an indefinite tracking window and don't oversell it to yourself when projecting revenue.
- **Amazon Associates has a hard use-it-or-lose-it clock: 3 qualifying sales within 180 days of account approval, or the account gets closed.** This is exactly why you apply for the program only after real traffic already exists (see Eligibility check below) — applying on day one, before any post is indexed or ranking, means the 180-day clock burns down with zero visitors and the account closes before it ever had a chance.
- **No fabricated product-testing claims.** Either you genuinely tested the product yourself and say so specifically (what you ran, for how long, what broke or didn't), or the content is clearly labeled as aggregated/researched information pulled from specs, manuals, and other public sources — never imply hands-on testing that didn't happen.
- No fake reviews.
- No account misrepresentation or sharing.
- No spam (no auto-generated comment spam, no link-scheme participation, no doorway pages).
- No undisclosed AI where a platform or regulator requires disclosure — Google's guidance treats unhelpful, unedited AI content as spam-adjacent regardless of disclosure, so this isn't just a checkbox, it's a content-quality bar.
- No trademark/IP infringement (don't use a manufacturer's logo or copyrighted product photos without a license).
- No fabricated credentials (don't claim a certification, job title, or years of experience you don't have to make a review sound more authoritative).
- Income figures are ranges with no guarantee.
- Taxes are the learner's own responsibility (this is not tax advice).

## Eligibility check

Do this before writing a single post — some of it determines what programs are even viable for you before you sink time in.

1. Check Amazon Associates program availability for your country (associates.amazon.com, or your regional Amazon storefront's affiliate program page) — Amazon runs separate Associates programs per marketplace (amazon.com, .co.uk, .de, etc.) and not every country has one.
2. Confirm Amazon's supported payout method for your country from that same program page — direct deposit, Amazon gift card, or check, depending on region — so you know what "getting paid" actually looks like before you're 6 months in.
3. If Amazon Associates isn't viable in your country or category, note the alternatives by name so you're not stuck: **Impact** (impact.com) and **ShareASale** (shareasale.com) are both large affiliate networks covering thousands of merchants across tech, software, and general retail, and many individual brands (VPN providers, hosting companies, SaaS tools, hardware vendors) run **direct-to-merchant** affiliate programs you can apply to without going through Amazon at all.
4. Register the domain (~$10, any registrar — Cloudflare Registrar, Namecheap, Porkbun all work) only after steps 1-3 confirm at least one payout path is real for you.

## Kill / scale criteria

**Do not assess this folder before month 4 — assessing it earlier is assessing noise, not signal.** At month 4, with 30+ posts published, pull Google Search Console's Performance report and look at the impressions trend over the trailing 8-12 weeks:

- **Real upward trend in impressions** (even with low clicks so far): the content is getting indexed and surfaced, rankings are still maturing — keep going, don't panic about revenue yet.
- **Flat or declining impressions** at month 4: something structural is off (niche too competitive, content too thin, technical SEO issue) — spend month 4-5 diagnosing and fixing rather than just publishing more of the same into a wall.

**Kill this folder at month 6** if the impressions trend is still under roughly 500 impressions/day sitewide. That's a real ceiling signal, not bad luck — 6 months and 30+ posts is enough runway for Google to have shown its hand on whether this content and niche can rank at all.

**Scale a winning content cluster** the moment one topic area is clearly outperforming the rest (impressions, clicks, and rankings all trending up together, not just one metric). Double down there: add comparison tables, expand the pillar posts, and build small interactive tools (a cost calculator, a spec comparison widget, a compatibility checker) using the same build skills as money/03-micro-tools — this is the natural bridge from "content site" to "content site with a tool that makes it stickier and more linkable than the AI-flooded competition."
