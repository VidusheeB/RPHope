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

### Read-aloud / text-to-speech — BUILT

PRIORITY ORDER — still the rule:
1. **Semantic HTML first.** Our primary audience (blind / low-vision) uses their own screen
   readers (VoiceOver, NVDA, JAWS). Flawless semantic markup is the real "read aloud" feature
   and matters far more than any custom button. Do this regardless.
2. **Then the optional "Listen to this page" button** as a secondary aid for users who do
   NOT run a screen reader — mild low vision, dyslexia/cognitive needs, or aging users (RP
   progresses with age) who prefer listening to dense gene pages.

Build rules (as implemented — see `lib/speech.ts`, `components/site/ListenButton.tsx`):
- **OpenAI TTS is the sole engine**: `/api/tts` → `gpt-4o-mini-tts`, voice **`coral`**. There is
  **no browser Web Speech / `SpeechSynthesis` fallback**. Playback is just an `<audio>` element.
  - ⚠️ This **supersedes the original rule** ("default to the free browser Web Speech API; do NOT
    add paid TTS on day one"). The owner accepted per-use TTS billing for materially better voice
    quality. `gpt-4o-mini-tts` takes an `instructions` field that steers delivery — currently warm
    and calm, with gene symbols read letter by letter.
- Needs `OPENAI_API_KEY`. Without it `/api/tts` returns 501 and its `GET` probe reports
  `{ available: false }`, so the button **hides itself** rather than showing a dead control.
- **Never autoplay** audio (WCAG 1.4.2). Playback starts only on user action, with visible
  Pause / Resume / Stop.
- Keyboard-operable with an accessible name ("Listen to this page").
- Reads the main content region; must not fight or duplicate an active screen reader.

### Voice assistant — BUILT (OpenAI Realtime over WebRTC)

**Read this before touching the voice code.** What shipped is materially different from the
"navigation-only, verbatim-only" design this file originally specified. The original section said
the assistant must be an intent-to-navigation layer, "NOT a chatbot and NOT a content generator,"
and that page content it speaks must be verbatim. **That is no longer accurate** — after repeated
owner iteration it became a genuinely conversational, reasoning assistant. What replaced the
verbatim rule as the safety mechanism is **retrieval grounding**: it can only speak from reviewed
RP Hope content that it retrieves, and it cannot invent facts or links. See Governance below.

**Stack** — `@openai/agents/realtime` SDK. The `RealtimeSession` runs **client-side over WebRTC**;
the server only mints a short-lived ephemeral token, so `OPENAI_API_KEY` never reaches the browser.
- Model **`gpt-realtime-2.1`**, voice **`marin`**, input transcription `gpt-4o-mini-transcribe`
  (`lib/voice/agent.ts` — the single source for model/voice/session config).
- Session config: audio-only output, `reasoning.effort: "medium"`, parallel tool calls, and
  **`semantic_vad` turn detection with `interruptResponse: true`** — barge-in is handled by the
  model's VAD, so the user can just start talking to interrupt. No client-side echo/word filtering.

**Flow — there is NO wake phrase.** A launcher button "**Talk to RP Hope**" (bottom-right, mic
icon) opens the panel; inside, the user presses "**Start conversation**" and simply talks. The mic
is **never** activated automatically — a session only starts on that explicit action. Status is
surfaced as Ready / Connecting / Listening / Thinking / Speaking / Microphone muted / error.
Escape interrupts speech, then closes the panel.

**Tools** (`lib/voice/tools.ts` — Zod-typed, all execute in the browser):
`search_rp_hope`, `get_current_page_context`, `list_current_page_sections`, `read_page_section`,
`navigate_to_page`, `go_back`, `scroll_to_section`, `set_accessibility_preferences`, `ask_rp_expert`.
- **Knowledge/retrieval** (`lib/knowledge/`): `records.ts` (the reviewed content), `search.ts`
  (hybrid keyword/phrase/prefix/fuzzy retrieval via **MiniSearch**, boosting titles, headings, gene
  symbols and the page the user is on), `synonyms.ts` (query expansion). Runs **both** client-side
  (bundled in-memory index) and server-side — **no DB and no API key needed**, so this is the
  pgvector alternative; only reach for embeddings if the library outgrows it.
- **Bounded navigation** (`lib/voice/navigationRegistry.ts`): a strict internal route allowlist —
  the assistant physically cannot open a route that doesn't exist. This guardrail survives intact.
- **`ask_rp_expert`** → `/api/openai/rp-expert`: a server-side reasoner (**`gpt-5.4`**) for
  questions needing synthesis. It retrieves reviewed excerpts, passes **only those + the question**,
  and returns structured JSON. Sources are mapped back from the retrieved excerpts, so **returned
  links are always real** — the model cannot invent a URL. It marks answers as evidence vs.
  inference (`isSuggestion`) with a confidence level.
- **Accessibility control by voice** (`lib/voice/accessibilityPreferences.ts`): "make the text
  bigger", "turn on high contrast" — persisted to localStorage.

**Editable personality:** `lib/voice/agentInstructions.ts` (`ASSISTANT_INSTRUCTIONS`) is the single
source of truth for tone and boundaries — edit the prose, next session picks it up.

**Governance (the deliberate shift):** the assistant reasons and speaks in its own words rather
than reading verbatim. What keeps that defensible: it is instructed to call `search_rp_hope` before
any factual answer and to **never invent website content**; `rp-expert` is hard-bound to retrieved
reviewed excerpts and real source links; navigation is allowlisted; and the medical boundary holds —
**no diagnosis, no prescribing, no eligibility guarantees**; trials are always framed as options to
review, with clinician/genetic-counselor handoff.

**Browser support:** WebRTC + `getUserMedia` — works in Chrome, Edge, Safari **and Firefox**. (The
old "Chrome/Edge only, unsupported in Firefox" note was a Web Speech API limitation and no longer
applies.) Requires a secure context (https or localhost).

**Rate limiting:** `lib/voice/rateLimit.ts` — in-memory, per server instance, best-effort
(prototype-grade); `/api/openai/realtime-token` allows 20 sessions/min per client.

Honest scope note (still true): this COMPLEMENTS great semantic HTML, it does not replace it.
Hardcore screen-reader users already navigate by landmarks/headings; the sweet spot is low-vision /
aging / lower-digital-literacy users. It must not fight an active screen reader.

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
- `/my-pathway` — "My RP Pathway" — a guided **journey** ("Your RP Hope Journey"): a 7-question
  quiz builds an ordered website tour (Start here → next stops → optional stops), not a
  recommendation grid. In the primary nav (replaced "Newly Diagnosed"). See feature note below.
- `/explore` — Explore RP Hope quick-access grid
- `/clinical-trials` — **Clinical Trials Finder**: guided global intake quiz → live ClinicalTrials.gov
  results, AI-classified as "may be relevant to review" (never eligibility). See feature note below.
- `/newly-diagnosed`, `/stories` — content pages (stories has sample data)
- `/what-is-rp-hope` — intro explainer (org mission/vision/audience; drawn from `/who-we-are` copy)
- `/what-is-rp` — educational RP explainer (sourced from NEI + MedlinePlus, cited)
- `/what-is-a-clinical-trial` — educational trials explainer (phases, statuses, "may be relevant to
  review" framing; sourced from ClinicalTrials.gov + FDA, cited)
  - ⚠️ The last two contain medical/scientific claims summarized from outside sources. They carry an
    educational disclaimer + last-reviewed date + citations (`components/site/ExplainerNotes.tsx`),
    but per content governance **a human should verify the wording** before treating them as final.
- `/stories` — curated external stories + first-party RP-Hope-hosted stories (Supabase-backed)
- `/stories/[id]` — a single published, RP-Hope-hosted story
- `/share-your-story` — story submission flow (how it works → private info →
  public content & story input → review → submit)
- `/stories/approve/[token]` — token-gated, unauthenticated page for a
  submitter to approve or request changes to their edited draft
- `/review/stories`, `/review/stories/[id]` — reviewer dashboard for story
  submissions (separate, lightweight pipeline — see below)
- `/donate` — recreated (restyle to new brand still pending)
- `/events` — **live from Wix Events** (see "Events — Wix Events integration" below); no longer a
  hardcoded list
- `/events/[slug]` — event detail + RP Hope-branded RSVP form written straight into Wix
- `/privacy-policy`, `/terms-of-use` — stubs
- `/review`, `/review/admin`, `/review/login|set-password|reset-password` — reviewer dashboard
  (auth-gated, `noindex`; see roadmap note)
- `/api/navigate` — bounded text nav assistant, used by `NavAssistant` inside the **gene library**
  (`app/genetic-insights/GeneLibrary.tsx`), backed by `lib/searchIndex.ts` + `lib/navTargets.ts`
- `/api/trials/match` — Clinical Trials Finder matcher (normalize → CT.gov fetch → safety gates →
  Opus relevance classify → rank/group). Opus; deterministic fallback when no key.
- `/api/openai/realtime-token` — mints the ephemeral WebRTC token for the **voice assistant**
  (`gpt-realtime-2.1`); the API key never leaves the server. See the voice section above.
- `/api/openai/rp-expert` — server-side expert reasoner (**`gpt-5.4`**) behind the voice
  assistant's `ask_rp_expert` tool; answers only from retrieved reviewed excerpts.
- `/api/tts` — OpenAI text-to-speech (`gpt-4o-mini-tts`, voice `coral`) behind "Listen to this page".
- `/api/cron/research-pull` — Opus web-search research drafts; **manual only** (no `vercel.json` cron
  currently — see Implementation log)
- `/api/stories/submit` — inserts a story as `pending_review`, sends the "received" + reviewer-notification emails.
- `/api/stories/upload-video` — mints a Supabase Storage signed UPLOAD url/token (private `story-videos`
  bucket) so a multi-minute video uploads directly from the browser, never through this function's own
  request body (Vercel's body-size limit would reject it otherwise).
- `/api/transcribe` — generic OpenAI transcription (`gpt-4o-mini-transcribe`, same model the voice
  assistant already uses for input transcription), accepts either a multipart audio clip or
  `{ videoPath }` (fetched server-side from Storage). Not story-specific; reusable elsewhere.
- `/api/stories/synthesize` — cleans up a dictated/typed draft (`gpt-5.4`, `reasoning_effort: "medium"`,
  same call shape as `/api/openai/rp-expert`): removes filler words, light grammar only, preserves the
  submitter's own wording.
- `/api/events/[eventId]/register` — creates an RSVP in **Wix Events**. Re-reads the event's live
  state and question set from Wix before writing, so a stale tab can't register into a closed event.

> **Note:** `/api/assistant` and `/api/explain` (the old Anthropic-powered voice brain and the
> per-gene simplify/analogy endpoint) **have been deleted**. The voice assistant now runs on OpenAI
> Realtime — see "Voice assistant — BUILT" above.

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
- **My RP Pathway → "Your RP Hope Journey"** (`app/my-pathway/`, `components/site/PathwayJourney.tsx`
  + `PathwayStopCard.tsx`) — rebuilt from a recommendation grid into a guided, ordered **website
  tour**. A 7-question quiz (role, starting point, gene status, conditional **gene selector** shown
  only if gene known, multi-select main goal, research interest, navigation preference) →
  `lib/pathway.ts` `buildPathway()` returns a `PathwayResult`: an ordered `primaryPath` (first stop
  labeled "Start here") + separate `optionalStops` + `notes`. Deterministic rules (no AI):
  `knowsGene`/`wantsResearch`/`wantsCommunity`/`wantsSupport`/`getGeneHref`, `addStopOnce` dedupes by
  id+href so a gene-known visitor gets a real multi-page tour (not 4 links to one page); min 2 stops.
  Gene-known → their gene page; unknown → Genetic Insights + a genetic-testing note; nav-preference
  answers surface tips for the real read-aloud/voice/search features. Copy is navigation-only
  ("Start here", "next stop"), never "recommended"/treatment. Timeline UI = numbered `<ol>` (SR order),
  primary path visually distinct from optional. **In-session preserve:** answers + result persist to
  `sessionStorage` (per-tab, cleared on close; feature-detected + try/catch, restore runs
  post-hydration and the save pass is guarded so it can't clobber the restore) so visiting a stop and
  returning doesn't wipe the journey. "Start over" clears it. Promoted into the primary nav
  (`components/site/Header.tsx`) in place of "Newly Diagnosed" (that page stays reachable elsewhere).
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
  - **Manual only for now (owner decision, 2026-07-02) — no automatic cron.** The `crons` entry in
    `vercel.json` has been removed to avoid ongoing Opus + web-search spend; the route/logic (`app/api/cron/research-pull/`,
    protected by `CRON_SECRET`) still exists and works, it's just not scheduled. Run manually with
    `npm run research:pull -- rpgr` (single gene) or uncapped for the whole `geneGrid` list; needs the
    env in `.env.local`. **Planned:** re-add a cron to `vercel.json` on a **quarterly** cadence once the
    gene library size settles (was weekly `0 9 * * 1` capped at `?limit=12`/run, ~6 weeks/cycle at 66
    genes — quarterly is a deliberate cost-conscious downgrade from that, not a return to it).
  - **Governance**: Opus may DRAFT freely, but nothing publishes until a human reviews it. Titles/URLs
    come from real web-search results; `why_it_matters` is AI-written and must be checked.
  - **TODO — FAQ extraction (planned).** While Opus is already pulling research per gene, also have it
    draft a small set of **plain-English FAQ entries** per gene (question + answer, e.g. the "some
    methods are…" that the voice assistant's advice-handoff currently stitches verbatim from page
    fields). Store as `pending_review` in a new `faqs` table (one row per Q/A, gene-scoped, item-level
    status like `research_items`). Once a human approves, the voice assistant answers from the
    **reviewed FAQ answer** — backend context catered to the question's phrasing — instead of reading
    raw page fields. Keeps governance intact (human-reviewed before it's spoken) while being more
    natural than verbatim field-stitching. Not built yet.
- **Accessibility pass** — fixed low-contrast disease-category label (gray → forest, larger,
  non-italic; ~3.9:1 → ~9:1), plus result counts, notes, and gene-page field labels to meet AA.
- **Guided demo tour** (`lib/tour/steps.ts` + `components/site/tour/TourCompanion.tsx`) — built for
  in-person events (a kiosk someone walks up to). An **overlay on the real site**, not a separate
  mock: a full-screen "Welcome to RP Hope" with a Start button, then a collapsible companion panel
  (docked bottom-**left**, clear of the voice launcher bottom-right) that walks through 12 ordered
  stops, each explaining a page and then `router.push`-ing to it. Ends on a "Thanks for taking the
  tour!" screen with contact details, looping back to Start.
  - **Env-gated**: only mounts when `NEXT_PUBLIC_TOUR_MODE === "1"` (checked in `app/layout.tsx`).
    Set **only** on the separate `rphopedemo` Vercel project → **https://rphopedemo.vercel.app**.
    The live `rp-hope.vercel.app` never renders it, so this code is safe to ship to main.
  - `rphopedemo` is **not connected to Git** — it only updates via `vercel deploy --prod` from a
    working tree. (Its project settings needed `framework: nextjs` set explicitly, and Deployment
    Protection turned off so event visitors aren't hit with an SSO login.)
  - State is deliberately **in-memory only**: client-side nav keeps the panel's place, while a full
    page reload resets to Welcome — the clean "next visitor" state for a kiosk.
  - `MedicalDisclaimerGate` is `z-[110]`, above the tour's `z-[100]`, so the "before you continue"
    gate is answered first rather than being covered while it still traps focus.
  - **Keep the tour copy in sync with the real UI.** Its "try it" prompts name actual controls
    ("Talk to RP Hope" → "Start conversation", "Listen to this page"). An earlier draft told
    visitors to say "Hello Claude" — a wake phrase that does not exist.
- **Read-aloud button** (`components/site/ListenButton.tsx` + `lib/speech.ts`) — "Listen to this
  page" on gene detail pages. **OpenAI TTS** via `/api/tts` (`gpt-4o-mini-tts`, voice `coral`) —
  **no browser Web Speech fallback**; playback is an `<audio>` element, so there is no Chrome ~15s
  cutoff to work around and no browser-support gate. Never autoplays (starts on click),
  keyboard-operable with visible Pause/Resume/Stop, `aria-hidden` so it doesn't duplicate content
  for an active screen reader. Gates on `isTTSAvailable()` (a server-config probe) and hides itself
  when `OPENAI_API_KEY` is absent. Speaks VERBATIM published fields only via `readableGeneText()`
  (name → at-a-glance → brief description → In-the-News titles) — no AI paraphrase.
- **Conversational voice assistant — OpenAI Realtime over WebRTC.** Mounted globally in
  `app/layout.tsx`. **The full architecture, governance, and browser support are documented in
  "Voice assistant — BUILT" in the Accessibility section above — read that before changing this.**
  Quick map of the code:
  - UI: `components/site/voice-assistant/` (`VoiceAssistant` launcher "Talk to RP Hope" → panel →
    "Start conversation"; plus `VoiceAssistantPanel`, `VoiceControls`, `VoiceStatus`,
    `VoiceTranscript`, `VoiceSources`). **No wake phrase**; the mic never auto-activates.
  - Session: `hooks/useRPVoiceAssistant.ts` owns the live `RealtimeSession`; `lib/voice/agent.ts`
    holds the agent + session config (`gpt-realtime-2.1`, voice `marin`, `semantic_vad` barge-in).
  - Instructions: `lib/voice/agentInstructions.ts` (`ASSISTANT_INSTRUCTIONS`) — edit the prose here.
  - Tools: `lib/voice/tools.ts` (9 Zod-typed, browser-executed) + `navigationRegistry.ts` (route
    allowlist), `pageContext.ts`, `bridge.ts` (router + ARIA live region), `transcript.ts`
    (captions), `accessibilityPreferences.ts`, `rateLimit.ts`.
  - Retrieval: `lib/knowledge/` (MiniSearch over reviewed records — no DB, no key, client+server).
  - Server: `app/api/openai/realtime-token/` (ephemeral token) and `app/api/openai/rp-expert/`
    (`gpt-5.4` reasoner, grounded to retrieved excerpts).
  - ⚠️ **Dead code to clean up** (superseded by the above, currently unreferenced):
    `lib/assistantInstructions.ts`, and `lib/geneFaceImages.json` + `scripts/describe-faces.mjs`
    (the old "see the screen" photo-matching fed the deleted whole-site-corpus prompt).
    `supabase/migrations/0002_ai_explanations.sql` also related to the deleted `/api/assistant`
    audit log — the Realtime session does not write it.
  - **Phase 2 (TODO)**: smoother live captions, returning-visitor auto-enable, and reviewed **FAQ**
    drafting (see research element) so common answers come from human-approved Q/A. Embeddings /
    pgvector are **not** needed — `lib/knowledge/search.ts` (MiniSearch) covers retrieval today.
- **Clinical Trials Finder** (`app/clinical-trials/`, `components/site/trials/`, `lib/trials/`,
  `app/api/trials/match/route.ts`) — a guided, global, AI-assisted trial-discovery flow. NOT an
  eligibility tool: every result is framed "may be relevant to review" / "ask the study team."
  - **Flow**: a 14-question progressive-disclosure intake (`TrialIntakeForm`, mirrors the
    `my-pathway` quiz UX) → `POST /api/trials/match` → grouped result cards (`TrialResults` →
    `TrialCard`), orchestrated by `ClinicalTrialsFinder`. Branches: gene questions only show if the
    user knows their gene; an inline "did you mean RPGR?" confirm step appears when input is fuzzy.
  - **Source-grounded data**: live **ClinicalTrials.gov API v2** (`lib/trials/source.ts`, public, no
    key, global, always current) is the reviewed source. We map studies → `TrialRecord` and only
    pass those real fields downstream. Route is `force-dynamic`, nodejs, 12s fetch timeout.
  - **Deterministic normalization** (`lib/trials/normalize.ts`, `geneUtil.ts`) — dictionary +
    fuzzy/Levenshtein match against the existing `geneGrid` (NOT an AI call): "rpgrr"→RPGR,
    "pde6 beta"→PDE6B, "USH"→ambiguous[USH2A,USH3A]. Runs client-side in the form (instant, no round
    trip) and again server-side. Keeps governance tight — the model can't invent a gene.
  - **Deterministic safety gates** (`lib/trials/match.ts`) — drop completed/withdrawn/terminated (by
    default), off-topic, conflicting-confirmed-gene, and clearly age-incompatible studies. Location is
    a RANKING signal, not a hard exclusion (rare-disease trials are often far). Unknown-gene rule:
    gene-specific studies can never be "strong" matches when no gene is confirmed (enforced in code,
    post-AI). Sections: best / broader / registries+observational / other.
  - **Real distance handling** (`lib/trials/geocode.ts`) — the visitor's city/postal is geocoded
    best-effort (Zippopotam for postal codes, Nominatim for place names; free, no key, 6s timeout,
    graceful null; country→ISO2 map). Haversine distance to each trial's NEAREST CT.gov `geoPoint`
    (`nearestSiteKm` in `match.ts`) feeds ranking tuned to travel scope (strong pull within radius,
    gentle penalty beyond — still never a hard exclusion); `distanceKm` rides on each `ScoredTrial`
    and shows as "nearest site ~N mi" on the card. (Before this, city/zip + radius were collected but
    unused — location only mattered at country level.)
  - **Honest, computed location note** (the red context box, always shown — `route.ts`
    `locationSentence()`) — states the TRUTH from the real results per travel scope: near-me → how
    many have a site within the picked radius (25/50/100/250 mi) or plainly "none within X mi";
    country/region → how many have a site in that country or "none in {country}, showing
    international options"; remote-only → prioritized registries/observational. Deterministic template
    (a factual count, so not AI). Falls back to "couldn't pinpoint {loc}" if geocoding fails.
  - **AI relevance layer** (`lib/trials/explain.ts`, **Opus `claude-opus-4-8`**, system prompt cached)
    — classifies each trial into a fixed enum (`strong_review_candidate` … `not_relevant`) and writes
    a plain-English "why it may be relevant" + study-team questions, grounded ONLY in passed fields,
    forbidden from saying anyone "qualifies/is eligible." Off-enum output is repaired; **deterministic
    fallback** classifies everything when there's no API key or on any parse/network error (page never
    dead-ends). Caps to 20 trials/call (overflow → deterministic).
  - **Governance**: this stays inside the content model because the trial data IS an official registry
    (no unreviewed medical facts invented), the AI only adds curation/explanation language, and the
    framing is navigation ("worth reviewing"), never diagnosis or eligibility. Disclaimer at top of
    results AND on every card. No Supabase table needed yet (the type carries `status_review` so a
    `manual`/`pending_review` record path exists for the future). **No manual setup required.**

### Events — Wix Events integration (CODE BUILT, needs Wix API key)

**The one place we deliberately did NOT leave Wix.** Everything else on this site moved off Wix, but
event management stays there: Carin already runs RP Hope's events from the Wix dashboard, and the
whole point of this integration is that she keeps doing exactly that. **Wix Events is the single
source of truth** for events AND registrations — RP Hope is only the visitor-facing frontend.

- **No parallel system.** There is no `events` or `registrations` table in Supabase and there must
  not be one. Guests are never mirrored locally. Carin manages guests where she always has:
  Wix Dashboard → Events → [event] → Guests (edit, remove, waitlist, check-in, export).
- **Nothing about events is hardcoded.** Titles, dates, locations, images, capacity, registration
  windows, and the registration *questions* all come from Wix at request time. Carin adding a
  question, closing registration, or publishing a new event needs **no code change and no deploy**.

**APIs chosen** (current, non-deprecated — verified against dev.wix.com):
- **Events V3** via `wixEventsV2.queryEvents` / `getEventBySlug` / `getEvent` — `fields: ["DETAILS",
  "TEXTS","REGISTRATION","FORM","URLS"]`. The `FORM` fieldset is what returns the live question set.
- **RSVP V2** via `rsvpV2.createRsvp` (`POST /events/v2/rsvps`). Deliberately NOT the older RSVP v1.
- Official `@wix/sdk` + `@wix/events` packages, matching this repo's use-the-official-SDK convention.

**Auth — server-only, no visitor OAuth.** Both the events read scope (`SCOPE.DC-EVENTS.READ-EVENTS`)
and the RSVP write scope (`SCOPE.DC-EVENTS.MANAGE-GUEST-LIST`) are **elevated and not visitor-safe**,
so there is no browser-side Wix client and no OAuth flow to build — every call goes through our
server with an API key (`Authorization: <API_KEY>` + `wix-site-id`, raw key, not `Bearer`).
`WIX_API_KEY`/`WIX_SITE_ID` are server-only and must never take a `NEXT_PUBLIC_` prefix.

**Code map** (`lib/wix/`, mirroring the `lib/trials/` layering):
- `client.ts` — `wixConfigured` + null-guarded SDK client, same shape as `lib/stripe.ts`. Without
  keys the site still builds and `/events` shows a calm "taking a moment" state.
- `mapEvent.ts` / `formSchema.ts` — pure, unit-tested mapping. `toSiteEvent()` narrows Wix's huge
  optional-everything `Event`; `toRegistrationFields()` flattens `form.controls[].inputs[]` into
  renderable questions; `validateAnswers()` checks a submission against that same definition.
- `events.ts` / `rsvp.ts` — the network layer. `rsvp.ts` maps Wix's documented application-error
  codes (`RSVPS_CLOSED`, `GUEST_LIMIT_EXCEEDED`, `MEMBER_EMAIL_ALREADY_REGISTERED`, …) to friendly
  sentences; Wix's own developer-facing strings are never shown to a visitor.
- UI: `components/site/events/EventCard.tsx`, `RegistrationForm.tsx`; pages `app/events/page.tsx`
  (`revalidate = 300`) and `app/events/[slug]/page.tsx`.

**Things that are load-bearing — don't undo them:**
- **Submit-time re-validation.** The register route re-fetches the event + form from Wix on every
  call. A visitor whose tab was open when Carin closed registration gets a 409, not a booking.
- **Wix's response is authoritative.** Success is only reported after Wix confirms. A "yes" that Wix
  converts to `WAITLIST` (event filled up mid-request) is reported to the visitor as waitlisted.
- **Field IDs, not labels.** Submissions use Wix's stable `inputName`; labels are display-only and
  Carin can re-word them freely.
- **Wix sends the confirmation email**, so `lib/email.ts` is deliberately NOT wired in here — a
  second RP Hope email would conflict with Wix's own.
- **No PII in logs.** Only event ID + Wix error code are logged, never names/emails/answers.
- **Rich text is never rendered as HTML.** Wix returns Ricos JSON nodes; `extractParagraphs()` pulls
  text only, so there is no `dangerouslySetInnerHTML` path and nothing to sanitize.
- Registration state derivation is deliberately conservative: anything not positively confirmed open
  falls through to "closed" rather than showing a form Wix would reject.

**Not built (deliberate, documented, not silently dropped):**
- **Ticketed/paid events** — the detail page shows an honest "email us for a ticket link" notice
  rather than a half-working checkout. Adding Wix-hosted Events Checkout later is the clean next
  step; `lib/wix/` already separates events/rsvp/forms for it.
- Attendee self-service cancellation, and any guest management in RP Hope Admin — both stay in Wix.
- Filtering which Wix events appear here (Query Events can't filter by category). Currently every
  published event on the site shows, which is fine because the Wix site is RP Hope's own.

**Manual setup required before this works** (until then `/events` shows the empty state, everything
else on the site is unaffected):
1. Generate an API key at **https://manage.wix.com/account/api-keys**, scoped to **only the RP Hope
   site**, with the Wix Events read + manage-guest-list permissions.
2. Grab the **Site ID** from the Wix dashboard URL (the segment after `/dashboard/`).
3. Set `WIX_API_KEY` and `WIX_SITE_ID` in `.env.local` and in Vercel (Production + Preview), redeploy.
4. Test against a **throwaway Wix test event first**, never a real one — an API-created RSVP lands in
   the real guest list.

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
- **Copy rule (owner directive): the literal phrase "plain English" must NEVER appear in any
  user-facing text.** It's the owner's term for talking to the AI, not site copy. Scrubbed site-wide
  → use "clear, jargon-free" / "easy-to-read" / "clear, everyday language" instead. (Internal code
  identifiers like the `plain_english_reason` JSON field and the `plain_english_summary` data-model
  name are fine — they're never rendered. AI prompts were also scrubbed so the model won't emit it.)

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
5. **No cron to register right now (owner decision, 2026-07-02).** The `crons` entry was removed from
   `vercel.json` to avoid ongoing Opus + web-search spend — run the pull manually instead (step 6/7).
   Redeploy as usual for the `CRON_SECRET`/env changes above to take effect; there's just no scheduled
   trigger. **Planned:** re-add a `crons` entry on a quarterly cadence once the gene library size settles.
6. **Smoke-test (optional but recommended):** locally run `npm run research:pull -- rpgr` →
   open Supabase Table Editor → `research_items` should have a few `pending_review` rows for RPGR.
7. **Review & publish:** in the Table Editor, read each drafted row; for ones you approve, set
   `status` = `published` (and optionally fill `reviewed_by`). Within ~1 hour they appear in the
   **"In the News"** section of that gene's page (e.g. `rp-hope.vercel.app/genetic-insights/rpgr`).

Ongoing: run `npm run research:pull` manually (no cap) or per-gene, whenever you want fresh drafts. Periodically
review the `pending_review` queue and publish what passes. Nothing medical goes live unreviewed.

Cost note: each gene run makes one Opus call with up to 5 web searches (web search is billed per
search + tokens). Low volume by design; swap the cron schedule/limit in `vercel.json` to tune.

### Share Your Story — CODE BUILT, needs manual setup

Visitors can submit their own RP story (typed, dictated by voice, or a short uploaded video) at
`/share-your-story`. It goes to Supabase as `pending_review`, a reviewer edits it at `/review/stories`,
and it's published to `/stories` either after the submitter approves the final draft (a token-gated
link at `/stories/approve/[token]`, no login needed) or immediately if they granted "free edit"
permission — their choice, captured in the form. Nothing publishes without either the submitter's own
approval or that explicit upfront trust; same content-governance spirit as the rest of the site.

- `supabase/migrations/0004_story_submissions.sql` — the `story_submissions` table (private Section-1
  contact/consent columns never rendered publicly; public Section-2 columns once published) + the
  private `story-videos` Storage bucket. **Apply this migration in the Supabase SQL editor** before the
  feature works at all.
- **Real email, finally** (`lib/email.ts`, Resend) — the "send the final draft back for approval" loop
  needs to actually email the submitter, so this project's first real email service was added here (not
  just for stories — `app/contact/ContactForm.tsx`'s `mailto:` interim can be swapped to this too when
  convenient). Config-null-safe like every other integration here: without `RESEND_API_KEY` the pipeline
  still works end-to-end (DB insert, reviewer dashboard, publish), emails just log and no-op.
- **Set on Vercel:** `RESEND_API_KEY` (sign up at resend.com), optionally `STORY_EMAIL_FROM` (defaults to
  `RP Hope <information@rphope.org>` — the sending domain needs to be verified in Resend for this to
  actually deliver) and `STORY_REVIEWER_EMAIL` (defaults to `information@rphope.org`).
- **Publishing is gated on `reviewer_profiles.can_publish`**, same privilege check the gene-draft flow
  uses — any active reviewer can view/edit/send-for-approval, only publish-permitted reviewers can
  actually flip a story to `published`.
- Voice assistant: `submit_story` (`lib/voice/tools.ts`) lets the assistant walk someone through
  submitting by voice — it's instructed to always spell back name/email (and phone digit-by-digit)
  for confirmation before calling it, and to do a final full read-back first. This is the most
  experimental piece of the feature (accuracy depends on Realtime transcription of a full spoken
  story); a user who'd rather type/dictate/upload video themselves should just be navigated to the page.
- Known constraint: `/api/transcribe` (OpenAI, 25MB cap) auto-transcribes an uploaded video's audio to
  prefill the story text box; a video over that cap still uploads fine, it just isn't auto-transcribed —
  a reviewer can watch it and type the story text themselves.

### Still to do (roadmap)
- **Donations (`/donate`) — CODE BUILT, blocked on Stripe login/keys from Carin.** Uses **Stripe
  Checkout** (hosted): one integration gets cards + **Apple Pay** + **Google Pay** + Link, accessible,
  receipts handled. **What's built (working, typechecked, verified locally):** `lib/stripe.ts`
  (server client + `stripeConfigured` guard), `app/api/checkout/route.ts` (one-time = `payment` mode;
  monthly = `subscription` mode with an inline recurring price — no dashboard Products/Prices needed),
  `components/site/DonateForm.tsx` (Frequency toggle + preset/Other amounts), `/donate/success` +
  `/donate/cancelled` pages. Page no longer says "demo". Without keys the endpoint returns a clean 503.
  **Running TODO to finish (do in order):**
  - [ ] **Waiting on Carin** to hand over the Stripe login (org's existing account, used via Wix).
        When she does: confirm it's a real Stripe account (dashboard.stripe.com), NOT "Wix Payments";
        check whether any recurring donations already live in Stripe.
  - [ ] **Test mode first.** In Stripe (Test mode ON) → Developers → API keys → copy the **Test**
        secret key (`sk_test_…`).
  - [ ] Add to `.env.local`: `STRIPE_SECRET_KEY=sk_test_…` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
  - [ ] `npm run dev` → `/donate` → pay with test card `4242 4242 4242 4242` (future expiry, any CVC).
        Land on Thank You; also test the **Monthly** toggle (appears under Billing → Subscriptions).
  - [ ] **Go live:** add `STRIPE_SECRET_KEY` (the **live** `sk_live_…` key) to Vercel env (Production),
        redeploy.
  - [ ] Stripe dashboard polish: Settings → Payment methods → enable **Apple Pay / Google Pay**;
        Settings → Emails → enable "Successful payments" receipts.
  - [ ] Apply for Stripe's **nonprofit rate** (2.2% + 30¢) — [stripe.com/docs/nonprofit](https://stripe.com/docs/nonprofit).
  - [ ] **Restyle `/donate`** to the new forest/gold brand (still on old Wix teal/maroon tokens).
        (`/events` is already on the new brand — it was rebuilt for the Wix Events integration.)
  - [ ] (Optional later) Stripe **Customer Portal** link so monthly donors can self-manage/cancel.
  - **Zelle can't be embedded** (no merchant API) — only a manual "send to this email/phone" display option.
- Move gene **detail** reads into Supabase (add `face_of_rp`, articles columns; seed full data).
- Fill the 15 from-scratch genes as `pending_review` (human-reviewed before publish).
- Read-aloud ✅ and the **conversational voice assistant** ✅ shipped — both now run on **OpenAI**
  (Realtime `gpt-realtime-2.1` voice `marin` over WebRTC; `gpt-5.4` expert reasoner; `gpt-4o-mini-tts`
  read-aloud). **No manual setup beyond `OPENAI_API_KEY`** — retrieval is MiniSearch over bundled
  reviewed records, so there's no DB/migration/index step. Remaining: voice Phase 2 (smoother
  captions, returning-visitor auto-enable) and research→FAQ extraction. **pgvector is not needed.**
- Apply to Vercel's nonprofit program; pull `og:image` thumbnails for discovered studies.
- ✅ **The admin/review UI is BUILT** (this used to be listed as "still to do — reviewed in the
  Supabase Table Editor"; that is out of date). Reviewer dashboard at `/review` with auth
  (`/review/login`, `set-password`, `reset-password`) and `/review/admin`; code in `app/review/`
  (+ `actions.ts`), `lib/reviewer/` (`session.ts`, `data.ts`, `publishGate.ts`, `publishPlan.ts`,
  `dashboardStatus.ts`, `publicContent.ts`) and `components/review/`. Pages are `noindex` +
  `force-dynamic`, gated by `requireReviewer()` / `requireAdmin()`. **This subsystem still needs a
  proper write-up here** by whoever built it — the above is just a file map.

Clinical-trial matching must remain in the dedicated Clinical Trials Finder.

On each Genetic Insights gene page:

- Show only a brief gene-specific trial summary.
- Display the number of potentially relevant active or recruiting trials.
- Clearly distinguish:
  - recruiting
  - active, not recruiting
  - completed
  - preclinical research
- Do not display generic trials merely because they mention inherited retinal disease.
- Add a primary action labeled:
  “Find clinical trials”
- When clicked, open the Clinical Trials Finder with the current gene
  preselected.
- Preserve the user’s ability to change or remove the gene selection.

Use wording such as:
“Studies that may be relevant to review”

Do not use:
“You qualify”
“You are eligible”
“This trial is right for you”
“Suitable trial”

The Clinical Trials Finder should collect, where relevant:

- gene
- diagnosis
- age
- country or region
- travel distance
- remote participation preference
- prior treatments
- study-type preference

Results should explain why each study may be relevant and which eligibility
details still need confirmation from the study team.