# Gene Page Draft Generation Pipeline

Generates improved Genetic Insights page drafts per gene: retrieval from NCBI,
PubMed, and ClinicalTrials.gov, then one independent `claude-opus-4-8` call per
gene (adaptive thinking, `effort: high`, Structured Outputs) producing a
patient-first, source-cited JSON draft. **Never runs automatically** — it costs
real Anthropic API spend every time you invoke it.

## Run it

```bash
# 5-gene trial first (do this before the full run — see below)
npm run gene-pages:draft -- rpgr abca4 lca5 kiz fscn2

# a capped batch
npm run gene-pages:draft -- --limit=5

# the full 107-gene library (only after reviewing a trial run)
npm run gene-pages:draft
```

Needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`ANTHROPIC_API_KEY` in `.env.local`. `NCBI_API_KEY` is optional (raises the
NCBI rate limit from 3 to 10 req/sec).

## Before you run it

**Apply the migration first**: `supabase/migrations/0002_gene_page_drafts.sql`
in the Supabase SQL editor. Creates `gene_page_drafts` (mirrors the
`research_items` pattern — every row is `unreviewed` until a human approves it).

## Review

Every draft lands in Supabase Table Editor → `gene_page_drafts`,
`review_status = 'unreviewed'`. Nothing here is public, feeds the live gene
pages, or is readable without the service-role key (RLS has no public policy).
Review a row, then either build a small script to publish it into `genesData.json`
/ the `genes` table, or hand-copy the approved fields — no auto-publish path
exists (by design, per CLAUDE.md content governance).

## Cost

Standard (non-batch) pricing: ~$0.10–$0.30/gene depending on source-record
volume (the CLI prints actual tokens + cost per gene and a running total).
Batch API (50% off) isn't wired up in this first version — the spec calls for
independent, retryable per-gene requests, which is what's built; batching can
be added later once the prompt/schema are validated against real output.

## Files

- `lib/geneResearch/ncbi.ts` — NCBI E-utilities gene record lookup
- `lib/geneResearch/pubmed.ts` + `rank.ts` — PubMed search/fetch + ranking/dedup
- `lib/geneResearch/trials.ts` — wraps the existing CT.gov client (`lib/trials/source.ts`)
- `lib/geneResearch/resources.ts` — approved general resources + existing-page lookup
- `lib/geneResearch/schema.ts` — `GENE_PAGE_SCHEMA` (Structured Outputs)
- `lib/geneResearch/prompts.ts` — system + per-gene user prompt
- `lib/geneResearch/generate.ts` — the Opus call + cost estimate
- `lib/geneResearch/pipeline.ts` — orchestration + Supabase insert
- `scripts/gene-pages-draft.ts` — the CLI

## Known limitations

- PubMed abstract parsing uses targeted regexes over the stable PubMed XML
  export shape, not a full XML parser — occasional thin/missing abstracts are
  possible and surface as weaker source support, always caught at human review.
- No retry/backoff on NCBI/PubMed rate limits yet; a failed gene is reported
  and skipped, safe to re-run individually.
- No publish tooling yet (see Review, above) — reviewing and moving an approved
  draft into the live gene content is currently a manual step.
