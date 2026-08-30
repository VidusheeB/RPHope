// Audit-metadata invariants for gene_page_drafts, and the one-off cleanup of
// the admin edit/publish test prefixes.

import { describe, it, expect } from "vitest";
import {
  contentEditStamp,
  approvalStamp,
  reopenStamp,
  hasInconsistentReviewStamp,
  PENDING_REVIEW_STATUSES,
} from "@/lib/reviewer/auditStamp";
import { stripPrefix, onlyFirstSentenceChanged } from "@/scripts/cleanup-admin-test-prefixes.mjs";
import { planBackfill } from "@/scripts/backfill-review-metadata.mjs";

const USER = "b164df0d-9ee7-46c0-9ac3-f47d57313663";
const AT = new Date("2026-08-29T10:00:00.000Z");

describe("content edits stamp the editor, never the reviewer", () => {
  it("sets last_edited_by and last_activity_at", () => {
    const s = contentEditStamp(USER, AT);
    expect(s.last_edited_by).toBe(USER);
    expect(s.last_activity_at).toBe("2026-08-29T10:00:00.000Z");
  });

  it("saving a draft must NOT set reviewed_at or reviewed_by", () => {
    const s = contentEditStamp(USER, AT);
    expect(s).not.toHaveProperty("reviewed_at");
    expect(s).not.toHaveProperty("reviewed_by");
  });

  it("applies identically to an admin edit and a reviewer edit", () => {
    // Both paths build the patch from this one helper, so they cannot drift.
    expect(contentEditStamp("admin-id", AT)).toEqual({
      last_edited_by: "admin-id",
      last_activity_at: AT.toISOString(),
    });
  });
});

describe("approval records both halves of the reviewer identity", () => {
  it("sets reviewed_by AND reviewed_at together", () => {
    const s = approvalStamp(USER, AT);
    expect(s.reviewed_by).toBe(USER);
    expect(s.reviewed_at).toBe(AT.toISOString());
  });

  it("also counts as an edit for activity purposes", () => {
    const s = approvalStamp(USER, AT);
    expect(s.last_edited_by).toBe(USER);
    expect(s.last_activity_at).toBe(AT.toISOString());
  });

  it("is never half-recorded — the defect this replaces", () => {
    expect(hasInconsistentReviewStamp({ review_status: "approved", ...approvalStamp(USER, AT) })).toBe(false);
    // The exact broken shape found on RPGR, LCA5, KIZ and INPP5E:
    expect(hasInconsistentReviewStamp({ review_status: "approved", reviewed_by: USER, reviewed_at: null })).toBe(true);
    expect(hasInconsistentReviewStamp({ review_status: "approved", reviewed_by: null, reviewed_at: AT.toISOString() })).toBe(true);
  });

  it("treats an approved row with no reviewed_at as inconsistent", () => {
    expect(hasInconsistentReviewStamp({ review_status: "approved" })).toBe(true);
  });
});

describe("reopening an approved page clears the stale approval", () => {
  it("nulls reviewed_by and reviewed_at", () => {
    const s = reopenStamp(USER, AT);
    expect(s.reviewed_by).toBeNull();
    expect(s.reviewed_at).toBeNull();
  });

  it("still records who caused the change", () => {
    expect(reopenStamp(USER, AT).last_edited_by).toBe(USER);
  });

  it("leaves a consistent stamp", () => {
    expect(hasInconsistentReviewStamp({ review_status: "changes_requested", ...reopenStamp(USER, AT) })).toBe(false);
  });

  it("covers every pending status the workflow can return to", () => {
    expect(PENDING_REVIEW_STATUSES).toContain("changes_requested");
    expect(PENDING_REVIEW_STATUSES).toContain("submitted_for_approval");
    expect(PENDING_REVIEW_STATUSES).toContain("unreviewed");
    expect(PENDING_REVIEW_STATUSES).not.toContain("approved");
  });
});

describe("automated generation is not a reviewer", () => {
  it("the pipeline's insert writes no reviewer or editor identity", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("lib/geneResearch/pipeline.ts", "utf8")
    );
    const insertBlock = src.slice(
      src.indexOf('from("gene_page_drafts").insert({'),
      src.indexOf('from("gene_page_drafts").insert({') + 1400
    );
    expect(insertBlock).toContain('review_status: "unreviewed"');
    expect(insertBlock).not.toContain("reviewed_by");
    expect(insertBlock).not.toContain("reviewed_at");
    expect(insertBlock).not.toContain("last_edited_by");
  });
});

