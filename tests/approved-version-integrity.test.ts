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
