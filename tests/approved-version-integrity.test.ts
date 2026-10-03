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

describe("an admin's review and a reviewer's review are different processes", () => {
  const editor = read("components/review/ReviewEditor.tsx");
  const actions = read("app/review/(dashboard)/genes/[draftId]/publish/actions.ts");

  it("each role gets one ending, named for what their review concludes", () => {
    // A reviewer hands work to someone else; an admin's review ends with the
    // page live. One control with branches bolted on is how an admin ended up
    // blocked behind an approval step meant for a different workflow.
    expect(editor).toMatch(/Complete review and publish/);
    expect(editor).toMatch(/Submit for publication/);
  });

  it("the admin's button opens the preview — it does NOT publish from the editor", () => {
    // Publishing from a form full of editing controls is how you ship
    // something you never actually looked at.
    const fn = editor.slice(editor.indexOf("async function completeReviewAndPublish"));
    const body = fn.slice(0, fn.indexOf("\n  }\n"));
    expect(body).toMatch(/router\.push\(reviewHref\(`\/genes\/\$\{props\.draftId\}\/publish`\)\)/);
    expect(body).not.toMatch(/publishAction|publishOwnReviewAction|publishSubmittedReviewAction/);
  });

  it("the editor saves before handing off to the preview", () => {
    // The preview reads from the database; an unsaved edit would otherwise be
    // missing from both the preview and what gets published.
    const fn = editor.slice(editor.indexOf("async function completeReviewAndPublish"));
    expect(fn.slice(0, 400)).toMatch(/await doSave\(\)/);
  });

  it("the editor shows an admin content problems, never a workflow state", () => {
    // "This draft hasn't been approved yet" was shown to an admin who was not
    // waiting on anyone. Approval is not something their review waits for.
    expect(editor).toMatch(/contentBlockers/);
    expect(editor).not.toMatch(/publishReadiness/);
    expect(editor).not.toMatch(/approvalReadiness/);
  });

  it("an own review publishes directly, with no fabricated submit or approve", () => {
    // Walking submit -> approve recorded "Carin submitted" and "Carin
    // approved" — two events that never happened as distinct acts.
    const own = actions.slice(
      actions.indexOf("export async function publishOwnReviewAction"),
      actions.indexOf("export async function publishSubmittedReviewAction")
    );
    expect(own).toMatch(/adminOverride: true/);
    expect(own).not.toMatch(/approveReviewAction|submitReviewAction/);
  });

  it("an own review cannot be used to publish someone else's submission", () => {
    const own = actions.slice(actions.indexOf("export async function publishOwnReviewAction"));
    expect(own).toMatch(/submittedBy && submittedBy !== session\.userId/);
  });

  it("adminOverride skips ONLY the approval requirement, never content checks", () => {
    // The reason an own review can safely use it. An earlier comment claimed
    // it skipped content checks; it never did.
    const gate = read("lib/reviewer/publishGate.ts");
    const fn = gate.slice(gate.indexOf("export function evaluateAdminPublishReadiness"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toMatch(/const blockers = baseContentBlockers\(input\)/);
    expect(body).toMatch(/input\.reviewStatus !== "approved" && !input\.adminOverride/);
  });

  it("a reviewer's submission is approved only if it isn't already", () => {
    // A draft left approved by a failed attempt must be publishable on retry,
    // not refused for being in the state that attempt created.
    const sub = actions.slice(actions.indexOf("export async function publishSubmittedReviewAction"));
    expect(sub).toMatch(/if \(status !== "approved"\)/);
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

describe("retrying a publish does not get worse each time", () => {
  const src = read("app/review/(dashboard)/genes/[draftId]/publish/actions.ts");

  it("does not re-approve a draft that is already approved", () => {
    // The first click advanced unreviewed -> submitted -> approved, then
    // failed at the RPC. Every click after that was refused for being in the
    // state the first click had created: approveReviewAction requires
    // submitted_for_approval, so an already-approved draft got "this draft
    // hasn't been submitted for approval yet" forever.
    expect(src).toMatch(/if \(status !== "approved"\)/);
  });

});

describe("the publish RPC keeps its table aliases", () => {
  it("every WHERE on gene_page_versions is aliased", () => {
    // `returns table (… gene_slug text)` makes gene_slug a PL/pgSQL variable
    // that collides with the column, giving "column reference gene_slug is
    // ambiguous". 0014 fixed it; 0032 rewrote the function from the 0003 copy
    // and silently threw the fix away. 0034 restores it WITH reviewer_name.
    const sql = read("supabase/migrations/0034_restore_publish_alias_and_reviewer_name.sql");
    expect(sql).toMatch(/from public\.gene_page_versions v\b/);
    expect(sql).toMatch(/where v\.gene_slug = p_gene_slug/);
    expect(sql).not.toMatch(/where gene_slug = p_gene_slug/);
    // ...and still records the reviewer.
    expect(sql).toMatch(/reviewer_name/);
  });
});
