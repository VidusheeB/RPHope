// Manual research pull — same pipeline as the weekly cron, runnable from your
// terminal with no dev server.
//
//   npm run research:pull              # all genes
//   npm run research:pull -- rpgr      # one gene
//   npm run research:pull -- --limit=5 # first 5 genes (handy for a quick test)
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY
// in .env.local. Drafts land as `pending_review` for human review before publish.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getServiceSupabase } from "../lib/supabaseAdmin";
import { runResearchPull } from "../lib/research/pull";

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

  console.log(
    `Pulling research${slugs.length ? ` for ${slugs.join(", ")}` : " for all genes"}${
      limit ? ` (limit ${limit})` : ""
    }…`
  );

  const summary = await runResearchPull(supabase, {
    slugs: slugs.length ? slugs : undefined,
    limit,
  });

  console.log("\nDone.");
  console.log(`  genes processed: ${summary.genesProcessed}`);
  console.log(`  inserted (pending_review): ${summary.inserted}`);
  console.log(`  skipped (already known): ${summary.skipped}`);
  if (summary.errors.length) {
    console.log(`  errors: ${summary.errors.length}`);
    for (const e of summary.errors) console.log(`    - ${e.gene}: ${e.error}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
