# RP Hope — Session Handoff

_Last updated: 2026-07-12_

## Current state

- **Current commit:** `29cf064` (`feat: add secure reviewer portal and atomic gene publishing`)
- **Branch:** clean and synchronized with `origin/main` (nothing to commit, not ahead/behind).
- **Features 1–4:** implemented, tested, pushed, and deployed.
- **Production URL:** https://rp-hope.vercel.app
- **Vercel deployment:** succeeded (`✓ Compiled successfully`, no build or runtime errors).
- **All `/review` routes are live.**
- **Protected routes correctly redirect unauthenticated users** (`/review` and `/review/admin` → `307 → /review/login`; public forms `/review/login`, `/review/set-password`, `/review/reset-password` → `200`).
- **No Opus calls are authorized.**
- **Confirmed generated drafts:** RPGR, INPP5E, KIZ, and LCA5.

## What Features 1–4 are

- **Feature 1 — NCT extraction/verification:** NCT IDs found in selected literature are resolved directly against ClinicalTrials.gov and merged into the trial set; unverifiable IDs are kept as "unverified references," never invented.
- **Feature 2 — conservative relevance gate:** clearly off-topic papers (e.g. orthokeratology/myopia) are dropped pre-selection with recorded reasons; high-recall retrieval preserved.
- **Feature 3 — patient-friendly prevalence wording:** generation prompt describes gene frequency qualitatively in the main prose.
- **Feature 4 — secure reviewer portal + atomic publishing:** invite-only Supabase Auth (`@supabase/ssr`, cookie sessions), RLS-enforced per-reviewer access, review-flag resolution UI, and one-click Approve & Publish backed by a single-transaction Postgres RPC (`publish_gene_version`) with per-gene advisory locking and a partial unique index.

## ✅ Migration 0003 verified APPLIED (2026-07-12 session)

Verified NON-destructively against the live DB (`agblxoevctghdfywabue`) via PostgREST
with the service-role key — the migration was **NOT rerun**:

- **Tables** `reviewer_profiles`, `draft_assignments`, `review_flag_resolutions`,
  `gene_page_versions` — all exist and respond.
- **RPCs** `auth_is_admin`, `auth_is_assigned`, `auth_is_active_assignee`,
  `publish_gene_version` — all registered in the PostgREST OpenAPI spec. Because
  `publish_gene_version` is the file's LAST statement, the file ran to completion
  (covering the partial unique index at line 113 and the RLS policies before it).
- **RLS enforced** — anon-key reads of every protected table return `[]` (no leak).
- Data at verification time: `gene_page_drafts` = 4 rows (rpgr, inpp5e, kiz, lca5);
  the four new tables were empty.

**Do NOT rerun `0003_reviewer_portal.sql`.** It is already applied.

## Live setup — progress (2026-07-12 session)

Done this session (writes were via the service-role key against the live DB):

- ✅ **Admin seeded** — auth user `vidushee.bala@gmail.com` (auto email-confirmed) +
  `reviewer_profiles` row `role='admin'`, `can_publish=true`, `active=true`.
  user_id `b164df0d-9ee7-46c0-9ac3-f47d57313663`.
- ✅ **Demo reviewer seeded** — auth user `reviewer.demo@rphope.org` (auto
  email-confirmed) + `reviewer_profiles` row `role='reviewer'`, `can_publish=true`,
  `active=true`. user_id `091c53de-22a0-4184-9cc3-26d3db696179`.
- ✅ **LCA5 assigned** to the demo reviewer (`draft_assignments` id
  `53431cab-3ca4-42ed-a11f-5a9121f39b06`, status `assigned`; LCA5 draft
  `5ad3a763-4ea4-48dc-a222-9c81b80c6fbe`, 6 review flags, `review_status='unreviewed'`).
- ✅ **Both logins verified** working + confirmed via the password-grant auth endpoint.
- Passwords were delivered in-session (NOT stored in this file). Rotate before any
  real production use.

Still to do (interactive / dashboard — not automatable here, and publish was
deliberately left for the live demo click):

1. **(Optional, not blocking this demo) Supabase Auth redirect URLs** — only needed
   for the email invite/reset flow; the seeded accounts log in directly with
   email+password so it does not block the demo. To enable invites later: in the
   Supabase dashboard set Site URL + allowed redirect URLs to include the production
   origin and `/review/set-password`.
2. **Log into `/review`** (admin sees `/review/admin`).
3. **Demo the flow** as the reviewer: open the assigned LCA5 draft, save an edit,
   resolve the 6 review flags, then **Approve & Publish** (this is the human-review
   click — intentionally NOT pre-executed).
4. **Confirm `/genetic-insights/lca5`** then shows the newly published Supabase
   version (public page prefers newest published version, falls back to `genesData.json`).

## Guardrails for the next session

- **Do not make additional code changes** (unless a real error is exposed).
- **Do not call Opus.**
- **Migration 0003 is verified applied — do NOT rerun it** (see section above).
