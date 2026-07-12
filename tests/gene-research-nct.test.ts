import { describe, it, expect, vi, afterEach } from "vitest";
import { extractNctIds, collectNctReferences } from "@/lib/geneResearch/nct";
import { mergeLiteratureReferencedTrials } from "@/lib/geneResearch/trials";
import * as source from "@/lib/trials/source";
import { fetchStudyByNctId } from "@/lib/trials/source";
import type { TrialSummaryRecord } from "@/lib/geneResearch/types";
import type { TrialRecord } from "@/lib/trials/types";

afterEach(() => vi.restoreAllMocks());

function ctStudyJson(nctId: string) {
  return {
    protocolSection: {
      identificationModule: { nctId, briefTitle: `${nctId} study` },
      statusModule: { overallStatus: "RECRUITING" },
      designModule: { studyType: "INTERVENTIONAL" },
      conditionsModule: { conditions: ["Leber congenital amaurosis"] },
    },
  };
}

describe("fetchStudyByNctId (direct registry lookup)", () => {
  it("fetches the exact study by ID and maps it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ctStudyJson("NCT05616793"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetchStudyByNctId("NCT05616793");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.record?.id).toBe("NCT05616793");
    // Hit the /studies/{id} endpoint, not a gene search.
    expect(String(fetchMock.mock.calls[0][0])).toContain("/studies/NCT05616793");
  });

  it("rejects a malformed NCT ID without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchStudyByNctId("NCT123");
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns record: null on a 404 (registry genuinely has no such study)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const res = await fetchStudyByNctId("NCT09999999");
    expect(res).toEqual({ ok: true, record: null });
  });

  it("guards against an ID mismatch in the returned record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ctStudyJson("NCT00000001") })
    );
    const res = await fetchStudyByNctId("NCT05616793");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("mismatch");
  });
});

describe("extractNctIds", () => {
  it("extracts one NCT ID", () => {
    expect(extractNctIds("results of trial NCT05616793 were reported")).toEqual(["NCT05616793"]);
  });

  it("extracts multiple distinct IDs", () => {
    expect(
      extractNctIds("compared NCT01234567 with NCT07654321 across sites").sort()
    ).toEqual(["NCT01234567", "NCT07654321"]);
  });

  it("deduplicates the same ID appearing several times", () => {
    expect(extractNctIds("NCT05616793 ... later, NCT05616793 again")).toEqual(["NCT05616793"]);
  });

  it("normalizes case", () => {
    expect(extractNctIds("registered as nct05616793")).toEqual(["NCT05616793"]);
  });

  it("rejects malformed identifiers (too few / too many digits, spaced)", () => {
    expect(extractNctIds("NCT1234567 and NCT123456789 and NCT 05616793")).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(extractNctIds("")).toEqual([]);
  });
});

describe("collectNctReferences", () => {
  it("maps each NCT ID to the publications that referenced it", () => {
    const refs = collectNctReferences([
      { sourceId: "pubmed:1", title: "Trial NCT05616793 one-year results", abstract: "" },
      { sourceId: "pubmed:2", title: "Review", abstract: "cites NCT05616793 and NCT01234567" },
    ]);
    const byId = Object.fromEntries(refs.map((r) => [r.nctId, r.referencedBySourceIds.sort()]));
    expect(byId["NCT05616793"]).toEqual(["pubmed:1", "pubmed:2"]);
    expect(byId["NCT01234567"]).toEqual(["pubmed:2"]);
  });
});

function trialRecord(id: string): TrialRecord {
  return {
    id,
    source: "clinicaltrials_gov",
    source_url: `https://clinicaltrials.gov/study/${id}`,
    title: `${id} study`,
    status: "RECRUITING",
    conditions: ["Leber congenital amaurosis"],
    genes: ["LCA5"],
    gene_scope: "gene_specific",
    study_type: "interventional",
    intervention_names: [],
    countries: [],
    locations: [],
    contacts: [],
    last_synced_at: "2026-01-01T00:00:00.000Z",
    status_review: "published",
  };
}

function geneSearchSummary(id: string): TrialSummaryRecord {
  return {
    sourceId: `clinicaltrials:${id}`,
    nctId: id,
    title: `${id} study`,
    status: "RECRUITING",
    geneSpecific: true,
    url: `https://clinicaltrials.gov/study/${id}`,
    provenance: "gene_search",
  };
}

describe("mergeLiteratureReferencedTrials", () => {
  it("resolves a literature NCT via a DIRECT CT.gov lookup and merges it", async () => {
    const spy = vi
      .spyOn(source, "fetchStudyByNctId")
      .mockResolvedValue({ ok: true, record: trialRecord("NCT05616793") });

    const { merged, unverified } = await mergeLiteratureReferencedTrials(
      [],
      [{ nctId: "NCT05616793", referencedBySourceIds: ["pubmed:40598770"] }]
    );

    expect(spy).toHaveBeenCalledWith("NCT05616793");
    expect(merged).toHaveLength(1);
    expect(merged[0].nctId).toBe("NCT05616793");
    expect(merged[0].provenance).toBe("discovered_from_literature");
    expect(merged[0].referencedBySourceIds).toEqual(["pubmed:40598770"]);
    expect(unverified).toHaveLength(0);
  });

  it("deduplicates by NCT ID and prefers the existing direct gene-search record", async () => {
    const spy = vi.spyOn(source, "fetchStudyByNctId");
    const { merged } = await mergeLiteratureReferencedTrials(
      [geneSearchSummary("NCT05616793")],
      [{ nctId: "NCT05616793", referencedBySourceIds: ["pubmed:1"] }]
    );
    // No direct fetch needed — the trial was already in the gene-search set.
    expect(spy).not.toHaveBeenCalled();
    expect(merged).toHaveLength(1);
    expect(merged[0].provenance).toBe("gene_search"); // direct record preferred
    expect(merged[0].referencedBySourceIds).toEqual(["pubmed:1"]); // annotated
  });

  it("records an unverified reference when CT.gov has no such study (does not invent one)", async () => {
    vi.spyOn(source, "fetchStudyByNctId").mockResolvedValue({ ok: true, record: null });

    const { merged, unverified } = await mergeLiteratureReferencedTrials(
      [],
      [{ nctId: "NCT09999999", referencedBySourceIds: ["pubmed:2"] }]
    );

    expect(merged).toHaveLength(0); // no fabricated trial
    expect(unverified).toHaveLength(1);
    expect(unverified[0].nctId).toBe("NCT09999999");
    expect(unverified[0].referencedBySourceIds).toEqual(["pubmed:2"]);
  });

  it("records an unverified reference when the registry lookup errors", async () => {
    vi.spyOn(source, "fetchStudyByNctId").mockResolvedValue({ ok: false, error: "HTTP 500" });
    const { merged, unverified } = await mergeLiteratureReferencedTrials(
      [],
      [{ nctId: "NCT08888888", referencedBySourceIds: ["pubmed:3"] }]
    );
    expect(merged).toHaveLength(0);
    expect(unverified[0].reason).toContain("HTTP 500");
  });
});
