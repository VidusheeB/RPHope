// Research-pull pipeline core — shared by the weekly cron route and the manual
// `research:pull` script, so there is ONE code path.
//
// For each gene: Opus runs web searches across academic sources and drafts items
// (title + real URL + plain-English why_it_matters), we drop any we already have
// (dedup by URL), and insert the new ones as `pending_review`. Inserts happen PER
// GENE so a timeout mid-run still persists progress — the next run skips what's
// already stored and continues.

import type { SupabaseClient } from "@supabase/supabase-js";
import { geneGrid } from "../geneGrid";
import { discoverResearch } from "./draft";

export type PullSummary = {
  genesProcessed: number;
  inserted: number;
  skipped: number; // already-known items (dedup)
  errors: { gene: string; error: string }[];
};

export type PullOptions = {
  /** Restrict to specific gene slugs (e.g. manual single-gene runs). */
  slugs?: string[];
  /** Cap how many genes to process this run (resilience against timeouts). */
  limit?: number;
  /** Delay between genes (ms) to pace the web-search + Opus calls. */
  delayMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runResearchPull(
  supabase: SupabaseClient,
  opts: PullOptions = {}
): Promise<PullSummary> {
  const { slugs, limit, delayMs = 500 } = opts;

  let genes = geneGrid.map((g) => g.slug);
  if (slugs && slugs.length) {
    genes = genes.filter((s) => slugs.includes(s));
  } else {
    // Full-set run: order by least-recently-pulled so a capped/timed-out run
    // advances through the whole list across successive weekly runs instead of
    // re-checking the same genes. Genes never pulled (no rows) sort first.
    const { data } = await supabase
      .from("research_items")
      .select("gene_slug, created_at");
    const lastPulled = new Map<string, number>();
    for (const r of data ?? []) {
      const t = new Date(r.created_at as string).getTime();
      lastPulled.set(
        r.gene_slug as string,
        Math.max(lastPulled.get(r.gene_slug as string) ?? 0, t)
      );
    }
    genes.sort((a, b) => (lastPulled.get(a) ?? 0) - (lastPulled.get(b) ?? 0));
  }
  if (limit && limit > 0) genes = genes.slice(0, limit);

  const summary: PullSummary = {
    genesProcessed: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
  };

  for (const slug of genes) {
    try {
      // Opus runs web searches across academic sources and drafts the items.
      const found = await discoverResearch(slug.toUpperCase());
      summary.genesProcessed++;
      if (found.length === 0) {
        await sleep(delayMs);
        continue;
      }

      // Dedup against what's already stored for this gene (by normalized URL).
      const { data: existing } = await supabase
        .from("research_items")
        .select("external_id")
        .eq("gene_slug", slug);
      const known = new Set((existing ?? []).map((r) => r.external_id as string));

      const fresh = found.filter((it) => !known.has(it.externalId));
      summary.skipped += found.length - fresh.length;
      if (fresh.length === 0) {
        await sleep(delayMs);
        continue;
      }

      const rows = fresh.map((it) => ({
        gene_slug: slug,
        source: it.source,
        external_id: it.externalId,
        title: it.title,
        source_url: it.sourceUrl,
        published_label: it.publishedLabel ?? null,
        why_it_matters: it.whyItMatters,
        status: "pending_review" as const,
      }));

      // ignoreDuplicates so a concurrent run can't collide on the unique key.
      const { data: ins, error } = await supabase
        .from("research_items")
        .upsert(rows, {
          onConflict: "gene_slug,source,external_id",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) throw new Error(error.message);
      summary.inserted += ins?.length ?? 0;
    } catch (e) {
      summary.errors.push({
        gene: slug,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(delayMs);
  }

  return summary;
}
