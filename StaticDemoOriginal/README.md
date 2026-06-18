# StaticDemoOriginal — archived exact-replica demo

This folder is an **archive / reference snapshot**, not a running app. It holds the
original exact-replica recreation of the current Wix site (rphope.org) that was used
for the first demo.

It is **excluded from the build** (see `tsconfig.json` → `exclude`) and is not routed
by Next.js (it lives outside `app/`). Keep it for reference; do not import from it in
the live application.

## What's here

| File | What it recreated |
|------|-------------------|
| `app/who-we-are/page.tsx` | About / Who We Are (Mission, Vision, Board, Tax Filings) |
| `app/learn-more/page.tsx` | Learn More about RP (explainer + article grid) |
| `app/search/` | Site-wide search over scraped articles + events |
| `components/Nav.tsx` | Original top nav (About, Learn More, Genetic Insights, Events, Search) |
| `components/Footer.tsx` | Original footer |
| `components/GeneCard.tsx` | Original gene card |
| `lib/searchIndex.json` | Search index built from the scraped content |

## What was intentionally NOT moved here

`donate`, `events`, and `genetic-insights` (the gene grid + gene pages) stayed in the
live app at the repo root, because the **new version's homepage links to them**. Moving
them would break the new site. The new version will restyle those pages over time.

The original home page was replaced by the redesigned homepage and is preserved in git
history rather than copied here.
