// One-off maintenance: strip the admin edit/publish TEST prefixes that were
// typed into three published gene summaries while verifying the reviewer
// dashboard could edit and publish.
//
//   RPGR  "HELLO TESTING "   LCA5  "blah blah "   KIZ  "HELLO "
//
// These were confirmed test edits, so no audit-log restoration is needed. The
// script is deliberately paranoid: it removes ONLY the exact prefix from the
// first summary sentence and then asserts, byte for byte, that the rest of the
// summary_card JSON (including every source ID) is unchanged. Anything else
// aborts that row.
//
// Handles both summary_card shapes in the wild: the current
// { sentences: [{ text, sourceIds }] } and the older { text, sourceIds }.
//
// Usage:  node scripts/cleanup-admin-test-prefixes.mjs [--apply]
// Default is a dry run.

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");

const TARGETS = {
  RPGR: "HELLO TESTING ",
  LCA5: "blah blah ",
  KIZ: "HELLO ",
};

function readEnv() {
  const out = { ...process.env };
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
      if (!line.includes("=") || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      out[line.slice(0, i).trim()] ??= line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may come from the environment instead */
  }
  return out;
}

/** Remove `prefix` from the first summary sentence, leaving everything else
 *  identical. Returns null when the prefix isn't there (already clean). */
export function stripPrefix(summaryCard, prefix) {
  const card = structuredClone(summaryCard);
  if (Array.isArray(card?.sentences) && card.sentences.length) {
    const first = card.sentences[0];
    if (typeof first?.text !== "string" || !first.text.startsWith(prefix)) return null;
    first.text = first.text.slice(prefix.length);
    return card;
  }
  if (typeof card?.text === "string") {
    if (!card.text.startsWith(prefix)) return null;
    card.text = card.text.slice(prefix.length);
    return card;
  }
  return null;
}

/** Everything except the first sentence's text must be byte-identical. */
export function onlyFirstSentenceChanged(before, after) {
  const blank = (card) => {
    const c = structuredClone(card);
    if (Array.isArray(c?.sentences) && c.sentences.length) c.sentences[0].text = "";
    else if (typeof c?.text === "string") c.text = "";
    return c;
  };
  return JSON.stringify(blank(before)) === JSON.stringify(blank(after));
}

async function main() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient(url, key);

  const { data, error } = await db
    .from("gene_page_drafts")
    .select("id, gene_symbol, summary_card")
    .in("gene_symbol", Object.keys(TARGETS));
  if (error) {
    console.error("Read failed:", error.message);
    process.exit(1);
  }

  console.log(APPLY ? "APPLYING changes\n" : "DRY RUN (pass --apply to write)\n");
  let changed = 0;

  for (const row of data ?? []) {
    const prefix = TARGETS[row.gene_symbol];
    const cleaned = stripPrefix(row.summary_card, prefix);
    if (!cleaned) {
      console.log(`${row.gene_symbol}: no ${JSON.stringify(prefix)} prefix — already clean, skipping.`);
      continue;
    }
    if (!onlyFirstSentenceChanged(row.summary_card, cleaned)) {
      console.error(`${row.gene_symbol}: ABORTED — more than the first sentence would change.`);
      continue;
    }
    changed++;
    console.log(`${row.gene_symbol}: removing ${JSON.stringify(prefix)}`);
    if (APPLY) {
      // Content-only correction: deliberately does NOT touch last_edited_by,
      // reviewed_by, reviewed_at or review_status. This is not a human edit and
      // must not rewrite the review history.
      const { error: upErr } = await db
        .from("gene_page_drafts")
        .update({ summary_card: cleaned })
        .eq("id", row.id);
      if (upErr) console.error(`  write failed: ${upErr.message}`);
      else console.log("  written.");
    }
  }
  console.log(`\n${changed} row(s) ${APPLY ? "updated" : "would be updated"}.`);
}

if (process.argv[1] && process.argv[1].endsWith("cleanup-admin-test-prefixes.mjs")) {
  main();
}
