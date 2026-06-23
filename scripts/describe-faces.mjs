// One-time batch: generate a short VISUAL description of each Face-of-RP photo
// in /public/genes, so the voice assistant can match descriptions like "the man
// with black sunglasses" to a gene. Output → lib/geneFaceImages.json (keyed by
// gene slug), which app/api/assistant folds into the site corpus.
//
// Run:  node scripts/describe-faces.mjs            (needs ANTHROPIC_API_KEY in .env.local)
//       node scripts/describe-faces.mjs --force    (re-describe images already done)
//
// Uses Haiku (vision-capable, cheap) — this is a bulk, low-stakes description
// task, not medical content. Descriptions are for search/matching only.

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: ".env.local" });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const GENES_DIR = path.join(process.cwd(), "public", "genes");
const OUT = path.join(process.cwd(), "lib", "geneFaceImages.json");
const force = process.argv.includes("--force");

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const files = fs.readdirSync(GENES_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
const client = new Anthropic();

const PROMPT =
  "This is a portrait of a real person featured on a nonprofit website (a 'Face of RP'). " +
  "In ONE short phrase, describe their appearance the way someone might describe them from memory " +
  "— approximate age range, gender presentation, hair, glasses or sunglasses, facial hair, and expression. " +
  "No names, no guesses about identity, no medical or emotional commentary. Just the visual phrase.";

const out = { ...existing };
let done = 0;

for (const file of files) {
  const slug = file.replace(/\.(jpe?g|png)$/i, "");
  if (out[slug] && !force) continue;

  const data = fs.readFileSync(path.join(GENES_DIR, file)).toString("base64");
  const mediaType = /\.png$/i.test(file) ? "image/png" : "image/jpeg";

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    const desc = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");
    out[slug] = desc;
    done += 1;
    console.log(`✓ ${slug}: ${desc}`);
  } catch (e) {
    console.error(`✗ ${slug}: ${e.message}`);
  }
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\nWrote ${Object.keys(out).length} descriptions (${done} new) → lib/geneFaceImages.json`);
