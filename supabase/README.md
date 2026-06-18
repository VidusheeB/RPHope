# Supabase (planned)

Structured data for the gene library and forms. Not wired up yet — this folder holds
the schema groundwork so the migration is straightforward when we start.

## Setup (when ready)

1. Create the Supabase project **under an org-owned account** (e.g. `information@rphope.org`)
   so volunteers can be added/removed without an ownership transfer. (If it starts under a
   personal account, it can be transferred later via the dashboard, or dump/restore — see
   `CLAUDE.md` notes.)
2. Copy `.env.example` → `.env.local` and fill in the Supabase URL + keys.
3. Apply the schema:
   ```bash
   # Supabase CLI
   supabase db push
   # or paste supabase/schema.sql into the Supabase SQL editor
   ```
4. Seed gene data from `lib/genes.ts` / `lib/geneGrid.ts` (write a one-off import script).

## Notes

- `schema.sql` keeps **inheritance_pattern** and **disease_category** as separate columns
  (CLAUDE.md data-model rule), with `status` defaulting to `pending_review` for the
  review-before-publish workflow. Public reads are restricted to `published` rows via RLS.
- Keep migrations in this folder and in version control so the database is reproducible in
  any account — this is the data-portability win over Wix.
