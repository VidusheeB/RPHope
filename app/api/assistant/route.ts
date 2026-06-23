import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistantInstructions";
import { genes, getGene, type Gene } from "@/lib/genes";
import { sections, researchArticles } from "@/lib/navTargets";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import faceImages from "@/lib/geneFaceImages.json";

// Visual descriptions of each gene card's Face-of-RP photo (generated once by
// scripts/describe-faces.mjs) — lets the assistant match "the man with black
// sunglasses" to a gene without live vision.
const FACE_IMAGES = faceImages as Record<string, string>;

export const runtime = "nodejs";

// Conversational + quality-sensitive → Opus (matches the project's "Opus for
// quality-critical" split). Knowledge is fenced to the website content built
// below — the model is told to draw on nothing else.
const MODEL = "claude-opus-4-8";

type Turn = { role: "user" | "assistant"; content: string };

const FALLBACK_REPLY =
  "Sorry — I had trouble reaching my brain just now. Could you say that again?";

// Full reviewed record for one gene — EVERY field the site has, so the model
// can answer about treatments, population, who's researching, the Face of RP,
// trials, etc. (not just the summary).
function geneBlock(g: Gene, lead: string): string {
  const f: string[] = [`${lead} — gene ${g.gene}${g.fullName ? ` (${g.fullName})` : ""}, page /genetic-insights/${g.slug}:`];
  if (g.summary) f.push(`Summary: ${g.summary}`);
  if (g.diseaseCategory) f.push(`Disease category / inheritance: ${g.diseaseCategory}.`);
  if (g.patientPopulation) f.push(`Patient population: ${g.patientPopulation}.`);
  if (g.treatmentOptions) f.push(`Treatment options: ${g.treatmentOptions}.`);
  if (g.eyeHealthStrategies) f.push(`Strategies to preserve eye health: ${g.eyeHealthStrategies}.`);
  if (g.institutions?.length) f.push(`Institution(s) conducting research: ${g.institutions.join(", ")}.`);
  if (g.clinicalTrials?.label) f.push(`Clinical trials: ${g.clinicalTrials.label}.`);
  if (g.faceOfRP?.name && g.faceOfRP.name !== "—") {
    f.push(`Face of RP (a real person featured for this gene): ${g.faceOfRP.name}${g.faceOfRP.location ? `, from ${g.faceOfRP.location}` : ""}.`);
  }
  if (FACE_IMAGES[g.slug]) {
    f.push(`What the photo on this gene's card looks like: ${FACE_IMAGES[g.slug]}`);
  }
  return f.join("\n");
}

// THE WHOLE WEBSITE, as text — every section, every gene's full reviewed record,
// and the research-article list. Built once at module load (all static data) and
// sent on every turn so the model effectively "knows the whole site" instead of
// relying on per-turn retrieval. It's identical every request, so it's marked
// cacheable below (cheap reads after the first call).
const SITE_CORPUS = [
  "SITE SECTIONS (pages you can send the visitor to):\n" +
    sections.map((s) => `- ${s.label} → ${s.href}  (${s.about})`).join("\n"),
  "ALL GENE PAGES (full reviewed content for every gene):\n\n" +
    genes.map((g) => geneBlock(g, "GENE")).join("\n\n"),
  "RESEARCH STUDIES & ARTICLES (RP Hope's reviewed library — point to these by exact title + url):\n" +
    researchArticles.map((a) => `- ${a.title} → ${a.url}`).join("\n"),
].join("\n\n────────────────────\n\n");

// A tiny per-turn note about where the visitor is. Goes on the USER turn (not the
// cached system prompt) so the big corpus prefix stays byte-identical and cached.
function pageHint(path: string): string {
  const m = path.match(/^\/genetic-insights\/([^/]+)\/?$/);
  if (m) {
    const g = getGene(m[1]);
    if (g) return `The visitor is currently on the ${g.gene} gene page.`;
  }
  const sec = sections.find((s) => s.href === path);
  if (sec) return `The visitor is currently on the "${sec.label}" page.`;
  return "";
}

export async function POST(req: Request) {
  let body: { message?: string; history?: Turn[]; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }

  const message = (body.message || "").slice(0, 600).trim();
  const path = body.path || "/";
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }

  // Instructions + the whole-site corpus → one stable, cacheable system prefix.
  const systemText = ASSISTANT_SYSTEM_PROMPT.replace("{{WEBSITE_CONTEXT}}", SITE_CORPUS);

  const hint = pageHint(path);
  const messages: Anthropic.MessageParam[] = [
    ...history
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && t.content)
      .map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: hint ? `${message}\n\n(${hint})` : message },
  ];

  // Pure prose: the model just talks. No JSON envelope to parse or break — we
  // speak exactly what Claude says.
  let reply = "";
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      output_config: { effort: "low" }, // spoken + grounded — keep it fast
      system: [
        // Stable prefix → cached across turns/visitors (cheap reads after first).
        { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
      ],
      messages,
    });
    reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch {
    return NextResponse.json({ reply: FALLBACK_REPLY });
  }
  if (!reply) reply = FALLBACK_REPLY;

  // Governance audit log (best-effort): every generated reply is recorded so a
  // human can spot-check that the assistant stayed grounded in site content.
  try {
    const admin = getServiceSupabase();
    if (admin) {
      await admin.from("ai_explanations").insert({
        gene_slug: path,
        mode: "chat",
        question: message,
        source_text: null,
        explanation: reply,
        model: MODEL,
      });
    }
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ reply });
}
