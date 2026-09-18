import { describe, it, expect } from "vitest";
import { bucketFor, countBuckets, type GeneControlRow } from "@/lib/genes/controlCenter";
import type { AdminDraftRow } from "@/lib/reviewer/data";

const draft = (over: Partial<AdminDraftRow> = {}): AdminDraftRow =>
  ({
    draftId: "d1",
    geneSlug: "rpgr",
    geneSymbol: "RPGR",
    reviewState: "assigned",
    publicationState: "draft",
    flagCount: 0,
    unresolvedFlags: 0,
    updatedAt: null,
    assignedAt: null,
    assignmentStatus: "assigned",
    openTicketCount: 0,
    blockingTicketCount: 0,
    hasPublishedVersion: false,
    sentencesVerified: 0,
    sentencesTotal: 0,
    assignedReviewerId: null,
    ...over,
  }) as AdminDraftRow;

describe("gene bucket derivation", () => {
  it("a gene with no draft and no job needs generation", () => {
    expect(bucketFor(false, null, undefined)).toBe("needs_generation");
  });

  it("queued and running genes stay in Needs Generation, not a limbo bucket", () => {
    // They're still ungenerated work; the row shows the live job status via a
    // badge rather than moving between tabs mid-run (which would make a gene
    // appear to vanish while an admin is watching it).
    expect(bucketFor(false, "queued", undefined)).toBe("needs_generation");
    expect(bucketFor(false, "running", undefined)).toBe("needs_generation");
  });

  it("a failed job gets its own bucket so it surfaces for retry", () => {
    expect(bucketFor(false, "failed", undefined)).toBe("failed");
  });

  it("a generated but unassigned draft is Unassigned", () => {
    expect(bucketFor(true, "complete", draft({ reviewState: "unassigned" }))).toBe("unassigned");
  });

  it("an assigned or in-progress draft is In Review", () => {
    expect(bucketFor(true, "complete", draft({ reviewState: "assigned" }))).toBe("in_review");
    expect(bucketFor(true, "complete", draft({ reviewState: "in_progress" }))).toBe("in_review");
    expect(bucketFor(true, "complete", draft({ reviewState: "changes_requested" }))).toBe("in_review");
  });

  it("both reviewer-submitted and admin-approved share the publication queue", () => {
    // The reviewer's "Approve Review" produces `submitted`; a separate admin
    // approval produces `approved`. Operationally both mean "a human is done,
    // an administrator must act", so they must not split across two tabs.
    expect(bucketFor(true, "complete", draft({ reviewState: "submitted" }))).toBe("awaiting_publication");
    expect(bucketFor(true, "complete", draft({ reviewState: "approved" }))).toBe("awaiting_publication");
  });

  it("publication state wins over review state once live", () => {
    // A published gene with a fresh draft in review must read as Published
    // here — the publication queue is about what is waiting on an admin.
    expect(
      bucketFor(true, "complete", draft({ reviewState: "approved", publicationState: "published" }))
    ).toBe("published");
  });

  it("a draft row that is missing is treated as ungenerated, not crashed", () => {
    // Defensive: hasDraft can disagree with the joined row if a draft is
    // deleted between the two reads.
    expect(bucketFor(true, "complete", undefined)).toBe("needs_generation");
  });
});

describe("bucket counts", () => {
  it("counts sum to the catalogue so tab totals are trustworthy", () => {
    const rows = [
      { bucket: "needs_generation" },
      { bucket: "needs_generation" },
      { bucket: "unassigned" },
      { bucket: "published" },
    ] as GeneControlRow[];
    const counts = countBuckets(rows);
    expect(counts.all).toBe(4);
    expect(counts.needs_generation).toBe(2);
    expect(counts.unassigned).toBe(1);
    expect(counts.published).toBe(1);
    expect(counts.failed).toBe(0);
    const summed =
      counts.needs_generation +
      counts.failed +
      counts.unassigned +
      counts.in_review +
      counts.awaiting_publication +
      counts.published;
    expect(summed).toBe(counts.all);
  });
});
