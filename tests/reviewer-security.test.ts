import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) out.push(...walk(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

describe("service-role credentials never reach the client", () => {
  const files = [...walk("components"), "lib/supabaseBrowser.ts"];

  it("no client-side file imports the service-role admin client", () => {
    const offenders = files.filter((f) => {
      const src = read(f);
      return /from ["'].*supabaseAdmin["']/.test(src) || /getServiceSupabase/.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("no client-side file references the service-role key env var", () => {
    const offenders = files.filter((f) => read(f).includes("SUPABASE_SERVICE_ROLE_KEY"));
    expect(offenders).toEqual([]);
  });

  it("the browser Supabase client uses only the anon key", () => {
    const src = read("lib/supabaseBrowser.ts");
    expect(src).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(src).not.toContain("SERVICE_ROLE");
  });
});

describe("RLS is enforced at the database, not only in the UI", () => {
  const sql = read("supabase/migrations/0003_reviewer_portal.sql");

  it("enables RLS on every new table", () => {
    for (const t of ["reviewer_profiles", "draft_assignments", "review_flag_resolutions", "gene_page_versions"]) {
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`, "i"));
    }
  });

  it("scopes draft reads to assigned reviewers (or admins)", () => {
    expect(sql).toContain("auth_is_assigned(id)");
    expect(sql.toLowerCase()).toContain("gpd_select_assigned");
  });

  it("gives reviewers NO direct write path to published versions (publish is server-only)", () => {
    // gene_page_versions should have a SELECT policy but no reviewer insert/update/delete policy.
    expect(sql).toContain("gpv_public_read_published");
    expect(sql).not.toMatch(/create policy .*on gene_page_versions\s+for insert/i);
    expect(sql).not.toMatch(/create policy .*on gene_page_versions\s+for update/i);
  });

  it("lets only admins modify assignments and reviewer roles", () => {
    expect(sql).toContain("da_admin_write");
    expect(sql).toContain("rp_admin_write");
    // reviewer_profiles has no self-update policy (a reviewer can't elevate role/can_publish).
    expect(sql).not.toMatch(/create policy .*on reviewer_profiles\s+for update\s+using \(user_id = auth\.uid/i);
  });
});

describe("SECURITY DEFINER hardening", () => {
  const sql = read("supabase/migrations/0003_reviewer_portal.sql");

  it("every SECURITY DEFINER function sets an explicit search_path", () => {
    // Scope to each function SIGNATURE (text before the `as $$` body), so prose
    // in comments that mentions "SECURITY DEFINER" doesn't pollute the count.
    const signatures = sql
      .split(/create or replace function/i)
      .slice(1)
      .map((chunk) => chunk.split(/\bas\s+\$\$/i)[0]);
    const definerSigs = signatures.filter((s) => /security definer/i.test(s));
    const withPath = definerSigs.filter((s) => /set search_path\s*=/i.test(s));
    expect(definerSigs.length).toBeGreaterThan(0);
    expect(withPath.length).toBe(definerSigs.length);
  });

  it("SECURITY DEFINER functions use an EMPTY search_path and schema-qualify tables", () => {
    expect(sql).toMatch(/security definer set search_path = ''/i);
    expect(sql).toContain("public.reviewer_profiles");
    expect(sql).toContain("public.draft_assignments");
  });

  it("authz helpers key off auth.uid(), never a caller-supplied user id", () => {
    // auth_is_admin takes no args; the assignment helpers take only a draft id.
    expect(sql).toMatch(/function public\.auth_is_admin\(\)/);
    expect(sql).toMatch(/function public\.auth_is_assigned\(d uuid\)/);
    expect(sql).not.toMatch(/function public\.auth_is_admin\(.*uuid/);
  });

  it("restricts EXECUTE on the authz helpers away from PUBLIC", () => {
    expect(sql).toMatch(/revoke execute on function public\.auth_is_admin\(\) from public/);
    expect(sql).toMatch(/grant execute on function public\.auth_is_admin\(\) to authenticated/);
  });
});

describe("original AI review flags are preserved (resolutions stored separately)", () => {
  it("the resolutions table copies the original flag text immutably", () => {
    const sql = read("supabase/migrations/0003_reviewer_portal.sql");
    expect(sql).toContain("original_flag_text text not null");
  });

  it("the draft-save serializers never overwrite the review_flags column", () => {
    // Neither the publish serializer nor the editor serializer writes review_flags
    // on an EXISTING draft, so the AI-generated flags array on gene_page_drafts
    // stays intact. Scoped to serializeDraft() itself (shared by saveDraftAction
    // and publishAction) rather than the whole file — restoreVersionAction
    // legitimately sets review_flags when INSERTing a brand-new draft row from a
    // historical snapshot, which is a different operation, not an overwrite.
    const actionsSrc = read("app/review/actions.ts");
    const serializeDraftBody = actionsSrc.slice(
      actionsSrc.indexOf("function serializeDraft"),
      actionsSrc.indexOf("function serializeDraft") + actionsSrc.slice(actionsSrc.indexOf("function serializeDraft")).indexOf("\n}\n")
    );
    expect(serializeDraftBody).not.toMatch(/review_flags:/);
    expect(read("components/review/ReviewEditor.tsx")).not.toMatch(/review_flags:/);
  });
});

describe("capability checks are the boundary, not role literals", () => {
  const portalFiles = [...walk("app/review"), ...walk("lib/reviewer"), ...walk("components/review")];

  it("nothing outside permissions.ts/session.ts branches on a role name", () => {
    // The whole point of the capability model: adding a role must not require
    // auditing scattered `role === "admin"` comparisons. Those two files are
    // the only places allowed to know role names exist.
    // The rule bans branching on the CALLER's role to decide what they may do.
    // Comparing ANOTHER person's role as data — filtering a roster by
    // category, or counting how many admins would remain — is a fact about the
    // organisation, not an authorization decision, and has no capability to
    // express it. Those files are listed here with that reasoning; anything
    // added must be re-read to confirm it is not gating the caller.
    const allowed = new Set([
      "lib/reviewer/permissions.ts",
      "lib/reviewer/session.ts",
      "app/review/(dashboard)/admin/reviewers/actions.ts", // last-admin count
      "components/review/TeamTable.tsx", // roster category filter
    ]);
    const offenders = portalFiles.filter((f) => {
      if (allowed.has(f)) return false;
      return /\brole\s*[!=]==\s*["']admin["']/.test(read(f));
    });
    expect(offenders).toEqual([]);
  });

  it("no ENTRY POINT reads the service-role client behind an identity-only gate", () => {
    // The regression guard for the story leak: requireReviewer() establishes
    // WHO you are and grants nothing. A page or server action that opens the
    // service-role client (which bypasses RLS entirely) must additionally
    // prove a capability, or the DB is enforcing nothing and neither is
    // the app.
    //
    // Scoped to app/review — the routable surface. The lib/reviewer/* data
    // helpers also use the service client but are not reachable directly;
    // by established convention (see their headers) their CALLER does the
    // gating, and that caller is covered by this check.
    //
    // SELF-SCOPED EXEMPTIONS. Managing your OWN account is not a privilege, so
    // these are gated on identity alone. They qualify only because every write
    // is constrained to the caller's own row via session.userId and touches a
    // fixed, non-privilege column set — reviewer_profiles has no self-update
    // RLS policy precisely so role/can_publish cannot be self-edited, which is
    // why these go through the service client at all. Adding a file here is a
    // deliberate act: re-read it and confirm it cannot be aimed at another
    // user's record.
    const selfScoped = new Set(["app/review/(dashboard)/settings/actions.ts"]);
    const entryPoints = walk("app/review").filter((f) => !selfScoped.has(f));
    const offenders = entryPoints.filter((f) => {
      const src = read(f);
      const usesServiceRole = /getServiceSupabase/.test(src);
      const checksCapability = /requireCapability\(|\bcan\(/.test(src);
      return usesServiceRole && !checksCapability;
    });
    expect(offenders).toEqual([]);
  });

  it("story submissions are gated on stories.review wherever they are read", () => {
    // These rows carry submitter PII (full_name / email / phone / consent).
    for (const f of [
      "app/review/(dashboard)/stories/page.tsx",
      "app/review/(dashboard)/stories/[id]/page.tsx",
      "app/review/(dashboard)/stories/actions.ts",
    ]) {
      expect(read(f)).toMatch(/requireCapability\("stories\.review"\)/);
    }
  });
});

describe("the public story surface cannot reach private columns", () => {
  it("the public repo reads the view, never the base table", () => {
    // RLS filters rows, not columns, so `status = 'published'` on the base
    // table still exposed full_name/email/phone/approval_token to the anon
    // key. The view is what narrows the columns in the database rather than
    // relying on this file's SELECT list.
    const src = read("lib/storySubmissionsRepo.ts");
    expect(src).toMatch(/public_stories/);
    expect(src).not.toMatch(/\.from\(\s*["']story_submissions["']\s*\)/);
  });

  it("the public repo never requests a private column", () => {
    // Strip comments first — the file legitimately DISCUSSES these column
    // names when explaining what it deliberately no longer fetches.
    const src = read("lib/storySubmissionsRepo.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const col of ["full_name", "phone", "consent_to_publish", "edit_permission", "approval_token", "contact_method"]) {
      expect(src).not.toMatch(new RegExp(`\\b${col}\\b`));
    }
  });

  it("the migration revokes the blanket anon/authenticated grant", () => {
    const sql = read("supabase/migrations/0024b_story_revoke_base_table.sql");
    expect(sql).toMatch(/revoke all on public\.story_submissions from anon, authenticated/);
  });

  it("the view resolves display_contact instead of exposing both columns", () => {
    const sql = read("supabase/migrations/0024_story_public_view.sql");
    expect(sql).toMatch(/case display_contact/);
    expect(sql).toMatch(/as contact_value/);
    // The view must NOT be created with security_invoker: that would require
    // the caller to hold SELECT on email/phone, defeating the mechanism. The
    // file mentions the option in prose to explain why it's rejected, so
    // assert on the actual clause rather than the word.
    expect(sql).not.toMatch(/with\s*\(\s*security_invoker/i);
  });
});

describe("self-scoped account actions cannot be aimed at someone else", () => {
  const src = read("app/review/(dashboard)/settings/actions.ts");

  it("derives the target user from the session, never from an argument", () => {
    // The exemption in the service-role check above is only defensible while
    // this holds. If a userId ever becomes a parameter here, one admin could
    // rewrite another person's account.
    expect(src).toMatch(/\.eq\("user_id",\s*session\.userId\)/);
    expect(src).not.toMatch(/userId:\s*string/);
  });

  it("never writes a privilege column", () => {
    // reviewer_profiles.role / can_publish are granted by an admin from My
    // Team. A self-service page must not be able to touch them.
    for (const col of ["role:", "can_publish:", "active:"]) {
      expect(src).not.toContain(col);
    }
  });

  it("requires the current password before changing it", () => {
    // Supabase's updateUser() does not verify the old password, so an
    // unattended session would otherwise be enough to lock out the real owner
    // of an account that can publish medical content.
    expect(src).toMatch(/signInWithPassword/);
    expect(src).toMatch(/currentPassword/);
  });

  it("verifies with a throwaway client so a failed check can't sign you out", () => {
    expect(src).toMatch(/persistSession:\s*false/);
  });
});
