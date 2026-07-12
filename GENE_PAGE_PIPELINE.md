# Gene Page Draft Generation Pipeline

Generates improved Genetic Insights page drafts, one gene at a time, from
programmatically retrieved and verified biomedical evidence.

**Final architecture (owner decision, 2026-07-11; high-recall retrieval
redesign, 2026-07-12):**

1. **Verify the human gene against NCBI Gene** (required). Yields the official
   symbol, official full name, aliases, and the NCBI Gene ID. If this fails or
   the gene isn't found, the gene is rejected before any other retrieval.
2. **Build the search-term set** from the verified record — official symbol,
   official full name, and *safe* aliases only (generic English words, purely
   numeric, and sub-3-character aliases are excluded to avoid flooding a broad
   search with ambiguous hits). See `aliases.ts`.
3. **High-recall literature retrieval** — ranking, not a disease-keyword gate,
   is what narrows the field:
   - **PubMed broad search** — term set in Title/Abstract, *no retinal keyword
     required*.
   - **PubMed focused search** — the same term set **AND** a broad retinal
     vocabulary (retina, photoreceptor, dystrophy, retinitis pigmentosa,
     rod-cone, cone-rod, macular, Leber congenital amaurosis, ciliopathy,
     nyctalopia, …).
   - **NCBI Gene-to-PubMed ELink** — PMIDs NCBI has *curated* as associated
     with the verified Gene ID, independent of any text search (best-effort: a
     transient ELink failure is logged and skipped, not fatal).
   - **Europe PMC broad + focused searches** — the same two-query pattern
     against Europe PMC (which also indexes preprints / non-MEDLINE records).
   - Each source/query retrieves **up to 100 candidates** (not capped at 20).
4. **ClinicalTrials.gov retrieval** — live registry (API v2), mapped to
   trimmed trial records; ranked and capped separately from literature.
