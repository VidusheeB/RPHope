# RP Hope — Website Rebuild

## What this project is

RP Hope is a nonprofit serving people affected by retinitis pigmentosa (RP) — patients,
families, caregivers, researchers, and clinicians. Its current website is on Wix. We are
re-platforming it onto a clean, maintainable stack.

This is a **re-platform, not a total redesign.** Preserve the existing brand, spirit, and
community feel. Recreate most pages faithfully. The ONE part we are deliberately improving
is the **Genetic Insights** library (see below).

The end users include people with low vision and blindness. **Accessibility is the single
most important requirement on this project — see the Accessibility section.**

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres database + auth + admin) — for structured gene data and forms
- Vercel for deployment

Keep the architecture simple and conventional. This will be maintained by volunteers, not a
full-time engineering team. Favor clarity over cleverness. Document anything non-obvious.

### Why we're leaving Wix (rationale for the volunteer team)

Cost is not the reason — the org already pays for a Wix Business-tier plan (~$27–39/mo, needed
for the donation checkout/store), so paying for Vercel Pro (~$20/mo) + Supabase is a wash, not
a new expense. The reasons to move are:

1. **Accessibility (the dealbreaker).** Our audience has vision loss, and accessibility is the
   #1 requirement. Wix auto-generates bloated, non-semantic markup (~1.3 MB of HTML per page on
   the current site) and does not let us fully control focus order, ARIA, semantic landmarks, or
   heading structure. On hand-built Next.js we control every element. This alone justifies the move.
2. **The gene library can't be built right on Wix.** Wix's rigid CMS is what produced the
   inheritance-pattern-mislabeled-as-disease-category bug (see Genetic Insights). The current
   library is a static grid of image cards with no real filtering or search. A searchable/
   filterable 80+ gene library needs structured Postgres data + full-text search — Supabase, not Wix.
3. **Performance.** The per-page bloat disproportionately hurts users on assistive tech / slow links.
4. **Control & data portability.** On Wix the content is trapped in their CMS (which is why the
   existing content had to be scraped, not cleanly exported). Next.js + Supabase keeps data ours.

The one thing Wix did well — letting non-technical volunteers edit content by clicking — is
preserved by keeping gene/event content as DATA in Supabase, edited through the Supabase admin UI.

### Deployment / hosting

Vercel is the right host: it's first-party for Next.js (zero-config builds) and gives per-PR
preview deployments, which pair well with the `pending_review` content workflow. Note: Vercel's
free Hobby tier is non-commercial only, so an org site needs Pro. **TODO:** apply to Vercel's
nonprofit/OSS program for Pro credits before assuming the paid cost. Cloudflare Pages is the
fallback if cost becomes a hard blocker (needs the `@opennextjs/cloudflare` adapter; more setup).

## Build philosophy

- Component-based. Build a small set of reusable components (Nav, Footer, Card, GeneField,
  etc.) and compose pages from them. Do not hardcode the same layout repeatedly.
- Mobile-first and responsive.
- Content that changes often (gene data, events, research items) should be DATA, not
  hardcoded markup — so non-technical admins can edit it later without touching code.
- No `localStorage`/`sessionStorage` assumptions; use the database for persistence.

## Which pages to RECREATE faithfully vs IMPROVE

**Recreate faithfully** (match current brand, structure, and content):
- Home
- About
- Events (Spring Fundraiser, Green Cane Day)
- Search, Donate, navigation, footer

**Improve** (build the restructured version, not a clone of the current Wix page):
- Genetic Insights landing page (searchable/filterable library of genes)
- Individual gene pages

## Genetic Insights — the core capability

A searchable, filterable library of RP-related genes. Must scale to 80+ genes.

### CRITICAL data-model note

On the current Wix site, the "Disease Category" field actually contains the *inheritance
pattern* (e.g. "autosomal recessive"). These are TWO DIFFERENT THINGS and must be separate
fields. You cannot build correct filtering or gene comparison if they are merged.

### Gene data model (Postgres / Supabase)

