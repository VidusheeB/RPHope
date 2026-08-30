// Backfill reviewed_at on approved gene_page_drafts rows that have a
// reviewed_by but no reviewed_at.
//
// Two sources of truth, both records of things that actually happened:
//
//   1. gene_page_versions — when a draft was published the RPC wrote an
//      immutable row carrying approved_by + approved_at and a source_draft_id
//      pointing back at the draft.
//   2. audit_log — 'review_approved' / 'draft_published' entries, each with a
//      real actor and timestamp.
//
// The LATEST of the two is used, because a draft can be approved again after
// its first publication (KIZ was: its version row is dated 2026-07-13 but the
// audit log records a later publish on 2026-08-05, and reviewed_at should
// describe the most recent approval, not the first).
//
// Rules:
//   - only backfill from a real recorded event tied to this exact draft;
//   - only when the event's actor MATCHES the draft's existing reviewed_by (a
//     mismatch means we do not actually know who approved it);
//   - never invent a timestamp or a user. Anything unresolved is REPORTED for
//     a human decision, not guessed.
//
// Usage:  node scripts/backfill-review-metadata.mjs [--apply]

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");

function readEnv() {
  const out = { ...process.env };
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the environment */
  }
  return out;
}

const APPROVAL_AUDIT_ACTIONS = ["review_approved", "draft_published"];

/** Decide what to do with one broken row. Pure, so it is unit-tested. */
export function planBackfill(draft, versions, auditEvents = []) {
  const candidates = [];

  for (const v of versions) {
    if (v.source_draft_id === draft.id && v.approved_at) {
      candidates.push({ at: v.approved_at, by: v.approved_by, source: "gene_page_versions" });
    }
  }
  for (const e of auditEvents) {
    if (e.draft_id === draft.id && APPROVAL_AUDIT_ACTIONS.includes(e.action) && e.created_at) {
      candidates.push({ at: e.created_at, by: e.actor, source: `audit_log:${e.action}` });
    }
  }

  if (!candidates.length) {
    return { action: "needs_decision", reason: "No published version or approval audit event for this draft." };
  }

  // The most recent real approval event describes the current approved state.
  const latest = candidates.sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];

  if (draft.reviewed_by && latest.by && draft.reviewed_by !== latest.by) {
    return {
      action: "needs_decision",
      reason: `reviewed_by (${draft.reviewed_by}) disagrees with the ${latest.source} actor (${latest.by}).`,
    };
  }
  const reviewedBy = draft.reviewed_by ?? latest.by;
  if (!reviewedBy) {
    return { action: "needs_decision", reason: "No reviewer recorded on the draft or the event." };
  }
  return { action: "backfill", reviewed_by: reviewedBy, reviewed_at: latest.at, source: latest.source };
}

async function main() {
  const env = readEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: drafts, error } = await db
    .from("gene_page_drafts")
    .select("id, gene_symbol, review_status, reviewed_by, reviewed_at")
    .eq("review_status", "approved")
    .is("reviewed_at", null);
  if (error) {
    console.error("Read failed:", error.message);
    process.exit(1);
  }
  if (!drafts?.length) {
    console.log("No approved rows with a NULL reviewed_at. Nothing to do.");
    return;
  }

  const { data: versions } = await db
    .from("gene_page_versions")
    .select("source_draft_id, approved_by, approved_at, status, version_number");

  const { data: auditEvents } = await db
    .from("audit_log")
    .select("draft_id, action, actor, created_at")
    .in("action", APPROVAL_AUDIT_ACTIONS);

  console.log(APPLY ? "APPLYING\n" : "DRY RUN (pass --apply to write)\n");
  const backfilled = [];
  const unresolved = [];

  for (const d of drafts) {
    const plan = planBackfill(d, versions ?? [], auditEvents ?? []);
    if (plan.action !== "backfill") {
      unresolved.push({ gene: d.gene_symbol, id: d.id, reason: plan.reason });
      console.log(`${d.gene_symbol.padEnd(8)} NEEDS DECISION — ${plan.reason}`);
      continue;
    }
    console.log(`${d.gene_symbol.padEnd(8)} backfill reviewed_at=${plan.reviewed_at} reviewed_by=${plan.reviewed_by}`);
    if (APPLY) {
      const { error: upErr } = await db
        .from("gene_page_drafts")
        .update({ reviewed_by: plan.reviewed_by, reviewed_at: plan.reviewed_at })
        .eq("id", d.id);
      if (upErr) {
        console.error(`  write failed: ${upErr.message}`);
        unresolved.push({ gene: d.gene_symbol, id: d.id, reason: upErr.message });
        continue;
      }
      console.log("  written.");
    }
    backfilled.push(d.gene_symbol);
  }

  console.log(`\n${backfilled.length} ${APPLY ? "backfilled" : "would be backfilled"}: ${backfilled.join(", ") || "none"}`);
  console.log(`${unresolved.length} still need a human decision${unresolved.length ? ":" : "."}`);
  for (const u of unresolved) console.log(`  - ${u.gene} (${u.id}): ${u.reason}`);
}

if (process.argv[1] && process.argv[1].endsWith("backfill-review-metadata.mjs")) {
  main();
}
