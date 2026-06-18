// Data access for the gene library.
//
// Reads from Supabase when configured (and seeded); otherwise falls back to the
// local hardcoded data so the site works on localhost before the DB is wired up.
// This is the single seam to make "real" — components call these functions and
// don't care where the data comes from.

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
      .eq("status", "published")
      .order("gene_name");

    if (!error && data && data.length > 0) {
      return {
        source: "supabase",
        items: data.map((g) => ({
          slug: g.slug,
          display: g.gene_name,
          // mirror the live site: show the inheritance pattern as the label
          label: g.inheritance_pattern || g.disease_category || "",
        })),
      };
    }
  }
  return { source: "local", items: localGrid };
}
