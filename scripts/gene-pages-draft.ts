// Manual gene-page draft generation — one independent Opus request per gene,
// retrieval from NCBI/PubMed/ClinicalTrials.gov, inserted as 'unreviewed' into
// gene_page_drafts for human review.
//
//   npm run gene-pages:draft -- rpgr abca4 lca5 kiz fscn2   # named genes
//   npm run gene-pages:draft -- --limit=5                   # first 5 in the grid
//
// Per the pipeline spec: run a handful of varied genes first (one well-studied,
// several rare) and review those drafts in Supabase before spending on the rest.
// This script NEVER runs automatically — it costs real Anthropic API spend
// (roughly $0.10-$0.30/gene at standard, non-batch pricing) every time you run it.
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
// ANTHROPIC_API_KEY in .env.local.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getServiceSupabase } from "../lib/supabaseAdmin";
import { geneGrid } from "../lib/geneGrid";
import { draftGenePage } from "../lib/geneResearch/pipeline";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error(
      "✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("✗ Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  let targets = geneGrid;
  if (slugs.length) {
    targets = geneGrid.filter((g) => slugs.includes(g.slug));
    const missing = slugs.filter((s) => !geneGrid.some((g) => g.slug === s));
    if (missing.length) {
      console.warn(`  (unknown slug(s), skipping: ${missing.join(", ")})`);
    }
  }
  if (limit && limit > 0) targets = targets.slice(0, limit);

  if (targets.length === 0) {
    console.error("No matching genes to draft.");
    process.exit(1);
  }

  console.log(
    `Drafting ${targets.length} gene page${targets.length === 1 ? "" : "s"}: ${targets
      .map((g) => g.display)
      .join(", ")}`
  );
  console.log("This spends real Anthropic API credits. Running one gene at a time…\n");

  let ok = 0;
  let failed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  const failures: { gene: string; error: string }[] = [];

  for (const gene of targets) {
    process.stdout.write(`  ${gene.display} … `);
    const result = await draftGenePage(supabase, gene.display, gene.slug);
    if (result.ok) {
      ok++;
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      totalCost += result.estimatedCostUsd;
      console.log(
        `done (${result.inputTokens} in / ${result.outputTokens} out, ~$${result.estimatedCostUsd.toFixed(
          3
        )}${result.reviewFlagCount ? `, ${result.reviewFlagCount} review flag(s)` : ""})`
      );
    } else {
      failed++;
      failures.push({ gene: gene.display, error: result.error });
      console.log(`FAILED — ${result.error}`);
    }
    // Pace requests: gentle on NCBI/PubMed's public rate limits.
    await sleep(400);
  }

  console.log("\nDone.");
  console.log(`  succeeded: ${ok}`);
  console.log(`  failed: ${failed}`);
  console.log(
    `  total tokens: ${totalInputTokens} in / ${totalOutputTokens} out (~$${totalCost.toFixed(2)})`
  );
  if (failures.length) {
    console.log("  failures:");
    for (const f of failures) console.log(`    - ${f.gene}: ${f.error}`);
  }
  console.log(
    "\nReview drafts in the Supabase Table Editor → gene_page_drafts (review_status = 'unreviewed')."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
