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
    // Neither the publish serializer nor the editor serializer writes review_flags,
    // so the AI-generated flags array on gene_page_drafts stays intact.
    expect(read("app/review/actions.ts")).not.toMatch(/review_flags:/);
    expect(read("components/review/ReviewEditor.tsx")).not.toMatch(/review_flags:/);
  });
});
