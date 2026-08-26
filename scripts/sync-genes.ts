// Reconcile the Supabase `genes` table to lib/geneCatalog.ts.
//
//   npm run genes:sync -- --dry-run   # show what would change, touch nothing
//   npm run genes:sync                # apply
//
// WHY THIS EXISTS: the gene library page reads its grid from Supabase, not from
// the repo (lib/genesRepo.ts falls back to the local grid only when the table
// is empty or unreachable). So reconciling geneGrid.ts to the 94-gene sheet
// changed nothing that visitors could see — the site kept serving the older,
// separately-seeded 66 rows. This is the tool that closes that gap, and the one
// to re-run whenever the catalog changes.
//
// SAFETY: only ever writes the identity columns — slug, gene_name,
// inheritance_pattern, aliases, status. It never touches the written medical
// content columns (plain_english_summary, treatment_status, …), so a reviewed
// summary cannot be clobbered by a sync.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getServiceSupabase } from "../lib/supabaseAdmin";
import { geneCatalog } from "../lib/geneCatalog";
import { geneGrid } from "../lib/geneGrid";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const labelBySlug = new Map(geneGrid.map((g) => [g.slug, g.label]));

  const { data: existing, error } = await supabase.from("genes").select("slug, gene_name, status");
  if (error) {
    console.error("✗ Could not read `genes`:", error.message);
    process.exit(1);
  }
  const rows = (existing ?? []) as { slug: string; gene_name: string; status: string }[];
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const catalogSlugs = new Set(geneCatalog.map((g) => g.slug));

  const toInsert = geneCatalog.filter((g) => !bySlug.has(g.slug));
  const toUpdate = geneCatalog.filter((g) => {
    const row = bySlug.get(g.slug);
    return (
      row && (row.gene_name !== g.gene || row.status !== "published")
    );
  });
  const toDelete = rows.filter((r) => !catalogSlugs.has(r.slug));

  console.log(`Supabase \`genes\`: ${rows.length} row(s). Catalog: ${geneCatalog.length}.\n`);
  console.log(`  + insert ${toInsert.length}: ${toInsert.map((g) => g.gene).join(" ") || "—"}`);
  console.log(`  ~ update ${toUpdate.length}: ${toUpdate.map((g) => g.gene).join(" ") || "—"}`);
  console.log(`  - delete ${toDelete.length}: ${toDelete.map((r) => r.slug).join(" ") || "—"}`);
  console.log(
    "\n(deleted rows are retired genes — duplicates, renames and locus names. Their URLs\n" +
      " are handled by the redirects in lib/geneRedirects.mjs, so nothing 404s.)"
  );

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  const payload = geneCatalog.map((g) => ({
    slug: g.slug,
    gene_name: g.gene,
    inheritance_pattern: labelBySlug.get(g.slug) ?? "",
    aliases: g.aliases,
    status: "published",
  }));

  const { error: upsertError } = await supabase
    .from("genes")
    .upsert(payload, { onConflict: "slug" });
  if (upsertError) {
    console.error("\n✗ Upsert failed:", upsertError.message);
    process.exit(1);
  }
  console.log(`\n✓ Upserted ${payload.length} gene(s).`);

  if (toDelete.length) {
    const { error: deleteError } = await supabase
      .from("genes")
      .delete()
      .in("slug", toDelete.map((r) => r.slug));
    if (deleteError) {
      console.error("✗ Delete failed:", deleteError.message);
      process.exit(1);
    }
    console.log(`✓ Removed ${toDelete.length} retired gene(s).`);
  }

  const { count } = await supabase
    .from("genes")
    .select("slug", { count: "exact", head: true })
    .eq("status", "published");
  console.log(`\nPublished genes now live on /genetic-insights: ${count}`);
}

main();