describe("admin test-prefix cleanup preserves everything else", () => {
  const RPGR = {
    sentences: [
      { text: "HELLO TESTING RPGR is a gene.", sourceIds: ["ncbi-gene:6103", "pubmed:38278208"] },
      { text: "A second sentence.", sourceIds: ["europepmc:41539649"] },
    ],
  };
  const LCA5 = { text: "blah blah LCA5 provides instructions.", sourceIds: ["ncbi-gene:167691"] };
  const KIZ = { sentences: [{ text: "HELLO KIZ is a gene.", sourceIds: ["pubmed:24680887"] }] };

  it("strips the prefix from the sentences[] shape", () => {
    expect(stripPrefix(RPGR, "HELLO TESTING ").sentences[0].text).toBe("RPGR is a gene.");
  });

  it("strips the prefix from the older { text } shape", () => {
    expect(stripPrefix(LCA5, "blah blah ").text).toBe("LCA5 provides instructions.");
  });

  it("preserves every source ID and every later sentence, byte for byte", () => {
    const after = stripPrefix(RPGR, "HELLO TESTING ");
    expect(after.sentences[0].sourceIds).toEqual(["ncbi-gene:6103", "pubmed:38278208"]);
    expect(after.sentences[1]).toEqual(RPGR.sentences[1]);
    expect(onlyFirstSentenceChanged(RPGR, after)).toBe(true);
  });

  it("changes nothing but the leading prefix of the first sentence", () => {
    const after = stripPrefix(KIZ, "HELLO ");
    expect(after.sentences[0].text).toBe("KIZ is a gene.");
    expect(onlyFirstSentenceChanged(KIZ, after)).toBe(true);
  });

  it("is idempotent — a clean row is left alone", () => {
    const clean = stripPrefix(RPGR, "HELLO TESTING ");
    expect(stripPrefix(clean, "HELLO TESTING ")).toBeNull();
  });

  it("only strips the prefix at the START, never mid-text", () => {
    const mid = { sentences: [{ text: "KIZ says HELLO to the retina.", sourceIds: [] }] };
    expect(stripPrefix(mid, "HELLO ")).toBeNull();
  });

  it("detects tampering beyond the first sentence", () => {
    const tampered = structuredClone(RPGR);
    tampered.sentences[0].text = "RPGR is a gene.";
    tampered.sentences[1].sourceIds = ["changed"];
    expect(onlyFirstSentenceChanged(RPGR, tampered)).toBe(false);
  });
});

describe("historical backfill never invents data", () => {
  const draft = { id: "d1", gene_symbol: "RPGR", reviewed_by: USER, reviewed_at: null };

  it("reconstructs from a published version linked to the draft", () => {
    const plan = planBackfill(draft, [
      { source_draft_id: "d1", approved_by: USER, approved_at: "2026-07-13T02:56:35.316015+00:00" },
    ]);
    expect(plan.action).toBe("backfill");
    expect(plan.reviewed_at).toBe("2026-07-13T02:56:35.316015+00:00");
  });

  it("prefers the most recent real approval event (KIZ was published twice)", () => {
    const plan = planBackfill(
      { ...draft, gene_symbol: "KIZ" },
      [{ source_draft_id: "d1", approved_by: USER, approved_at: "2026-07-13T02:56:37.218706+00:00" }],
      [{ draft_id: "d1", action: "draft_published", actor: USER, created_at: "2026-08-05T02:35:03.550422+00:00" }]
    );
    expect(plan.reviewed_at).toBe("2026-08-05T02:35:03.550422+00:00");
    expect(plan.source).toBe("audit_log:draft_published");
  });

  it("refuses when no recorded event exists", () => {
    const plan = planBackfill(draft, [], []);
    expect(plan.action).toBe("needs_decision");
  });

  it("refuses when the recorded actor disagrees with reviewed_by", () => {
    const plan = planBackfill(draft, [
      { source_draft_id: "d1", approved_by: "someone-else", approved_at: "2026-07-13T00:00:00.000Z" },
    ]);
    expect(plan.action).toBe("needs_decision");
    expect(plan.reason).toMatch(/disagrees/);
  });

  it("ignores versions belonging to a different draft", () => {
    const plan = planBackfill(draft, [
      { source_draft_id: "OTHER", approved_by: USER, approved_at: "2026-07-13T00:00:00.000Z" },
    ]);
    expect(plan.action).toBe("needs_decision");
  });
});