5. **Provenance tracking + deduplication** — every candidate records *which*
   queries found it (`foundBy`) and *which* term matched (`matchedTerm`).
   Dedup by **PMID → DOI → normalized title** *merges* provenance across
   duplicates rather than silently dropping the extras (a paper found by both
   a text search **and** ELink is a stronger signal, and that's preserved).
6. **Category-balanced evidence selection** — instead of a flat top-N by
   score, selection fills a per-category quota across five buckets (human
   phenotype / natural-history, reviews, treatment / clinical, preclinical /
   mechanism, then highest-relevance "other"), so one prolific category can't
   crowd out reviews or mechanism work. Every candidate is marked
   selected/excluded with a reason (surfaced in the retrieve-only diagnostic).
7. **Optional web fallback** — only if the *selected* evidence is thin.
   Separate, isolated, domain-allowlisted, capped at 3 searches; scoped to
   current FDA / trial / university / company updates (not general journal
   discovery), and every result must carry real fetched page text. See "Web
   search fallback" below.
8. **ONE** Claude Opus 4.8 structured-output call per gene. No second model-
   synthesis stage, no tools attached to this call. Opus evaluates only the
   supplied evidence bundle and drafts — it may not add facts from memory.
9. The whole draft is **rejected** (not saved) if: it cites an unknown source
   ID; required retrieval failed; the human gene wasn't verified; or the
   structured result fails schema validation.
10. Every accepted draft saves as `unreviewed`.

Web search is **not** part of the main call and is **not** unrestricted (step
7). The single generation call (step 8) sees only pre-assembled records.

**Never runs automatically** — real Anthropic spend happens every time you
invoke it (except `--retrieve-only`, which is free).

## Run it

```bash
# retrieve-only: verify retrieval quality with ZERO Anthropic spend
npm run gene-pages:draft -- --retrieve-only rpgr

# validate on ONE gene (real spend, ~$0.05-0.30)
npm run gene-pages:draft -- rpgr

# the 5-gene trial (only after the 1-gene run passes review)
npm run gene-pages:draft -- lca5 inpp5e rpgr idh3b prpf31

# a capped batch, with a lower cost ceiling than the $50 default
npm run gene-pages:draft -- --limit=5 --max-cost=10

# regenerate a gene that's already been drafted
npm run gene-pages:draft -- --force rpgr

# the full 107-gene library — ONLY after 1-gene and 5-gene runs pass review
npm run gene-pages:draft
```

Needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`ANTHROPIC_API_KEY` in `.env.local` (the last one is not required for
`--retrieve-only`). `NCBI_API_KEY` is optional (raises the NCBI rate limit
from 3 to 10 req/sec).

## Validation order (do this in sequence, not all at once)

1. `--retrieve-only` on **one** gene — confirms retrieval, dedup, and ranking
   work, for $0.
2. A real run on **one** gene — confirms the full pipeline including
   generation and validation.
3. Review that one row in Supabase.
4. The **5-gene** trial.
5. Review those five rows.
6. Only then, the full 107-gene run.

## Before you run it

**Apply the migration first**: `supabase/migrations/0002_gene_page_drafts.sql`
in the Supabase SQL editor. Creates `gene_page_drafts` (mirrors the
`research_items` pattern — every row is `unreviewed` until a human approves
it).

## Cost controls

- **Pre-generation estimate**: printed before each Opus call, based on the
  assembled evidence bundle's size.
- **Actual cost**: printed after each gene, from real token usage.
- **Cumulative run cost**: printed running, and in the final summary.
- **Hard stop**: defaults to **$50** cumulative; configurable with
  `--max-cost=N`. The run checks the ceiling *before* starting each gene, so
  it never overshoots into a new gene once the ceiling is reached.
- **Resume support**: a gene already saved in `gene_page_drafts` is skipped by
  default (no regeneration, no spend). Pass `--force` to regenerate anyway.
- **Retrieve-only mode**: `--retrieve-only` runs steps 1-6 (verification,
  high-recall retrieval, provenance/dedup, and category-balanced selection)
  with **zero** Anthropic usage — the web fallback (the only Anthropic call in
  retrieval) is explicitly skipped in this mode. Use it to validate retrieval
  quality before spending anything.

## Retrieve-only diagnostics

Each `--retrieve-only` gene writes a per-candidate diagnostic to
`gene-review-scratch/<slug>-retrieval.txt` (gitignored — local audit output,
never committed). The report lists, for **every deduplicated candidate**
(highest score first):

- which quer(y/ies) found it (`foundBy`: pubmed-broad, pubmed-focused,
  pubmed-elink, europepmc-broad, europepmc-focused);
- whether it came from Gene-to-PubMed ELink (`via ELink: yes/no`);
- which gene term or alias matched the text (`matchedTerm`, or "ELink
  association — no text match" for a pure ELink find);
- its score and evidence category;
- whether it was **selected** for Opus or **excluded**;
- the exclusion reason, when excluded.

The header also reports the search terms used, safe vs. excluded aliases, and
raw per-source counts before dedup. `formatRetrievalDiagnostics` in
`lib/geneResearch/diagnostics.ts` produces this; it is pure formatting with no
Anthropic usage.

## Web search fallback

Only triggers when a gene's **selected** evidence (selected literature +
ranked trials) has fewer than `THIN_EVIDENCE_THRESHOLD` (3) combined records —
and never in `--retrieve-only` mode. When it fires:

- A separate, isolated Opus call (no schema, no relation to the main
  generation call) uses the `web_search` **and** `web_fetch` server tools,
  capped at 3 searches, both restricted to the approved domain list at the
  tool level (`allowed_domains`).
- **Scope is narrow** (retrieval spec #10): current FDA actions, trial-status
  changes, or university/company announcements — the things PubMed / Europe
  PMC / ClinicalTrials.gov wouldn't already have. It is **not** a general
  journal-discovery substitute.
- **Real page text required** (retrieval spec #11): the model must `web_fetch`
  each candidate URL and copy a genuine excerpt into a required `snippet`
  field. A title + URL alone is insufficient evidence — any result with no
  real captured text (or below a minimum length) is **dropped in code**, as is
  any URL outside the allowlist. Domain filtering is enforced programmatically,
  not merely requested in the prompt.
- Accepted results are folded into the evidence bundle as ordinary
  `type: "web"` sources, available to the (separate) main generation call —
  this is why "no second model-synthesis stage" still holds: this call
  retrieves, it doesn't draft.

Edit `APPROVED_WEB_DOMAINS` in `webSearchAllowlist.ts` to add/remove trusted
domains.

## Rejection — what happens to a rejected gene

Per the spec, a rejected draft is **not saved**. `gene_page_drafts` only ever
holds real, valid, reviewable content — a schema-invalid or hallucinated
draft was never something a human should have to sift through. The CLI
prints the specific reject reason(s) so you can see why (and re-run
individually once fixed). Rejection happens at two points:

- **Before generation** (no Anthropic spend): the gene wasn't verified in
  NCBI, or a required retrieval source (PubMed/Europe PMC/ClinicalTrials.gov)
  hard-failed (a real API/network error — NOT the same as a legitimate
  zero-result search, which just makes the evidence bundle thinner and may
  trigger the web-search fallback instead).
- **After generation** (Anthropic spend already happened): the draft cited a
  source ID not in the supplied bundle, or failed Ajv schema validation.

## Review

Every accepted draft lands in Supabase Table Editor → `gene_page_drafts`,
`review_status = 'unreviewed'`. Nothing here is public, feeds the live gene
pages, or is readable without the service-role key (RLS has no public
policy). No auto-publish path exists — reviewing and moving an approved draft
into the live gene content is currently a manual step (by design, per
CLAUDE.md content governance).

## Files

- `lib/geneResearch/ncbi.ts` — NCBI Gene verification (`GeneVerificationResult`:
  found / not-found / hard-failure, distinguished on purpose)
- `lib/geneResearch/aliases.ts` — `getSearchTerms`: filters the verified
  record's aliases into safe (specific enough to search broadly) vs. excluded
  (generic word / numeric / too short), and builds the symbol + full name +
  safe-alias term set used for both broad and focused queries
- `lib/geneResearch/pubmed.ts` — PubMed broad + focused searches
  (`buildBroadQuery` / `buildFocusedQuery`, `RETINAL_VOCABULARY`), efetch with
  DOI extraction, `fetchPubMedRecords(symbol, terms)` and
  `fetchPubMedRecordsByPmid(pmids, symbol)` (for ELink results)
- `lib/geneResearch/elink.ts` — NCBI Gene-to-PubMed ELink
  (`fetchGeneToPubmedElink`), curated gene→publication associations
- `lib/geneResearch/europepmc.ts` — Europe PMC broad + focused searches
  (returns abstracts directly, no separate efetch needed)
- `lib/geneResearch/rank.ts` — evidence classification (`classifyEvidence`,
  5-bucket taxonomy) + scoring + provenance-merging dedup (`dedupeLiterature`:
  PMID → DOI → normalized title, merging `foundBy`) + `selectCategoryBalanced
  Evidence` (quota-then-fill selection) + trial ranking (`rankAndCapTrials`)
- `lib/geneResearch/trials.ts` — wraps `lib/trials/source.ts`'s
  `fetchTrialsResult` (added there, backward-compatible — the original
  `fetchTrials` used by the Clinical Trials Finder is untouched)
- `lib/geneResearch/webSearchAllowlist.ts` — the approved-domain list +
  `isApprovedDomain`
- `lib/geneResearch/webSearchFallback.ts` — the capped, gap-triggered fallback
  (`web_search` + `web_fetch`, real-snippet-or-drop)
- `lib/geneResearch/diagnostics.ts` — `formatRetrievalDiagnostics`: the
  human-readable per-candidate retrieve-only report (no Anthropic usage)
- `lib/geneResearch/resources.ts` — small curated RP Hope resource list
- `lib/geneResearch/schema.ts` — `GENE_PAGE_SCHEMA` (Structured Outputs; the
  live API rejects `maxItems` on arrays, so the 5/6-item caps are enforced by
  the prompt + `postprocess.ts`, not the schema)
- `lib/geneResearch/prompts.ts` — system + per-gene user prompt (evaluates a
  pre-assembled bundle; no live-search framing — that's a separate step now)
- `lib/geneResearch/generate.ts` — the single Opus call, pre-call cost
  estimate, post-call cost, `DraftRejectedError` vs `GenerationError`
- `lib/geneResearch/validate.ts` — Ajv schema validation + unknown-source-ID
  cross-check against the bundle
- `lib/geneResearch/pipeline.ts` — orchestration: verify → build terms →
  ELink + PubMed broad/focused + Europe PMC broad/focused + trials → dedupe
  (merge provenance) → category-balanced select → optional fallback →
  generate → validate → save. `assembleSourceBundle` returns full retrieval
  diagnostics separate from the bundle Opus sees.
- `scripts/gene-pages-draft.ts` — the CLI (`--retrieve-only`, `--force`,
  `--limit`, `--max-cost`); writes the diagnostic file in retrieve-only mode

## Known limitations

- PubMed abstract parsing uses targeted regexes over the stable PubMed XML
  export shape, not a full XML parser.
- `classifyEvidence`'s 5-bucket evidence tagging is a keyword heuristic for
  ranking and category-balanced selection, not ground truth — the prompt
  explicitly tells Opus to verify against the actual abstract, not trust the
  tag blindly. Because the buckets are checked in priority order, a record
  matching two buckets (e.g. "gene therapy in a mouse model") lands in the
  higher-priority one (treatment) by design.
- `matchedTerm` is re-derived locally from the fetched title/abstract (PubMed's
  esearch doesn't report per-term attribution for an OR query), so it reflects
  the first term that actually appears in the text, not necessarily every one.
- Web-search citation integrity relies on programmatic domain filtering (hard
  enforcement) plus a prompt instruction (soft enforcement for everything
  else, e.g. the exact URL matching a real search result) — there's no
  automated check that a cited URL actually appeared in a real search result
  for that run; human review is the backstop, same as the rest of this
  pipeline's governance model.
- No publish tooling yet — moving an approved draft into the live gene
  content is a manual step.
