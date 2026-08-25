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

// NCBI returns 429 even when calls are spaced at the documented limit — the
// limit is per source IP, so a shared or NAT'd address can be throttled by
// traffic that isn't ours. Over a 90-gene run that turned into sporadic
// "required retrieval failed" rejections on perfectly good genes, each of
// which then had to be re-run by hand. A bounded retry absorbs the blip.
//
// Only 429 (rate limited) and 5xx (transient server trouble) are retried. A
// 400 means a malformed query and would fail identically on every attempt.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

/** Throttled fetch for eutils.ncbi.nlm.nih.gov, retrying transient failures
 *  with exponential backoff. Returns the final Response — a non-retryable
 *  error status is returned as-is for the caller to interpret. */
export async function ncbiFetch(url: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await throttleNcbi();
    try {
      const res = await fetch(url, init);
      if (!RETRY_STATUSES.has(res.status) || attempt === MAX_ATTEMPTS) return res;
    } catch (err) {
      // Network-level failure (DNS, socket reset). Retry on the same schedule.
      lastError = err;
      if (attempt === MAX_ATTEMPTS) throw err;
    }
    // 1s, 2s, 4s — long enough for a rate-limit window to roll over.
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
  throw lastError ?? new Error("NCBI request failed after retries");
}
