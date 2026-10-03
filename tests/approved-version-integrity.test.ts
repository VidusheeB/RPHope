import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// The single guarantee the whole review pipeline exists to make: what goes
// live is what a human actually reviewed. These are source-level assertions
// because the failure mode is a future edit quietly reintroducing
// client-supplied content into the publish path — the kind of change that
// looks harmless in a diff and silently voids medical review.
describe("publication ships the reviewer-approved version", () => {
  const src = read("app/review/actions.ts");
  const publishBody = src.slice(
    src.indexOf("export async function publishAction"),
    src.indexOf("export async function", src.indexOf("export async function publishAction") + 10)
  );

  it("submitting snapshots the approved content", () => {
    const submitBody = src.slice(
      src.indexOf("export async function submitReviewAction"),
      src.indexOf("export async function", src.indexOf("export async function submitReviewAction") + 10)
    );
    expect(submitBody).toMatch(/submitted_content:\s*input\.content/);
  });

  it("publish reads the snapshot from the database", () => {
    expect(publishBody).toMatch(/submitted_content/);
    expect(publishBody).toMatch(/const approvedContent =/);
  });

  it("the version written to the RPC is the snapshot, never the posted content", () => {
    // p_content is what becomes the live public gene page.
    expect(publishBody).toMatch(/p_content:\s*approvedContent/);
    expect(publishBody).not.toMatch(/p_content:\s*input\.content/);
  });

  it("the readiness gate evaluates the same content that ships", () => {
    // Gating on one version and publishing another would let a draft pass
    // checks it never actually satisfied.
    expect(publishBody).toMatch(/draft:\s*approvedContent/);
  });

  it("the draft row is aligned to the published version, not to client input", () => {
    expect(publishBody).toMatch(/serializeDraft\(approvedContent\)/);
  });
});

describe("the snapshot cannot be forged", () => {
  it("submitted_content is inside the workflow-column guard", () => {
    // Without this, a reviewer's own RLS-scoped client could rewrite the
    // snapshot after approval and change what an admin publishes.
    const sql = read("supabase/migrations/0026_approved_version_snapshot.sql");
    expect(sql).toMatch(/new\.submitted_content is distinct from old\.submitted_content/);
    expect(sql).toMatch(/service_role/);
  });

  it("the column exists and is documented as immutable", () => {
    const sql = read("supabase/migrations/0026_approved_version_snapshot.sql");
    expect(sql).toMatch(/add column if not exists submitted_content jsonb/);
    expect(sql).toMatch(/comment on column gene_page_drafts\.submitted_content/);
  });
});

describe("an admin reviewing their own assignment can publish it", () => {
  const src = read("app/review/(dashboard)/genes/[draftId]/publish/actions.ts");

  it("carries out the outstanding review and approval steps", () => {
    // Carin self-assigns a gene, reviews it, and is then doing all three jobs.
    // Previously only Publish was offered, gated on an approval nobody else
    // was going to perform, so the button sat disabled saying "This draft
    // hasn't been approved yet" — naming a state without naming who changes it.
    expect(src).toMatch(/submitReviewAction/);
    expect(src).toMatch(/approveReviewAction/);
    expect(src).toMatch(/publishAction/);
  });

  it("each step still goes through its own hardened action", () => {
    // Not a bypass: every transition is gated and audited exactly as if three
    // different people had performed it.
    expect(src).toMatch(/if \(!can\(session\.profile, "genes\.submit"\)\)/);
    expect(src).toMatch(/if \(!can\(session\.profile, "genes\.approve"\)\)/);
    expect(src).toMatch(/can\(session\.profile, "genes\.publish"\)/);
  });

  it("the editor does not show an approval blocker to someone who can approve", () => {
    const editor = read("components/review/ReviewEditor.tsx");
    expect(editor).toMatch(/adminOverride: props\.canApprove/);
  });

  it("the editor saves before publishing", () => {
    // The publish path reads the draft from the database, so an unsaved edit
    // would otherwise be silently left out of what goes live.
    const editor = read("components/review/ReviewEditor.tsx");
    const body = editor.slice(editor.indexOf("async function publish()"));
    expect(body.slice(0, 400)).toMatch(/await doSave\(\)/);
  });
});

describe("Assigned to me is a filter, not a workflow bucket", () => {
  const cc = read("components/review/genes/GeneControlCenter.tsx");

  it("filters the same rows rather than removing them from their queue", () => {
    // A gene assigned to you is still In Review. Making ownership a bucket
    // would take it out of the queue everyone else reads.
    expect(cc).toMatch(/tab === "mine"/);
    expect(cc).toMatch(/r\.assignedReviewerId === viewerId/);
  });

  it("hides itself when nothing is assigned to you", () => {
    expect(cc).toMatch(/t\.id === "failed" \|\| t\.id === "mine"/);
  });
});

describe("there is exactly one snake_case -> draft mapper", () => {
  it("the publish path uses draftRowToContent, not a local copy", () => {
    // A second mapper in publicationQueue.ts omitted gene, reviewStatus and
    // generatedAt. Nothing caught it until publish ran schema validation and
    // refused with "data must have required property 'gene'" — after the
    // admin had already ticked the review confirmation.
    const publishActions = read("app/review/(dashboard)/genes/[draftId]/publish/actions.ts");
    expect(publishActions).toMatch(/draftRowToContent/);
    expect(publishActions).not.toMatch(/rowToDraft/);
  });

  it("no duplicate mapper survives anywhere", () => {
    for (const f of ["lib/genes/publicationQueue.ts", "app/review/(dashboard)/genes/[draftId]/publish/actions.ts"]) {
      expect(read(f)).not.toMatch(/function rowToDraft/);
    }
  });

  it("the canonical mapper supplies every schema-required top-level field", () => {
    // These three are exactly what the duplicate dropped.
    const data = read("lib/reviewer/data.ts");
    const body = data.slice(data.indexOf("export function draftRowToContent"));
    for (const field of ["gene:", "reviewStatus:", "generatedAt:"]) {
      expect(body.slice(0, 1200)).toContain(field);
    }
  });
});
