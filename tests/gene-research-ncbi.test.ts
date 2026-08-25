import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNcbiGeneRecord } from "@/lib/geneResearch/ncbi";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  // Response.ok is derived automatically from status (200-299) — no need to
  // set it separately.
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchNcbiGeneRecord — three distinct outcomes", () => {
  it("ok:true with a record when the gene is found and verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("esearch")) {
          return jsonResponse({ esearchresult: { idlist: ["6103"] } });
        }
        return jsonResponse({
          result: {
            "6103": {
              name: "RPGR",
              description: "retinitis pigmentosa GTPase regulator",
              summary: "x",
              chromosome: "X",
              otheraliases: "RP3, CORDX1",
            },
          },
        });
      })
    );
    const result = await fetchNcbiGeneRecord("RPGR");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record?.symbol).toBe("RPGR");
      expect(result.record?.sourceId).toBe("ncbi-gene:6103");
      expect(result.record?.aliases).toContain("RP3");
    }
  });

  it("ok:true with record:null when the gene genuinely isn't found (not a failure)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ esearchresult: { idlist: [] } }))
    );
    const result = await fetchNcbiGeneRecord("NOTAREALGENE");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.record).toBeNull();
  });

  // NCBI rate-limits per source IP, so a 429 can arrive even when we are within
  // the documented limit. ncbiFetch retries with backoff (1s, 2s, 4s) before
  // giving up, which is why these two tests need a timeout past the default 5s.
  it("retries a 429, then reports the error once attempts are exhausted", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 429));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchNcbiGeneRecord("RPGR");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("429");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  }, 20_000);

  it("ok:false when fetch throws (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const result = await fetchNcbiGeneRecord("RPGR");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("network down");
  }, 20_000);
});
