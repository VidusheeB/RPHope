# RP Hope — website (new version)

The rebuilt RP Hope site: a warm, accessible research-hub for people affected by
retinitis pigmentosa (RP). Re-platformed off Wix onto Next.js + (planned) Supabase.

See [`CLAUDE.md`](./CLAUDE.md) for the full project brief, accessibility requirements,
and content-governance rules.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** (design tokens in `tailwind.config.ts`)
- **Fraunces** (serif display) + **Mulish** (body) via `next/font`
- **Supabase** (Postgres + auth) — planned, for structured gene data and forms
- **Vercel** — deployment target

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (development)
# or, production-like:
npm run build && npm start
```

Useful scripts:

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` type check |
| `npm run lint` | Next.js / ESLint |
| `npm run check` | typecheck + lint + build (run before pushing) |

## Project structure

```
app/                      # routes (App Router)
  page.tsx                # redesigned homepage
  my-pathway/             # "My RP Pathway" guided flow (quiz + results)
  explore/                # "Explore RP Hope" quick-access grid
  genetic-insights/       # gene library landing + [gene] pages
  newly-diagnosed/        # Start Here
  clinical-trials/        # trials (sample data for now)
  stories/                # patient/family stories
  donate/  events/        # (reused from the original demo; restyle pending)
components/
  site/                   # new-version UI (Header, Footer, Hero, CTAButton,
                          #   GeneCard, ExploreGrid, homepage sections…)
  FillerBox.tsx           # red image placeholder
lib/
  pathway.ts              # My RP Pathway questions + recommend() engine
  genes.ts, geneGrid.ts   # gene data (moves to Supabase later)
  geneImages.ts
scripts/                  # content scraper (scrape_rphope.py)
supabase/                 # planned DB schema + migrations (see supabase/README.md)
reference/                # scraped content + screenshots (source of truth for copy)
StaticDemoOriginal/       # ARCHIVE of the original exact-replica demo (not built)
```

## Notable design decisions

- **My RP Pathway** is a front-end prototype: `lib/pathway.ts` maps answers to curated
  sections via a transparent `recommend()` function. Swap that one function for
  AI-assisted curation over the reviewed content library and the UI is unchanged.
  All curation is labeled "for education and navigation only, not medical advice."
- **Gene/event content is data, not markup** (`lib/`), so it can move to Supabase and be
  edited by non-technical volunteers later.
- **Accessibility is the #1 requirement** (audience has vision loss): semantic landmarks,
  visible focus, high contrast, keyboard nav, `prefers-reduced-motion`. See `CLAUDE.md`.

## Environment

Copy `.env.example` to `.env.local` and fill in values once Supabase is set up:

```bash
cp .env.example .env.local
```
