// The gene-record lookup must never return a DIFFERENT gene than the one asked
// for. A live run resolved INPP5E to PMPCA (NCBI Gene 23203) because the old
// code took esearch's first hit and then relabelled itself with whatever came
// back, so the pipeline began building an INPP5E page from PMPCA's record.

import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNcbiGeneRecord } from "@/lib/geneResearch/ncbi";

afterEach(() => vi.restoreAllMocks());

function mockNcbi(idlist: string[], summaries: Record<string, { name: string; description?: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("esearch")) {
        return { ok: true, status: 200, json: async () => ({ esearchresult: { idlist } }) };
      }
      return { ok: true, status: 200, json: async () => ({ result: summaries }) };
    })
  );
}

describe("gene lookup refuses a different gene's record", () => {
  it("rejects the exact INPP5E -> PMPCA mismatch that happened in a live run", async () => {
    mockNcbi(["23203"], { "23203": { name: "PMPCA", description: "peptidase" } });

    const res = await fetchNcbiGeneRecord("INPP5E");
    expect(res.ok).toBe(true);
    // No record is far better than a page built from the wrong gene.
    if (res.ok) expect(res.record).toBeNull();
  });

  it("finds the right gene when it is not first in the list", async () => {
    mockNcbi(["23203", "56623"], {
      "23203": { name: "PMPCA" },
      "56623": { name: "INPP5E", description: "inositol polyphosphate-5-phosphatase E" },
    });

    const res = await fetchNcbiGeneRecord("INPP5E");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.record?.symbol).toBe("INPP5E");
      expect(res.record?.geneId).toBe("56623");
      expect(res.record?.sourceId).toBe("ncbi-gene:56623");
    }
  });

  it("matches case-insensitively", async () => {
    mockNcbi(["6103"], { "6103": { name: "RPGR" } });
    const res = await fetchNcbiGeneRecord("rpgr");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.record?.symbol).toBe("RPGR");
  });

  it("still returns null when the gene genuinely does not exist", async () => {
    mockNcbi([], {});
    const res = await fetchNcbiGeneRecord("NOTAGENE");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.record).toBeNull();
  });

  it("never silently renames the requested gene to the returned one", async () => {
    // The old failure mode: symbol became whatever NCBI returned.
    mockNcbi(["999"], { "999": { name: "SOMETHINGELSE" } });
    const res = await fetchNcbiGeneRecord("CFAP418");
    if (res.ok) {
      expect(res.record).toBeNull();
      expect(res.record?.symbol).not.toBe("SOMETHINGELSE");
    }
  });
});

// Note: the "HTTP failure is not a missing gene" case is deliberately not
// tested here — ncbiFetch retries a 5xx with backoff, so it belongs with the
// retry tests rather than timing out this suite.
