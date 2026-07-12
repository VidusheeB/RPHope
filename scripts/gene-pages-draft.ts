// Manual gene-page draft generation.
//
//   npm run gene-pages:draft -- rpgr abca4 lca5 kiz fscn2   # named genes
//   npm run gene-pages:draft -- --limit=5                   # first 5 in the grid
//   npm run gene-pages:draft -- --retrieve-only rpgr        # retrieval only, $0 Anthropic spend
//   npm run gene-pages:draft -- --force rpgr                # regenerate even if already drafted
//   npm run gene-pages:draft -- --max-cost=10 --limit=20    # stop once cumulative cost would exceed $10
//
// Per the pipeline spec: validate on ONE gene first, then five, then the full
// 107-gene library only once those pass review. This script NEVER runs
// automatically — real Anthropic spend happens every time you invoke it
// (except --retrieve-only, which costs nothing).
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
// ANTHROPIC_API_KEY in .env.local (the last one is not required for
// --retrieve-only).

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { getServiceSupabase } from "../lib/supabaseAdmin";
import { geneGrid } from "../lib/geneGrid";
import {
  assembleSourceBundle,
  generateAndSaveDraft,
  hasExistingDraft,
} from "../lib/geneResearch/pipeline";
import { formatRetrievalDiagnostics } from "../lib/geneResearch/diagnostics";
import { estimateCostBeforeGeneration } from "../lib/geneResearch/generate";

// Where --retrieve-only writes its per-candidate diagnostic reports. Gitignored
// (see .gitignore: gene-review-scratch/) — local audit output, never committed.
const DIAGNOSTICS_DIR = "gene-review-scratch";