Each gene record should include at minimum:

- `gene_name` (e.g. "INPP5E")
- `full_name` (e.g. "Inositol polyphosphate-5-phosphatase E")
- `aliases` (array)
- `inheritance_pattern` (e.g. autosomal recessive / dominant / X-linked)  ← separate field
- `disease_category` (e.g. retinal ciliopathy)                            ← separate field
- `mechanism` (biological category)
- `patient_population` (e.g. "Fewer than 20 known")
- `plain_english_summary` (text — written for non-medical readers)
- `technical_summary` (text — the deeper science, shown in an expandable section)
- `treatment_status` (text)
- `eye_health_strategies` (text)
- `clinical_trial_status` (text + link to ClinicalTrials.gov query)
- `research_institutions` (array)
- `research_items` (array of { date, title, why_it_matters, source_url })
- `sources` (array of citations)
- `last_reviewed_date`
- `reviewer`
- `status` (draft | pending_review | published)  ← see Content governance

The `status` field exists now even though the admin review UI is out of scope for the MVP.
It keeps the architecture ready for a review-before-publish workflow later.

### Gene page layout (the improved structure)

In order, top to bottom:
1. Header: gene name + full name, plus a compact "Face of RP" badge.
2. At-a-glance row: inheritance pattern, disease category, patient population, research
   institution — as SEPARATE labeled fields.
3. Plain-English summary FIRST. Technical detail goes in an expandable "deeper science"
   section below it — not at the top.
