// Public gene-page content selection: prefer the newest PUBLISHED Supabase
// version, fall back to the existing local genesData.json content when no
// published database version exists. The fallback keeps the whole site working
// during gradual migration (most genes have no published version yet).

import { getSupabase } from "../supabase";
import { getServiceSupabase } from "../supabaseAdmin";
import type { GenePageDraft } from "../geneResearch/types";

export type PublishedGeneVersion = {
  versionNumber: number;
  content: GenePageDraft;
};

/** Pure selection rule — unit-tested. Returns which source to render. */
export function pickPublicGeneContent<F>(
  published: PublishedGeneVersion | null,
  fallback: F | null
): { source: "published"; content: GenePageDraft } | { source: "fallback"; content: F } | null {
  if (published) return { source: "published", content: published.content };
  if (fallback) return { source: "fallback", content: fallback };
  return null;
}

/**
 * Pick the newest PUBLISHED version from a set of rows — defense in depth over
 * the DB query's own `status = 'published'` filter. It filters by status FIRST,
 * so an archived row can never be returned even if it has a higher
 * version_number or newer timestamp than the published one. Pure + unit-tested.
 */
export function pickNewestPublished(
  rows: { version_number: number; status: string; content: unknown }[]
): PublishedGeneVersion | null {
  const published = rows.filter((r) => r.status === "published");
  if (!published.length) return null;
  const newest = published.reduce((a, b) => (b.version_number > a.version_number ? b : a));
  return { versionNumber: newest.version_number, content: newest.content as GenePageDraft };
}

/**
 * Read the newest published version for a gene slug (anon client + RLS, which
 * exposes only status='published' rows). Returns null when Supabase isn't
 * configured or the gene has no published version — the caller then falls back
 * to genesData.json. Never throws into the page render.
 */
export async function getPublishedGeneVersion(
  slug: string
): Promise<PublishedGeneVersion | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    // Primary guard: the query itself filters status = 'published'. The result
    // is then run through pickNewestPublished as a second, in-code guard so an
    // archived row can never reach the public page even if the query changed.
    const { data, error } = await supabase
      .from("gene_page_versions")
      .select("version_number, status, content")
      .eq("gene_slug", slug)
      .eq("status", "published")
      .order("version_number", { ascending: false })
      .limit(1);
    if (error || !data) return null;
    return pickNewestPublished(data as { version_number: number; status: string; content: unknown }[]);
  } catch {
    return null;
  }
}

/**
 * Was this gene EVER published — i.e. does an archived gene_page_versions
 * row exist even though nothing is published right now? Distinguishes
 * "never reviewed" (fine to fall back to legacy genesData.json) from "was
 * live, then an admin took it down" (must show the branded "being updated"
 * message instead — never silently reveal the old legacy content as if
 * nothing happened).
 *
 * gene_page_versions has no public RLS policy for archived rows (only
 * status = 'published' is anon-readable), so this existence-only check
 * uses the service-role client. It never returns row content, only a
 * boolean, so nothing unpublished is exposed. */
export async function wasGeneEverPublished(slug: string): Promise<boolean> {
  const service = getServiceSupabase();
  if (!service) return false;
  try {
    const { data } = await service
      .from("gene_page_versions")
      .select("id")
      .eq("gene_slug", slug)
      .limit(1);
    return Boolean(data?.length);
  } catch {
    return false;
  }
}
