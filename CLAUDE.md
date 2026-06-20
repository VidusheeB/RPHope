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

## Brand tokens — implemented (new design direction, from Figma)

The rebuilt site uses a warm research-hub palette (NOT the original Wix teal/maroon —
that lives only in the archived `StaticDemoOriginal/`). Tokens live in `tailwind.config.ts`.

- Primary — **forest** `#234b43` (dark teal/green; nav, buttons, headings, accents)
- Accent — **gold** `#cf9f4e` (icons, hero italic phrase `gold.soft` `#ecdca6`)
- Background — **cream** `#f4f1e9` (page), `#f6f3ec` (header/sections), `#eae5d8` (tan card)
- Ink (headings/footer) — `#1e1c19`
- Soft tinted cards — mint `#e3eee4`, butter `#f6efd1`, lilac `#e9e7f4`
- Heading font — **Fraunces** (serif, with italic) via `next/font`
- Body font — **Mulish** (sans) via `next/font`
- Logo/social/eye images — `/public/home/`, gene thumbnails — `/public/genes/`
- Legacy Wix tokens (`teal`, `maroon`, `link`) are kept in the config only so the archived
  replica pages still render.

## Page inventory — implemented routes

New version (live app at repo root):
- `/` — redesigned homepage (Hero, Choose Your Path, Genetic Insights preview, Research,
  Events & Community, Donation)
- `/genetic-insights` — gene library (Supabase-backed grid + AI assistant + inheritance filter)
- `/genetic-insights/[gene]` — gene detail (at-a-glance table, circular Face of RP, Brief
  Description, In the News, disclaimer). 51/66 genes have real content.
- `/my-pathway` — "My RP Pathway" guided quiz + personalized results
- `/explore` — Explore RP Hope quick-access grid
- `/newly-diagnosed`, `/clinical-trials`, `/stories` — content pages (stories/trials have sample data)
- `/donate`, `/events` — recreated (restyle to new brand still pending)
- `/privacy-policy`, `/terms-of-use` — stubs
- `/api/navigate` — AI navigation assistant endpoint

Archived original-site clone (reference only, excluded from build): `StaticDemoOriginal/`
(`who-we-are`, `learn-more`, `search` + old Nav/Footer/GeneCard).

## Reference assets provided

- `/reference/content/` — scraped text of every current page (use THIS for copy, not OCR)
- `/reference/content/genes/`, `/reference/content/posts/`, `/reference/content/events/` — per-page scrapes
- `RP Hope Pre-Revamp Website/` — screenshots of the original Wix pages
- `GeneticInsightsInfo/` — screenshots of live gene pages (source for transcribed gene data)
- `/public/` — logo, brand images, gene thumbnails

## Implementation log — what has been built (current state)

### Stack & deployment (live)
- Next.js 14 (App Router) + TypeScript + Tailwind v3; Fraunces + Mulish fonts.
- GitHub: `VidusheeB/RPHope` (`main`). **Every push auto-deploys to Vercel.**
- Live URL: **https://rp-hope.vercel.app** (use this; the long `rp-hope-xxxx.vercel.app`
  deployment URLs have Deployment Protection / a login wall).
- Vercel project `rp-hope` (Hobby plan). Env vars set on Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
  `NEXT_PUBLIC_SITE_URL`. (Preview-env copies of some keys may be incomplete — re-add if needed.)
