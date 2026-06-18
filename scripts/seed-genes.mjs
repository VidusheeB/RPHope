// Seed the Supabase `genes` table from supabase/seed/genes.json.
//
// Usage:
//   1. Create your Supabase project and run supabase/schema.sql in the SQL editor.
//   2. Put NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
//   3. npm run db:seed
//
// Uses the SERVICE ROLE key (bypasses RLS) — this runs locally only, never in the browser.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "✗ Missing env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "supabase", "seed", "genes.json");
const genes = JSON.parse(readFileSync(seedPath, "utf8"));

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

console.log(`Seeding ${genes.length} genes into Supabase…`);

const { data, error } = await supabase
  .from("genes")
  .upsert(genes, { onConflict: "slug" })
  .select("slug");

if (error) {
  console.error("✗ Seed failed:", error.message);
  console.error("   (Did you run supabase/schema.sql first?)");
  process.exit(1);
}

console.log(`✓ Upserted ${data.length} genes.`);
const { count } = await supabase
  .from("genes")
  .select("*", { count: "exact", head: true });
console.log(`✓ genes table now has ${count} rows.`);
