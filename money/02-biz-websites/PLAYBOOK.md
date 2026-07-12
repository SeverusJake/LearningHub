# Playbook — Biz Websites

## Phase 1 — Setup (once)

**Vertical + city criteria ([AI]).** Default vertical: local plumbers. (Same playbook works for electricians, landscapers, or dentists — swap the vertical and re-run this phase if plumbers dry up.) City criteria: pick 1-2 English-speaking metro areas or regions you can credibly reference — your own region is easiest since local knowledge makes outreach sound genuine, not templated. Pick a metro large enough to have 50+ independent (non-franchise) businesses in the vertical, so you don't run out of prospects before hitting the 150-contact kill bar.

**3 demo sites ([AI]).** Build 3 static demo sites for fictional plumbing businesses (e.g., "Riverside Plumbing Co.", "Northgate Drain & Pipe", "Clearflow Plumbing Services"). Each site: 1-3 pages (Home, Services, Contact), mobile-first responsive, sub-2-second mobile load. Each must include: business name, click-to-call phone number, service list, service-area text, a contact form or mailto link, and a footer clearly marked as a demo (e.g. "Demo site for portfolio purposes — not a real business"). Deploy all 3 free on Cloudflare Pages, either as subdomains of your one portfolio domain or on their default pages.dev URLs until the domain is bought. These 3 links go into every outreach email as proof of work.

**3-email outreach sequence ([AI], full skeletons below).** See "Templates and prompts."

**Domain + PayPal ([YOU]).** Buy 1 portfolio domain (~$10/yr — Cloudflare Registrar or Namecheap both work) to host the 3 demo sites. Set up PayPal Business invoicing (paypal.com → Business tools → Invoicing) so you can send itemized invoices for deposits and final payments.

## Phase 2 — Operating loop (daily · 60 min)

**Research 10 prospects/day ([AI]).** Search Google Maps for "[vertical] near [city]" and manually scan the first 30-40 results, one listing at a time — this is a by-hand review, not a scraper pulling bulk contact lists. Open each listing's linked website (if any) at phone width. Flag a business as a prospect if it has no website, a broken/parked-domain page, or a site that isn't mobile-friendly (text too small without zooming, buttons that need pinch-zoom, or a horizontal scrollbar on a phone-width screen). For each of the 10, record: business name, phone/email found on their own listing or site, and the one specific problem you spotted.

**Draft Email 1 for each of the 10 ([AI]).** Fill the sequence skeleton with the business name and the specific observation from research.

**Verify and send ([YOU]).** Check each draft against the real business (right name, right observation, right demo link), then send all 10 yourself from your own real email address — this step can't be done by AI, since it needs your outbox and your identity as the sender. Log every send in TRACKER.md (date, business, contact info, which step in the sequence).

**Follow-ups ([AI]).** For any prospect with no reply, AI drafts the Day-4 follow-up and, later, the Day-10 follow-up from the sequence. You verify and send both the same way as Email 1.

**On reply ([AI] drafts, [YOU] closes).** AI drafts a reply plus a 1-page proposal PDF (scope, price, timeline, inclusions/exclusions — skeleton below). Close on a call or by email using the 1-page agreement skeleton below (plain-English work agreement between two small businesses, not legal advice — for anything beyond a small flat-fee site, have a real contract reviewed). Send a PayPal invoice for a 50% deposit before any build work starts.

**Delivery ([AI] builds, [YOU] reviews).** AI builds the site in one day or less once the deposit clears. You review the build against the proposal/agreement before showing the client. Client gets exactly one revision round (as specified in the agreement) — further changes are billed separately. Launch on the client's own domain (point their DNS at the new host, or deploy directly if they've given you access). Send the final invoice for the remaining balance once the client has approved the live site.

## Phase 3 — Scaling

Offer every delivered client the $20-30/mo care plan (content updates, uptime/hosting management, one small change per month) at delivery — that's when trust is highest, not as a separate cold pitch weeks later. Ask every client for one referral at handoff: "do you know another [vertical] business owner who could use something like this?" — referred leads close far more often than cold outreach and cost nothing to generate. After 5 delivered sites, raise your flat price to $500+ for new prospects — your portfolio is no longer 3 fictional demos, it's 5 real local businesses, and that's worth charging for.

## Templates and prompts

### Outreach sequence (3 emails, full skeletons)