const DEFAULT_MAX_COST = 50;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const retrieveOnly = args.includes("--retrieve-only");
  const force = args.includes("--force");
  const slugs = args
    .filter((a) => !a.startsWith("--"))
    .map((a) => a.toLowerCase());
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;
  const maxCostArg = args.find((a) => a.startsWith("--max-cost="));
  const maxCost = maxCostArg ? Number(maxCostArg.split("=")[1]) : DEFAULT_MAX_COST;

  const supabase = getServiceSupabase();
  if (!supabase) {
    console.error(
      "✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  if (!retrieveOnly && !process.env.ANTHROPIC_API_KEY) {
    console.error("✗ Missing ANTHROPIC_API_KEY in .env.local (not needed for --retrieve-only)");
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
    `${retrieveOnly ? "Retrieving (no generation)" : "Drafting"} ${targets.length} gene page${
      targets.length === 1 ? "" : "s"
    }: ${targets.map((g) => g.display).join(", ")}`
  );
  if (!retrieveOnly) {
    console.log(`Hard stop at $${maxCost.toFixed(2)} cumulative cost. This spends real Anthropic API credits.`);
  }
  console.log("Running one gene at a time…\n");

  let ok = 0;
  let rejected = 0;
  let failed = 0;
  let skipped = 0;
  let cumulativeCost = 0;
  const outcomes: { gene: string; outcome: string; detail: string }[] = [];

  for (const gene of targets) {
    process.stdout.write(`  ${gene.display} … `);

    // ---- retrieve-only mode: zero Anthropic usage ----
    if (retrieveOnly) {
      // skipWebFallback guarantees $0 Anthropic spend (the web fallback is the
      // only Anthropic call in assembleSourceBundle).
      const result = await assembleSourceBundle(gene.display, gene.slug, {
        skipWebFallback: true,
      });
      if (!result.ok) {
        console.log(`REJECTED — ${result.reasons.map((r) => `${r.code}: ${r.detail}`).join("; ")}`);
        rejected++;
      } else {
        const b = result.bundle;
        const d = result.diagnostics;
        console.log(
          `ok — ${d.candidateCount} candidate(s), ${d.relevanceExcludedCount} removed by relevance gate → ${b.literatureRecords.length} selected, ${b.trialRecords.length} trial(s)`
        );
        console.log(
          `      raw: PubMed ${d.rawCounts.pubmed}, ELink ${d.rawCounts.pubmedElink}, Europe PMC ${d.rawCounts.europepmc}`
        );
        if (d.nctIdsExtracted.length) {
          console.log(
            `      NCT from literature: extracted [${d.nctIdsExtracted.join(", ")}], resolved [${d.nctResolved.join(", ") || "none"}], unverified [${d.nctUnverified.join(", ") || "none"}]`
          );
        }
        mkdirSync(DIAGNOSTICS_DIR, { recursive: true });
        const path = `${DIAGNOSTICS_DIR}/${gene.slug}-retrieval.txt`;
        writeFileSync(path, formatRetrievalDiagnostics(d), "utf8");
        console.log(`      per-candidate diagnostic → ${path}`);
        ok++;
      }
      await sleep(400);
      continue;
    }

    // ---- resume support: skip genes already drafted, unless --force ----
    if (!force && (await hasExistingDraft(supabase, gene.slug))) {
      console.log("skipped (already drafted — use --force to regenerate)");
      skipped++;
      continue;
    }
    console.log(""); // newline after "  GENE … "

    // ---- retrieve + verify + rank BEFORE calling Opus ----
    const bundleResult = await assembleSourceBundle(gene.display, gene.slug);
    if (!bundleResult.ok) {
      const detail = bundleResult.reasons.map((r) => `${r.code}: ${r.detail}`).join("; ");
      outcomes.push({ gene: gene.display, outcome: "rejected", detail });
      console.log(`    REJECTED (before generation) — ${detail}`);
      rejected++;
      await sleep(400);
      continue;
    }
    const bundle = bundleResult.bundle;
    const diag = bundleResult.diagnostics;
    const estimate = estimateCostBeforeGeneration(bundle);
    const geneSpecificTrials = bundle.trialRecords.filter((t) => t.geneSpecific).length;
    const broaderTrials = bundle.trialRecords.length - geneSpecificTrials;

    console.log(`    Verified gene record: ${bundle.geneRecord.symbol} (NCBI Gene ID ${bundle.geneRecord.geneId}, ${bundle.geneRecord.sourceId})`);
    console.log(`    Retrieval: ${diag.candidateCount} deduped candidate(s) from PubMed ${diag.rawCounts.pubmed} / ELink ${diag.rawCounts.pubmedElink} / Europe PMC ${diag.rawCounts.europepmc}`);
    console.log(`    Literature sent to Opus: ${bundle.literatureRecords.length} (category-balanced selection)`);
    console.log(`    Trials sent to Opus: ${bundle.trialRecords.length} (ranked; ${geneSpecificTrials} gene-specific, ${broaderTrials} broader condition-relevant)`);
    if (bundle.webFallbackRecords.length) {
      console.log(`    Web-fallback records: ${bundle.webFallbackRecords.length} (evidence was thin)`);
    }
    console.log(`    Estimated cost: ~$${estimate.estimatedCostUsd.toFixed(3)} typical, ~$${estimate.estimatedMaxCostUsd.toFixed(3)} maximum`);

    // ---- hard stop: check the MAXIMUM possible cost against remaining budget, BEFORE calling Opus ----
    if (cumulativeCost + estimate.estimatedMaxCostUsd > maxCost) {
      console.log(
        `    STOPPED — cumulative $${cumulativeCost.toFixed(2)} + this gene's max ~$${estimate.estimatedMaxCostUsd.toFixed(2)} would exceed the $${maxCost.toFixed(2)} limit`
      );
      break;
    }

    process.stdout.write(`    Calling Opus… `);
    const result = await generateAndSaveDraft(supabase, bundle);

    if (result.outcome === "ok") {
      ok++;
      cumulativeCost += result.estimatedCostUsd;
      console.log(
        `done (${result.inputTokens} in / ${result.outputTokens} out, ~$${result.estimatedCostUsd.toFixed(
          3
        )}, cumulative ~$${cumulativeCost.toFixed(3)}${
          result.reviewFlagCount ? `, ${result.reviewFlagCount} review flag(s)` : ""
        })`
      );
    } else if (result.outcome === "rejected") {
      rejected++;
      // A post-generation rejection was still billed — count the real spend
      // toward the budget and report it, even though the draft is discarded.
      if (typeof result.estimatedCostUsd === "number") {
        cumulativeCost += result.estimatedCostUsd;
      }
      const detail = result.reasons.map((r) => `${r.code}: ${r.detail}`).join("; ");
      outcomes.push({ gene: gene.display, outcome: "rejected", detail });
      const costNote =
        typeof result.estimatedCostUsd === "number"
          ? ` [billed: ${result.inputTokens} in / ${result.outputTokens} out, ~$${result.estimatedCostUsd.toFixed(3)}, cumulative ~$${cumulativeCost.toFixed(3)}]`
          : "";
      console.log(`REJECTED — ${detail}${costNote}`);
    } else {
      failed++;
      // If the failure came after a billed response, count and report it too.
      if (typeof result.estimatedCostUsd === "number") {
        cumulativeCost += result.estimatedCostUsd;
      }
      outcomes.push({ gene: gene.display, outcome: "failed", detail: result.error });
      const costNote =
        typeof result.estimatedCostUsd === "number"
          ? ` [billed: ${result.inputTokens} in / ${result.outputTokens} out, ~$${result.estimatedCostUsd.toFixed(3)}, cumulative ~$${cumulativeCost.toFixed(3)}]`
          : "";
      console.log(`FAILED — ${result.error}${costNote}`);
    }

    // Pace requests: gentle on NCBI/PubMed/Europe PMC's public rate limits.
    await sleep(400);
  }

  console.log("\nDone.");
  if (retrieveOnly) {
    console.log(`  verified/ok: ${ok}`);
    console.log(`  rejected: ${rejected}`);
    console.log("  (retrieve-only mode — $0 Anthropic spend)");
    return;
  }
  console.log(`  succeeded: ${ok}`);
  console.log(`  rejected: ${rejected}`);
  console.log(`  failed: ${failed}`);
  console.log(`  skipped (already drafted): ${skipped}`);
  console.log(`  cumulative cost: ~$${cumulativeCost.toFixed(3)}`);
  if (outcomes.length) {
    console.log("  details:");
    for (const o of outcomes) console.log(`    - ${o.gene} (${o.outcome}): ${o.detail}`);
  }
  console.log(
    "\nReview drafts in the Supabase Table Editor → gene_page_drafts (review_status = 'unreviewed')."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
