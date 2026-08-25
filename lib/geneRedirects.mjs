// Old gene URLs → where they live now.
//
// The 94-gene reconciliation (RP_Hope_genes_to_include_94.xlsx, August 2026)
// renamed one gene, merged three duplicate pages, and dropped two locus names.
// Every one of those slugs is a URL that already exists — some are linked from
// the old Wix site, search results, and printed material — so none of them may
// 404. They are real 308 redirects rather than in-page redirect() calls: a
// redirect() inside a statically-prerendered page emits a 307 with NO Location
// header, which dead-ends the link instead of forwarding it (same reason the
// /policies redirects below are configured this way).
//
// NOTE: lib/genesData.json still holds legacy detail records for the merged
// slugs (bbs3, ush3a, …). They are unreachable because these redirects run
// before the route, and their content is superseded by the freshly drafted
// ARL6 / CLRN1 / CFAP418 / LCA5 pages. Left in place rather than deleted so
// the old text stays available to a reviewer comparing drafts.
//
// Consumed by next.config.mjs. Plain .mjs so the Next config can import it.
export const GENE_REDIRECTS = {
  // Renamed by HGNC. C8orf37 stays a search term (see lib/geneCatalog.ts).
  c8orf37: "cfap418",
  // Same gene under two names — merged, per the sheet's "Do not include" tab.
  bbs3: "arl6",
  ush3a: "clrn1",
  // "LCA" is a disease, not a gene; the row meant the gene LCA5.
  lca: "lca5",
  // Locus names with no gene ever assigned. Nothing to redirect *to*, so these
  // go back to the library rather than to a wrong gene.
  rp17: null,
  rp51: null,
};

/** Next.js redirect entries for every retired gene URL. */
export function geneRedirectRules() {
  return Object.entries(GENE_REDIRECTS).map(([from, to]) => ({
    source: `/genetic-insights/${from}`,
    destination: to ? `/genetic-insights/${to}` : "/genetic-insights",
    permanent: true,
  }));
}