**Email 1 — Day 0 (observation + fix + demo)**

```
Subject: quick fix for [Business Name]'s site

Hi [First Name],

I was looking up [vertical] in [City] and noticed [Business Name]
[specific observation — e.g. "doesn't have a website come up" / "your
site isn't readable on a phone — the number's too small to tap" /
"your site still shows a placeholder launch page"]. That's probably costing
you calls from people searching on their phones.

I put together a quick example of what a fast, mobile-friendly site
could look like for a business like yours: [demo link]

If you'd want something like this for [Business Name] — built in a
day, $200-500 flat, you own the domain — just reply and I'll send
details.

[Your Name]
[Your Phone / Email]
Reply STOP to opt out of future emails.
```

**Email 2 — Day 4 (follow-up, no guilt-trip)**

```
Subject: re: quick fix for [Business Name]'s site

Hi [First Name],

Following up in case my last note got buried. Here's that example
site again: [demo link]

Happy to answer questions or send a price breakdown if useful — no
pressure either way.

[Your Name]
Reply STOP to opt out.
```

**Email 3 — Day 10 (final, low-key close)**

```
Subject: last note from me — [Business Name]

Hi [First Name],

I'll leave this as my last email — didn't want to keep filling your
inbox. If a fast, mobile-friendly site is something you want down the
line, I'm at [Email / Phone] and the example is still live here:
[demo link]

Either way, good luck with the business.

[Your Name]
Reply STOP to opt out.
```

### Proposal skeleton (1-page PDF)

```
PROPOSAL — [Business Name] Website
Prepared by [Your Name] · [Date]

What you get:
- [1-3]-page website (Home, Services, Contact): mobile-first, fast-
  loading, built to display correctly on phones
- Click-to-call phone number, service area, service list, contact form
- Deployed live on your own domain
- 1 round of revisions included after the first draft

Timeline: first draft within 1 business day of deposit; live within
[X] business days of your final approval.

Price: $[200-500] flat, due as:
- 50% deposit ($[X]) before work starts
- 50% balance ($[X]) on approval, before launch

Optional ongoing care plan: $[20-30]/mo — small content updates,
hosting/uptime management, one revision per month. No commitment,
cancel anytime.

Not included: copywriting beyond what you provide, e-commerce or
booking systems, logo design, paid ads.

To proceed: reply to confirm and I'll send a PayPal invoice for the
deposit.
```

### Simple agreement skeleton (plain language — not legal advice)

```
WORK AGREEMENT — [Business Name] Website
Between [Your Name/Business] ("Developer") and [Client Business Name]
("Client")

1. Scope: Developer builds a [1-3]-page website per the proposal
   dated [date].
2. Price: $[total], 50% deposit before work starts, 50% balance
   before launch.
3. Timeline: first draft within 1 business day of deposit clearing;
   launch within [X] business days of Client's written approval.
4. Revisions: Client gets 1 round of revisions on the initial draft.
   Further changes are billed separately at $[rate]/hr or per request.
5. Content: Client provides logo, photos, and text within [X] days
   of deposit, or Developer proceeds with placeholder content, which
   may delay launch.
6. Ownership: Client owns the final site files and domain once paid
   in full. Developer is not responsible for ongoing hosting/domain
   costs unless covered by a separate care plan.
7. Cancellation: Deposit is non-refundable once work has started;
   Client may cancel before work starts for a full refund.
8. This is a plain-language agreement between two small businesses,
   not legal advice — for larger or ongoing engagements, have a
   lawyer review your agreement.

Signed: _______________ (Developer)   _______________ (Client)
Date: _______
```

### Delivery checklist

- [ ] Site matches the proposal exactly (page count, features, content sections)
- [ ] Fully readable and tappable on an actual phone (not just a resized desktop browser)
- [ ] Click-to-call number works and dials the correct number
- [ ] Contact form or mailto link actually delivers to the client's real inbox — test it
- [ ] No lorem-ipsum or demo/placeholder text left anywhere live
- [ ] Client's business name, address, hours, and service area are accurate
- [ ] Site is live on the client's own domain, not your portfolio subdomain
- [ ] Client has used their one revision round (or confirmed they don't need it) before final invoice
- [ ] Final invoice sent and confirmed received before the job is considered closed
- [ ] Client asked for a referral and offered the $20-30/mo care plan
