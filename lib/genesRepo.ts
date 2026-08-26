// Data access for the gene library.
//
// The CATALOG is authoritative for which genes exist. lib/geneCatalog.ts is
// generated from RP_Hope_genes_to_include_94.xlsx, the reviewed list, and it
// ships with the code — so the library on the site is always exactly the list
// we reconciled, on every deploy.
//
// Supabase ENRICHES those genes (the inheritance label Carin maintains in the
// Table Editor), but can no longer change the membership of the library. That
// split matters: the grid previously took its rows straight from Supabase, so
// a database that had drifted from the sheet silently served a stale library —
// in practice 66 genes including retired duplicates and an `abgl5` typo, while
// the reconciled list held 94. A missing gene is invisible; nobody notices a
// page that simply isn't listed.
//
// So: every catalog gene always appears. A Supabase row for a catalog gene
// overrides its label. A Supabase row for a gene NOT in the catalog is ignored
// — retired genes stay retired even if a stale row lingers.

import { getSupabase } from "./supabase";
import { geneGrid as localGrid, type GeneGridItem } from "./geneGrid";

export async function getGeneGrid(): Promise<{
  items: GeneGridItem[];
  source: "supabase" | "local";
}> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from("genes")
      .select("slug, gene_name, inheritance_pattern, disease_category")
      .eq("status", "published");

    if (!error && data && data.length > 0) {
      // Label overrides, keyed by slug. Rows outside the catalog are dropped.
      const labelBySlug = new Map(
        data.map((g) => [
          g.slug,
          // mirror the live site: show the inheritance pattern as the label
          g.inheritance_pattern || g.disease_category || "",
        ])
      );
      return {
        source: "supabase",
        items: localGrid.map((g) => {
          const label = labelBySlug.get(g.slug);
          return label ? { ...g, label } : g;
        }),
      };
    }
  }
  return { source: "local", items: localGrid };
}
