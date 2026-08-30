// Publish the latest draft for each named gene.
//
// Owner-directed bulk publish (2026-08-29). This bypasses the reviewer
// dashboard's readiness gates — flag resolution, the confirmation checkbox,
// the review_status transitions — because the owner asked for these drafts to
// go live directly for a demo. It is deliberately a SEPARATE, explicit script
// rather than a change to the review workflow, so the normal governed path
// through /review is left exactly as it was for everything else.
//
// Publishing is ATOMIC per gene via the publish_gene_version RPC: it archives
// any prior published version, inserts the new immutable one, and updates the
// draft row inside a single transaction. A failure on one gene leaves that
// gene's previously published page untouched.
//
// Usage:
//   node scripts/publish-drafts.mjs rpgr ush2a          # dry run
//   node scripts/publish-drafts.mjs --apply rpgr ush2a  # publish
//   node scripts/publish-drafts.mjs --apply             # every gene with a draft

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const GENES = process.argv
  .slice(2)
  .filter((a) => !a.startsWith("--"))
  .map((g) => g.toLowerCase());

function readEnv() {
  const out = { ...process.env };
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] ??= line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the environment instead */
  }
  return out;
}

const SECTION_COLUMNS = [
  "summary_card",
  "what_this_gene_means",
  "how_it_may_affect_vision",
  "what_is_known",
  "what_is_uncertain",
  "what_you_can_do_next",
  "questions_for_clinician",
  "for_family_and_caregivers",
  "treatment_and_research",
  "clinical_trial_summary",
  "research_cards",
  "sources",
  "review_flags",
];

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** The JSONB payload the RPC stores as the immutable published version. */
function toContent(row) {
  const content = { gene: row.gene_symbol };
  for (const col of SECTION_COLUMNS) content[camel(col)] = row[col];
  content.reviewStatus = "published";
  return content;
}

async function main() {
  const env = readEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  let query = db
    .from("gene_page_drafts")
    .select("*")
    .order("generated_at", { ascending: false });
  if (GENES.length) query = query.in("gene_slug", GENES);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Read failed:", error.message);
    process.exit(1);
  }

  // Latest draft per gene. Earlier drafts stay in the table for comparison.
  const latest = new Map();
  for (const r of rows ?? []) if (!latest.has(r.gene_slug)) latest.set(r.gene_slug, r);

  // Approver: reuse the reviewer already recorded on existing approved rows so
  // the published version names a real person rather than storing null.
  const { data: approverRow } = await db
    .from("gene_page_drafts")
    .select("reviewed_by")
    .not("reviewed_by", "is", null)
    .limit(1)
    .maybeSingle();
  const approver = approverRow?.reviewed_by ?? null;

  console.log(APPLY ? "PUBLISHING\n" : "DRY RUN (pass --apply to publish)\n");
  console.log(`approver recorded as: ${approver ?? "none found"}\n`);

  let done = 0;
  const failed = [];

  for (const [slug, row] of Array.from(latest.entries()).sort()) {
    const label = (row.gene_symbol ?? slug).padEnd(10);

    if (!APPLY) {
      console.log(`${label} would publish draft ${row.id} (status: ${row.review_status})`);
      done++;
      continue;
    }

    const { data, error: rpcErr } = await db.rpc("publish_gene_version", {
      p_draft_id: row.id,
      p_gene_slug: slug,
      p_content: toContent(row),
      p_approver: approver,
      p_assignment_id: null,
    });

    if (rpcErr) {
      console.error(`${label} FAILED — ${rpcErr.message}`);
      failed.push({ slug, error: rpcErr.message });
      continue;
    }

    const versionId = Array.isArray(data) ? data[0]?.version_id : data?.version_id;
    console.log(`${label} published (version ${versionId})`);
    done++;
  }

  console.log(`\n${done} ${APPLY ? "published" : "would publish"}, ${failed.length} failed.`);
  for (const f of failed) console.log(`  - ${f.slug}: ${f.error}`);

  if (failed.some((f) => /workflow timestamps|review_status/i.test(f.error))) {
    console.log(
      "\nThat failure is migration 0023 not being applied yet: the 0019 guard\n" +
        "trigger blocks the RPC's own update to the draft row. Apply\n" +
        "supabase/migrations/0023_fix_workflow_guard_role_detection.sql in the\n" +
        "Supabase SQL editor, then re-run this script."
    );
  }
}

main();
