# 03 — Micro Tools

**Model:** Build niche paid web tools — a free tier plus a $5-15 one-time unlock or a $3-5/mo pro tier — hosted as static + serverless on Cloudflare's free tier, sold through Lemon Squeezy checkout · **First $ (typical):** 2-6wks · **Ceiling:** $50-500/mo per tool · **Payout:** Lemon Squeezy → PayPal

**AI does:** the MVP build, landing page copy, SEO content pages, and launch-post drafts (Show HN, Reddit, X) · **You do:** buy the domain, create the accounts, wire and test the Lemon Squeezy checkout, post the launches, and ship fixes from user feedback

## Honest expectations

Most micro-tools you build here will earn exactly $0 — not because the code is bad, but because nobody heard about it. Distribution beats code quality every time: a rough tool with a good Show HN post and a real audience will outearn a polished tool nobody saw. Plan on 3-5 separate tool launches before one shows real signal (repeat visits, organic signups, an actual sale) — killing the first two or three quickly is the normal path here, not a failure. SEO is a multi-month game: a content page you publish in week 2 might not rank until month 4-6, so any early revenue comes from launch spikes — Show HN, Reddit, X — not search traffic. Treat your first $10-15 sale as proof the idea has legs, not as a stable income line.

## Rules and compliance

Lemon Squeezy is merchant of record for every sale here, which means you're bound by their Acceptable Use Policy and Terms of Service — no adult content, no gambling, no deceptive billing or hidden recurring charges, no reselling someone else's SaaS without permission. Read both before your first checkout goes live. Every claim on your landing page has to be true today, not aspirational: don't advertise "monitoring" if you haven't built monitoring, and don't list a pro feature that's still unbuilt. No fake testimonials, review counts, or "X users" ticker numbers — if you have zero customers, the page says nothing about social proof rather than inventing it. If your tool stores any user data at all (email, uploaded files, saved regex/query libraries, account info), you need a real privacy policy before launch — start from a plain-language generator like Termly's or PrivacyPolicies.com's free tier, then actually edit it to match what your tool collects and how long you keep it; don't ship a generic template unread. Launch-platform etiquette is non-negotiable: on Hacker News and Reddit, disclose that you're the maker in the post itself ("I built this," not a stealth plant), read and follow each subreddit's self-promotion rules before posting (many require specific flair, a minimum account age, or a comment-to-post ratio), and never drive-by spam a link into unrelated threads or DMs.

Full compliance floor (applies to every folder in this track, no exceptions):

- No fake reviews.
- No account misrepresentation or sharing.
- No spam.
- No undisclosed AI where a platform requires disclosure.
- No trademark/IP infringement.
- No fabricated credentials.
- Income figures are ranges with no guarantee.
- Taxes are the learner's own responsibility (this is not tax advice).

## Eligibility check

Do this before writing a line of code — if payout or hosting isn't confirmed, everything after this is wasted effort.

1. Create a Lemon Squeezy account (lemonsqueezy.com) and complete their seller onboarding (identity verification, tax info).
2. In Lemon Squeezy's payout settings, confirm PayPal is actually listed as an available payout method for your country. LS supports PayPal payouts in most but not all of its supported countries — if PayPal isn't offered for you, stop and resolve that before building anything.
3. Create a Cloudflare account and confirm the Pages + Workers free-tier limits (100,000 Workers requests/day, unlimited static Pages requests/bandwidth) — that ceiling covers any single micro-tool short of a genuine viral spike, so nothing here should require a paid plan to launch.
4. Only after both are confirmed, move to Phase 1 of the playbook.

## Kill / scale criteria

**Kill a tool** if, after 6 weeks and 3 real launch attempts (e.g. Show HN plus 2 relevant subreddits, or the equivalent spread across platforms), it has under 100 total visits AND $0 in revenue. That's the bar — not "traffic feels slow." When a tool hits it, leave the site up if hosting is free, stop actively promoting it, and move the next weekend to a fresh seed idea.

**Scale a winner** (any real revenue plus repeat traffic) by building an SEO content cluster around its core keyword, shipping 1-2 adjacent features actual users asked for, and cross-linking it with your other micro-tools. A winner here is also the default candidate for the cross-track Capstone A build — see [capstones/README.md](../../capstones/README.md) — where it gets containerized, run through CI/CD, and deployed to your own Proxmox k3s cluster instead of staying on Cloudflare's free tier indefinitely.
