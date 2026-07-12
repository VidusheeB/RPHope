// Domains the web-search fallback is allowed to cite. Deliberately small and
// editable — add a domain here only if it's a source RP Hope would trust for
// medical/research content. Enforced programmatically (see
// webSearchFallback.ts) — a result whose URL isn't on this list is dropped,
// regardless of what the model returns or claims.
export const APPROVED_WEB_DOMAINS: readonly string[] = [
  // Official registries / government
  "clinicaltrials.gov",
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "fda.gov",
  "nih.gov",
  "omim.org",
  // Literature aggregators
  "europepmc.org",
  // Major peer-reviewed journals / publishers common in this field
  "nature.com",
  "sciencedirect.com",
  "nejm.org",
  "thelancet.com",
  "jamanetwork.com",
  "iovs.arvojournals.org",
  "ophthalmologyretina.org",
  "onlinelibrary.wiley.com",
  // Recognized patient advocacy / research organizations
  "foundationfightingblindness.org",
  "rpb.org",
  // Press-release wire services (for company/FDA trial announcements — real
  // primary-source news not yet in PubMed, but still attributable/citable)
  "globenewswire.com",
  "prnewswire.com",
  "businesswire.com",
];

export function isApprovedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return APPROVED_WEB_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
