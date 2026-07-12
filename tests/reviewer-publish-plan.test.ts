import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPublishPlan, type ExistingVersion } from "@/lib/reviewer/publishPlan";
import { pickPublicGeneContent, pickNewestPublished } from "@/lib/reviewer/publicContent";
import { deriveDashboardStatus } from "@/lib/reviewer/dashboardStatus";
import type { GenePageDraft } from "@/lib/geneResearch/types";

const draft = { gene: "LCA5" } as unknown as GenePageDraft;

describe("buildPublishPlan", () => {
  it("creates a new published version numbered 1 for a first publish", () => {
    const plan = buildPublishPlan({
      geneSlug: "lca5",
      draftId: "d1",
      content: draft,
      approverId: "u1",
      existingVersions: [],
      now: "2026-07-12T00:00:00.000Z",
    });
    expect(plan.archiveVersionIds).toEqual([]);
    expect(plan.newVersion.version_number).toBe(1);
    expect(plan.newVersion.status).toBe("published");
    expect(plan.newVersion.approved_by).toBe("u1");
    expect(plan.newVersion.published_at).toBe("2026-07-12T00:00:00.000Z");
  });

  it("archives the previous PUBLISHED version and increments the number", () => {
    const existing: ExistingVersion[] = [
      { id: "v1", version_number: 1, status: "archived" },
      { id: "v2", version_number: 2, status: "published" },
    ];
    const plan = buildPublishPlan({
      geneSlug: "lca5",
      draftId: "d1",
      content: draft,
      approverId: "u1",
      existingVersions: existing,
    });
    // Only the currently-published one is archived (not the already-archived one).
    expect(plan.archiveVersionIds).toEqual(["v2"]);
    expect(plan.newVersion.version_number).toBe(3);
  });
});

describe("pickPublicGeneContent — public route source selection", () => {
  it("PREFERS the published Supabase version when present", () => {
    const published = { versionNumber: 2, content: draft };
    const picked = pickPublicGeneContent(published, { legacy: true });
    expect(picked?.source).toBe("published");
    if (picked?.source === "published") expect(picked.content).toBe(draft);
  });

  it("FALLS BACK to genesData.json content when no published version exists", () => {
    const fallback = { legacy: true };
    const picked = pickPublicGeneContent(null, fallback);
    expect(picked?.source).toBe("fallback");
    if (picked?.source === "fallback") expect(picked.content).toBe(fallback);
  });

  it("returns null when neither source has content", () => {
    expect(pickPublicGeneContent(null, null)).toBeNull();
  });
});

describe("pickNewestPublished — public route never serves an archived version", () => {
  it("returns the PUBLISHED row even when a newer row is archived", () => {
    const rows = [
      { version_number: 3, status: "archived", content: { gene: "v3-archived" } },
      { version_number: 2, status: "published", content: { gene: "v2-published" } },
    ];
    const picked = pickNewestPublished(rows);
    expect(picked?.versionNumber).toBe(2);
    expect((picked?.content as { gene: string }).gene).toBe("v2-published");
  });

  it("returns null when every row is archived", () => {
    expect(
      pickNewestPublished([{ version_number: 5, status: "archived", content: {} }])
    ).toBeNull();
  });

  it("picks the highest version_number among published rows", () => {
    const rows = [
      { version_number: 1, status: "published", content: { gene: "old" } },
      { version_number: 4, status: "published", content: { gene: "new" } },
    ];
    expect(pickNewestPublished(rows)?.versionNumber).toBe(4);
  });
});

describe("public content query filters status = 'published' at the DB layer", () => {
  it("getPublishedGeneVersion pins the query to published rows", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/reviewer/publicContent.ts"),
      "utf8"
    );
    expect(src).toContain('.eq("status", "published")');
  });
});

describe("deriveDashboardStatus", () => {
  const base = {
    assignmentStatus: "assigned" as const,
    hasPublishedVersion: false,
    flagCount: 3,
    unresolvedFlags: 3,
    sectionsComplete: false,
    hasEdits: false,
    reopened: false,
  };

  it("Not started for a fresh assignment", () => {
    expect(deriveDashboardStatus(base)).toBe("Not started");
  });
  it("Draft in progress once editing begins", () => {
    expect(deriveDashboardStatus({ ...base, unresolvedFlags: 1 })).toBe("Draft in progress");
  });
  it("Ready to publish when flags resolved + sections complete", () => {
    expect(
      deriveDashboardStatus({ ...base, unresolvedFlags: 0, sectionsComplete: true })
    ).toBe("Ready to publish");
  });
  it("Published when a version exists or the assignment is completed", () => {
    expect(deriveDashboardStatus({ ...base, assignmentStatus: "completed" })).toBe("Published");
    expect(deriveDashboardStatus({ ...base, hasPublishedVersion: true })).toBe("Published");
  });
  it("Changes requested when re-opened after publication", () => {
    expect(
      deriveDashboardStatus({ ...base, hasPublishedVersion: true, reopened: true })
    ).toBe("Changes requested");
  });
});
