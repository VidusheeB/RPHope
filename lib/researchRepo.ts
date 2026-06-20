// Read access for a gene's research items shown in the "In the News" section.
//
// Reads PUBLISHED research_items from Supabase (RLS already restricts the anon
// client to published rows) and merges them with the existing locally-curated
// list in geneArticles.json. DB items come first (freshest, human-approved
// drafts), then any curated items not already present by URL. Falls back to the
// local list entirely when Supabase isn't configured — so localhost still works.

import { getSupabase } from "./supabase";
import articlesByGene from "./geneArticles.json";
import type { Article } from "@/components/site/GeneArticles";

export async function getResearchItems(slug: string): Promise<Article[]> {
  const local = (articlesByGene as Record<string, Article[]>)[slug] ?? [];

  const supabase = getSupabase();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("research_items")
    .select("title, source_url, published_label, why_it_matters")
    .eq("gene_slug", slug)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return local;

  const fromDb: Article[] = data.map((r) => ({
    title: r.title as string,
    url: r.source_url as string,
    date: (r.published_label as string | null) ?? undefined,
    whyItMatters: (r.why_it_matters as string | null) ?? undefined,
  }));

  const seen = new Set(fromDb.map((a) => a.url));
  return [...fromDb, ...local.filter((a) => !seen.has(a.url))];
}
