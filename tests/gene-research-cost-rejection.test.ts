// Regression: a post-generation rejection was still billed by Opus. The
// pipeline must PRESERVE and REPORT the real input tokens, output tokens, and
// cost on a rejected draft — and (in the CLI) count that spend toward
// --max-cost. Before the fix, DraftRejectedError carried only the reasons, so
// the cost of a rejected draft silently vanished and never counted against the
// budget.
//
// generateGenePage is stubbed via vi.spyOn (no real Opus call). The real
// DraftRejectedError / GenerationError classes are used, so the pipeline's
// `instanceof` checks resolve exactly as they do in production.

import { describe, it, expect, vi, afterEach } from "vitest";
import * as generate from "@/lib/geneResearch/generate";
import { DraftRejectedError, GenerationError } from "@/lib/geneResearch/generate";
import { generateAndSaveDraft } from "@/lib/geneResearch/pipeline";
import type { GeneSourceBundle } from "@/lib/geneResearch/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// generateAndSaveDraft only touches supabase on the SUCCESS path; a rejection/
// failure returns before any insert, so this stub is never called here.
const fakeSupabase = {} as unknown as SupabaseClient;

function bundle(): GeneSourceBundle {
  return {
    geneSymbol: "LCA5",
    geneSlug: "lca5",
    evidence: null,
    geneRecord: { sourceId: "ncbi-gene:167691", geneId: "167691", symbol: "LCA5", aliases: [] },
    literatureRecords: [],
    trialRecords: [],
    approvedResources: [],
    webFallbackRecords: [],
    unverifiedTrialReferences: [],
  };
}

const USAGE = { inputTokens: 8000, outputTokens: 4000, estimatedCostUsd: 0.14 };

afterEach(() => vi.restoreAllMocks());

describe("cost accounting on post-generation rejection", () => {
  it("DraftRejectedError carries the billed usage", () => {
    const err = new DraftRejectedError(
      [{ code: "unknown_source_id", detail: "pubmed:99999999" }],
      USAGE
    );
    expect(err.usage).toEqual(USAGE);
    expect(err.reasons[0].code).toBe("unknown_source_id");
  });

  it("generateAndSaveDraft preserves tokens, cost, and reasons on rejection", async () => {
    vi.spyOn(generate, "generateGenePage").mockRejectedValue(
      new DraftRejectedError([{ code: "schema_validation_failed", detail: "missing field" }], USAGE)
    );

    const result = await generateAndSaveDraft(fakeSupabase, bundle());

    expect(result.outcome).toBe("rejected");
    if (result.outcome === "rejected") {
      expect(result.inputTokens).toBe(USAGE.inputTokens);
      expect(result.outputTokens).toBe(USAGE.outputTokens);
      expect(result.estimatedCostUsd).toBe(USAGE.estimatedCostUsd);
      expect(result.reasons.map((r) => r.code)).toContain("schema_validation_failed");
    }
  });

  it("simulates the CLI budget rule: a rejected-but-billed gene increments cumulative cost", async () => {
    vi.spyOn(generate, "generateGenePage").mockRejectedValue(
      new DraftRejectedError([{ code: "unknown_source_id", detail: "web:1" }], USAGE)
    );

    // Mirror the CLI's accounting: rejected spend still counts toward --max-cost.
    let cumulativeCost = 0;
    const result = await generateAndSaveDraft(fakeSupabase, bundle());
    if (result.outcome === "rejected" && typeof result.estimatedCostUsd === "number") {
      cumulativeCost += result.estimatedCostUsd;
    }
    expect(cumulativeCost).toBeCloseTo(USAGE.estimatedCostUsd, 5);
  });

  it("carries usage on a post-billing GenerationError (e.g. unparseable response)", async () => {
    vi.spyOn(generate, "generateGenePage").mockRejectedValue(
      new GenerationError("Opus response for LCA5 was not valid JSON.", USAGE)
    );

    const result = await generateAndSaveDraft(fakeSupabase, bundle());
    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.estimatedCostUsd).toBe(USAGE.estimatedCostUsd);
    }
  });

  it("reports NO cost when the failure happened before any billing (usage absent)", async () => {
    vi.spyOn(generate, "generateGenePage").mockRejectedValue(
      new GenerationError("ANTHROPIC_API_KEY is not set.")
    );

    const result = await generateAndSaveDraft(fakeSupabase, bundle());
    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.estimatedCostUsd).toBeUndefined();
    }
  });
});