4. Status cards: treatments and clinical trials, framed as "where things stand" with the
   ClinicalTrials.gov link prominent (it's the field that updates most).
5. "Research that matters": each item has a title and a one-line plain-English reason it
   matters — not just images and dates.
6. Footer metadata: last-reviewed date, reviewer, and a medical disclaimer.

### Landing page

- Summary intro + search box + filter controls (by inheritance pattern, disease category,
  topic).
- Grid of gene cards. Each card shows gene name, inheritance pattern, category, and a short
  plain-English line.
- Filtering/search should feel instant. Use Postgres full-text search for the query.

## Content governance (important)

This is a medical/research site. The rules:
- AI and non-experts may DRAFT and RESTRUCTURE freely, but every medical/scientific CLAIM
  must be reviewed by a human before it is published.
- Do not auto-publish medical content. Default new/edited gene content to `pending_review`.
- Plain-English summaries are paraphrases and must be reviewed for accuracy.
- Verbatim source quotes keep their citations; if paraphrasing a source, preserve the
  citation link but mark it as paraphrased.
- Every gene page shows a medical disclaimer and a last-reviewed date.

## Accessibility — HARD REQUIREMENTS (the audience has vision loss)

- Target WCAG 2.1 AA at minimum; aim for AAA on contrast and text resizing where feasible.
- High color contrast throughout. Verify contrast ratios; do not rely on color alone to
  convey meaning.
- Text must resize/zoom cleanly up to at least 200% without breaking layout. Use rem units.
- Full keyboard navigation with visible focus states on every interactive element.
- Proper semantic HTML and ARIA: landmarks, headings in order, labeled form fields,
  descriptive alt text on all images, accessible names on icon-only buttons.
- Screen-reader-friendly: test that the gene library search/filter is operable and
  announced correctly.
- Respect `prefers-reduced-motion`.
- Consider a built-in text-size / high-contrast toggle.

### Read-aloud / text-to-speech (planned enhancement)

PRIORITY ORDER — get this right in sequence:
1. **Semantic HTML first.** Our primary audience (blind / low-vision) uses their own screen
   readers (VoiceOver, NVDA, JAWS). Flawless semantic markup is the real "read aloud" feature
   and matters far more than any custom button. Do this regardless.
2. **Then add an optional "Listen to this page" button** as a secondary aid for users who do
   NOT run a screen reader — mild low vision, dyslexia/cognitive needs, or aging users (RP
   progresses with age) who prefer listening to dense gene pages.

Build rules:
- Default to the **browser-native Web Speech API (`SpeechSynthesis`)** — free, client-side, no
  API keys or per-use billing, volunteer-maintainable. Cloud TTS (ElevenLabs/Google/OpenAI) is
  an optional future upgrade only if voice quality proves insufficient; do NOT add paid TTS on day one.
- **Never autoplay** audio (WCAG 1.4.2). Playback starts only on user action and must offer
  visible pause/stop.
- The control itself must be keyboard-operable with an accessible name (e.g. "Listen to this page").
- Reads the main content region; must not fight or duplicate an active screen reader.

### AI voice navigation layer (FUTURE / EXPERIMENTAL — post-MVP)

Idea: let users navigate the site by voice in plain, messy language. The AI is an
intent-to-navigation layer that makes wayfinding forgiving and context-aware — NOT a chatbot
and NOT a content generator. (This is distinct from, and supersedes, an earlier "AI Q&A over
content" idea, which was rejected because a generative medical chatbot violates content
governance. Do not build that version.)

What it does:
- User speaks a fuzzy request ("take me to my kid's gene, the recessive one starting with U").
- AI maps intent to a real page/section and navigates there, or reads the page aloud (reuses
  the read-aloud feature).

How it works:
- **Semantic search (embeddings), not keyword matching** — so a wishy-washy description with no
  matching keywords ("the thing where they fix your genes with a virus" → gene therapy) still
  routes correctly. Supabase pgvector + the existing full-text search.
- **Confidence-tiered response — never a dead end:**
  - Confident → navigate, announcing it ("Taking you to the gene therapy section").
  - Fuzzy/ambiguous → suggest + confirm ("Sounds like you might mean Future Therapies — want
    that?"), or offer 2–3 best guesses.
  - Nothing found → graceful fallback ("I'm not sure — here are the main sections"), never a
    flat "no page with those keywords."

Guardrails (these keep it inside content governance and make it safe):
- **Bound the AI to the real sitemap/route list** as its action space — it physically cannot
  navigate to or invent a page that doesn't exist.
- **AI generates navigation chatter only; page CONTENT it speaks must be verbatim from the
  published page** — never an AI summary/paraphrase (that would be unreviewed medical content).
- **Navigate, don't triage.** Map descriptions to pages; never interpret symptoms or imply a
  diagnosis. "I can't see at night" → route to info, framed as navigation, not advice.
- **Confirm consequential actions, never auto-execute** — esp. donate/forms. Hand off to the
  page; let the user act.
- **Confirm-before-navigating matters more when input is vague** — a wrong guess disorients a
  low-vision user who relies on knowing where they are.

Honest scope note: this COMPLEMENTS great semantic HTML, it does not replace it. Hardcore
screen-reader users already navigate by landmarks/headings; the real sweet spot is low-vision /
aging / lower-digital-literacy users. Must not fight an active screen reader. Voice in/out via
Web Speech API (free); intent-mapping via Claude through the Vercel AI SDK, bounded to routes.
Depends on gene data being in Supabase and reviewed first, so it lands after the core library.

## Brand tokens — [FILL IN from the real site]

Sample exact values from the live site; do not guess.

- Primary (teal/dark): [FILL IN — approx dark teal, sample exact hex]
- Accent / Donate (dark red): [FILL IN]
- Link color (blue): [FILL IN]
- Background: [FILL IN]
- Heading font: [FILL IN]
- Body font: [FILL IN]
- Logo: [provide the logo file in /public]

## Page inventory — [FILL IN]

List every page on the current site with its purpose and a reference screenshot filename:
- Home — screenshot: [FILL IN]
- About — screenshot: [FILL IN]
- Genetic Insights landing — screenshot: [FILL IN]
- Gene page (example: INPP5E) — screenshot: [FILL IN]
- Events — screenshot: [FILL IN]
- (add the rest)

## Reference assets provided

- `/reference/screenshots/` — full-page screenshots of each current page
- `/reference/content/` — the real text content of each page (use THIS for copy, not OCR)
- `/public/` — logo and brand images
