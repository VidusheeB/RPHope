// What the gene-page pipeline has cost so far.
//
//   npm run gene-pages:spend            # summary
//   npm run gene-pages:spend -- --by-gene   # per-gene breakdown, priciest first
//
// Reads the ledger the drafting CLI appends to. Costs nothing and calls
// nothing — it just reads a local file.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { geneGrid } from "../lib/geneGrid";
import {
  readSpendLog,
  summarizeSpend,
  formatSpendSummary,
  SPEND_LOG_PATH,
} from "../lib/geneResearch/spendLog";

const entries = readSpendLog();
if (entries.length === 0) {
  console.log(`No spend recorded yet (${SPEND_LOG_PATH} is empty or absent).`);
  process.exit(0);
}

const drafted = new Set(
  entries.filter((e) => e.outcome === "ok").map((e) => e.gene.toLowerCase())
);
const remaining = geneGrid.filter((g) => !drafted.has(g.display.toLowerCase())).length;

console.log(`Gene-page pipeline spend (${SPEND_LOG_PATH}):\n`);
console.log(formatSpendSummary(summarizeSpend(entries), remaining));

if (process.argv.includes("--by-gene")) {
  const byGene = new Map<string, { usd: number; calls: number; outcomes: string[] }>();
  for (const e of entries) {
    const row = byGene.get(e.gene) ?? { usd: 0, calls: 0, outcomes: [] };
    row.usd += e.costUsd;
    row.calls += 1;
    row.outcomes.push(e.outcome);
    byGene.set(e.gene, row);
  }
  console.log("\nBy gene (most expensive first):");
  for (const [gene, row] of [...byGene].sort((a, b) => b[1].usd - a[1].usd)) {
    const retries = row.calls > 1 ? ` (${row.calls} calls: ${row.outcomes.join(", ")})` : "";
    console.log(`  ${gene.padEnd(12)} $${row.usd.toFixed(3)}${retries}`);
  }
}
