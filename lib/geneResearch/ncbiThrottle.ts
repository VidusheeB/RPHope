// Shared rate limiter for eutils.ncbi.nlm.nih.gov — used by BOTH ncbi.ts
// (gene lookup) and pubmed.ts (search + efetch), since they hit the same
// host and share the same rate limit.
//
// Sequencing calls with `await` alone is NOT sufficient: if each request
// completes in ~100-200ms, five sequential NCBI-bound calls for one gene
// (gene lookup: 2 + PubMed's 3 search terms + 1 efetch) can still land well
// within one second — confirmed by hitting real 429s in testing even after
// removing all concurrency. This module adds genuine time spacing between
// calls, not just ordering.
//
// Without NCBI_API_KEY the documented limit is 3 req/sec (333ms/request); we
// space calls at 400ms to leave margin. With a key, NCBI allows 10 req/sec.

const MIN_INTERVAL_MS = process.env.NCBI_API_KEY ? 110 : 400;

let lastCallAt = 0;

/** Await this immediately before every eutils.ncbi.nlm.nih.gov fetch. */
export async function throttleNcbi(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastCallAt = Date.now();
}