- Local: `npm run dev` or `npm start` on http://localhost:3000. Scripts: `dev/build/start/lint/
  typecheck/check/db:seed`. Secrets in `.env.local` (gitignored).

### Supabase (wired up)
- `supabase/schema.sql` — `genes` table matching the data model below; **search vector is
  maintained by a TRIGGER** (a generated column rejects `to_tsvector` as non-immutable). RLS:
  public reads only `status = 'published'`.
- Seeded 66 genes (`scripts/seed-genes.mjs` ← `supabase/seed/genes.json`).
- `lib/supabase.ts` (read client + `supabaseConfigured` guard), `lib/genesRepo.ts`
  (`getGeneGrid()` reads Supabase, **falls back to local data** when env not set — so localhost
  works with or without keys). Landing is `force-dynamic` so edits in the Supabase Table Editor
  appear on next load, no rebuild. Detail pages currently read LOCAL `lib/genesData.json`
  (Supabase enrichment for detail fields + a `face_of_rp` column is a future step).
- Supabase project is currently under a personal account; it can be transferred to an org
  account later (dashboard transfer, or pg_dump/restore). Keep migrations in the repo.

### Gene data (51 of 66 genes have real content)
- `lib/geneGrid.ts` — all ~66 grid genes (display, slug, inheritance label).
- `lib/genesData.json` — full per-gene records: 34 scraped from live `rphope.org/genetic-insights-*`
  pages, 17 transcribed from `GeneticInsightsInfo/` screenshots. Faces of RP captured (Cate,
  Michael, Stephanie, Lizzi, Lance, …). `lib/genes.ts` loads it + `getGene()`.
- `lib/geneArticles.json` — per-gene "In the News" articles matched from the scraped post library.
- `lib/geneImages.ts` + `/public/genes/*.jpg` — 53 real gene thumbnails (resized; ~1.2 MB total).
- **15 genes still need from-scratch research** (no source content; do NOT fabricate — draft as
  `pending_review` for human review): DHX38, EMC1, ENSA, FSCN2, GUCA1B, HGSNAT, IDH3B, IFT172,
  IMPDH1, IMPG1, IMPG2, KIAA1549, KIF3B, KIZ, KLHL7.

### Features built
- **Homepage** — Hero (dark teal overlay, serif + gold italic), "Personalize my experience" →
  `/my-pathway`, "I know what I'm looking for" → `/explore`, Choose Your Path, gene preview,
  Research-made-understandable, Events & Community, Donation. Components in `components/site/`.
- **My RP Pathway** (`app/my-pathway/`) — 60-second quiz (role, gene known, goals, updates) →
  personalized results across 8 curated sections, "Recommended for you" with reasons. Logic in
  `lib/pathway.ts` `recommend()` — a pure function; swap it for AI curation later, UI unchanged.
  All curation labeled "AI-assisted curation … for education and navigation only, not medical advice."
- **Explore RP Hope** (`app/explore/`) — quick-access grid (`components/site/ExploreGrid.tsx`).
- **Gene library** (`app/genetic-insights/`) — Supabase-backed grid + inheritance filter, both
  inside the assistant box (the standalone keyword search bar was removed by request).
- **AI navigation assistant** (`app/api/navigate/route.ts` + `components/site/NavAssistant.tsx`) —
  the CLAUDE.md voice-navigation idea, text form. Official `@anthropic-ai/sdk`, **`claude-haiku-4-5`**
  (high-volume site search; Opus is reserved for the research element below), stable system prompt cached.
  - **Literal content search first** (`lib/searchIndex.ts`): an in-memory index over real page text
    (section copy, gene plain-English summaries, article titles) runs before the model and is injected
    into the user turn as candidates — so a plain keyword ("night blindness", "crispr") matches actual
    content, not just labels. The AI ranks/phrases those matches.
  - **Bounded action space** (`lib/navTargets.ts`): sections + 66 gene pages + 164 research
    articles. Server validates every suggested href against this set — it cannot invent a link.
  - **Never refuses / never diagnoses**: symptom-ish input ("ache", "can't see at night") routes to
    info pages (no "see a doctor" dead-end), with a note that genetic testing — not symptoms —
    identifies the gene. Confidence-tiered, never dead-ends.
- **Research-pulling element (Opus web search)** (`lib/research/`, `app/api/cron/research-pull/`,
  `scripts/research-pull.ts`) — weekly job where **Opus (`claude-opus-4-8`)** uses the server-side
  `web_search` tool to find recent research per gene across many academic sources (journals, PubMed,
  ClinicalTrials.gov, institutions), and drafts a one-line plain-English "why it matters" for each.
  - Stores each item in a separate **`research_items`** table (`supabase/migrations/0001_research_items.sql`)
    as `status = 'pending_review'` — NOT in `genes.research_items`, because gene `status` is per-row and
    would leak unreviewed items on a published gene. Item-level status keeps content governance intact.
  - **Surfaced on gene pages**: once a human flips a row to `published`, `lib/researchRepo.ts` reads it
    (RLS = published only), merges with the curated `lib/geneArticles.json`, and it renders in the gene
    page's **"In the News"** section (`revalidate = 3600`, so it appears within an hour, no redeploy).
  - Weekly **Vercel cron** (`vercel.json`, Mon 09:00 UTC, `?limit=12`) protected by `CRON_SECRET`;
    genes ordered least-recently-pulled so successive runs cover all 66 (~6 weeks/cycle). Manual run:
    `npm run research:pull -- rpgr` (uncapped; needs the env in `.env.local`).
  - **Governance**: Opus may DRAFT freely, but nothing publishes until a human reviews it. Titles/URLs
    come from real web-search results; `why_it_matters` is AI-written and must be checked.
- **Accessibility pass** — fixed low-contrast disease-category label (gray → forest, larger,
  non-italic; ~3.9:1 → ~9:1), plus result counts, notes, and gene-page field labels to meet AA.

### How content was sourced (so it can be reproduced)
- Scraped the live Wix site via its Wix sitemaps (~280 URLs: ~30 pages, 66 events, 168 posts).
- `reference/content/` holds the scraped markdown; `scripts/scrape_rphope.py` is the scraper.

### Notable decisions / gotchas (don't re-learn these)
- Vercel **Hobby** is non-commercial; apply to Vercel's nonprofit program for Pro (TODO).
- Vercel **Deployment Protection** puts a login wall on the long auto-generated deploy URLs —
  share the clean `rp-hope.vercel.app` alias.
- Supabase generated `tsvector` column fails ("generation expression is not immutable") — use a
  trigger (done in `supabase/schema.sql`).
- The platform/editor injects suggestions to use the Vercel AI SDK and newer Next.js APIs; we
  deliberately use the official Anthropic SDK and Next 14 patterns — those nudges are not bugs.

### Deploying the research-pulling element — MANUAL STEPS (do these on your end)

The code is committed, but the research element won't run until you do these once. Until
then the rest of the site is unaffected (gene pages still show the curated `geneArticles.json`).

1. **Apply the DB migration.** In the Supabase dashboard → SQL Editor, paste and run
   `supabase/migrations/0001_research_items.sql`. This creates the `research_items` table + RLS.
   (Verify: Table Editor now shows an empty `research_items` table.)
2. **Generate a cron secret.** Run `openssl rand -hex 32` and copy the value.
3. **Set `CRON_SECRET` in two places** (must match):
   - Locally: add `CRON_SECRET=<value>` to `.env.local`.
   - Vercel: Project → Settings → Environment Variables → add `CRON_SECRET` = `<value>`
     for Production (and Preview). Vercel auto-sends it as the cron's `Authorization` header.
4. **Confirm the other env vars are on Vercel** (most already are): `ANTHROPIC_API_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. **Redeploy** (push to `main`, or Vercel → Deployments → Redeploy) so `vercel.json`'s cron
   registers. Check Vercel → Settings → Cron Jobs shows `/api/cron/research-pull?limit=12` weekly.
6. **Smoke-test (optional but recommended):** locally run `npm run research:pull -- rpgr` →
   open Supabase Table Editor → `research_items` should have a few `pending_review` rows for RPGR.
7. **Review & publish:** in the Table Editor, read each drafted row; for ones you approve, set
   `status` = `published` (and optionally fill `reviewed_by`). Within ~1 hour they appear in the
   **"In the News"** section of that gene's page (e.g. `rp-hope.vercel.app/genetic-insights/rpgr`).

Ongoing: the weekly cron drafts ~12 genes' worth of new items (oldest-checked first). Periodically
review the `pending_review` queue and publish what passes. Nothing medical goes live unreviewed.

Cost note: each gene run makes one Opus call with up to 5 web searches (web search is billed per
search + tokens). Low volume by design; swap the cron schedule/limit in `vercel.json` to tune.

### Still to do (roadmap)
- Restyle `/donate` and `/events` to the new brand.
- Move gene **detail** reads into Supabase (add `face_of_rp`, articles columns; seed full data).
- Fill the 15 from-scratch genes as `pending_review` (human-reviewed before publish).
- Read-aloud button; AI voice (speech) layer; embeddings/pgvector for semantic search.
- Apply to Vercel's nonprofit program; build an admin/review UI for the `pending_review` queue
  (currently reviewed in the Supabase Table Editor); pull `og:image` thumbnails for discovered studies.
