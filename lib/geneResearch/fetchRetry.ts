// Bounded retry for the pipeline's outbound HTTP calls.
//
// A gene run depends on four external services (NCBI, Europe PMC,
// ClinicalTrials.gov, and Anthropic). Europe PMC and ClinicalTrials.gov are
// REQUIRED retrievals — a failure there rejects the gene outright — and neither
// had any retry, so a single dropped connection anywhere in an 89-gene batch
// killed that gene and needed a manual re-run. Observed in practice: CLRN1 was
// rejected with "Europe PMC search failed: fetch failed" while the trials fetch
// failed in the same instant, i.e. a transient local network blip, not a bad
// query.
//
// Deliberately NOT applied to the user-facing Clinical Trials Finder by
// default: a visitor waiting on search results should get a fast, honest
// failure rather than sit through several seconds of backoff. Callers opt in
// (see lib/geneResearch/trials.ts), so batch robustness never costs a visitor
// latency.

/** Transient: worth another attempt. A 400 means a malformed query and would
 *  fail identically every time, so it is returned as-is. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

export type RetryOptions = {
  /** Total attempts, including the first. 1 disables retrying. */
  attempts?: number;
  /** Base backoff; doubles each attempt (1s -> 2s -> 4s by default). */
  baseDelayMs?: number;
  /** Called before each retry — used for logging. */
  onRetry?: (attempt: number, reason: string) => void;
};

export async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  { attempts = 3, baseDelayMs = 1000, onRetry }: RetryOptions = {}
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!RETRY_STATUSES.has(res.status) || attempt === attempts) return res;
      onRetry?.(attempt, `HTTP ${res.status}`);
    } catch (err) {
      // A dropped connection, DNS hiccup, or an aborted timeout.
      lastError = err;
      if (attempt === attempts) throw err;
      onRetry?.(attempt, (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
  }
  throw lastError ?? new Error("request failed after retries");
}
