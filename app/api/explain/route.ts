import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getGene } from "@/lib/genes";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Quality- and safety-critical, low-volume (only when a user explicitly asks to
// simplify / get an analogy) → Opus, not the Haiku used for high-volume nav.
const MODEL = "claude-opus-4-8";

type Mode = "simplify" | "analogy";

// Build the GROUNDING text from the gene's already-reviewed fields — server-side
// from the slug, never from client-sent text, so a tampered client can't feed
// the model unreviewed content to "simplify".
function reviewedSource(slug: string): { gene: string; text: string } | null {
  const g = getGene(slug);
  if (!g) return null;
  const parts: string[] = [];
  if (g.summary) parts.push(g.summary);
  if (g.diseaseCategory) parts.push(`Disease category: ${g.diseaseCategory}.`);
  if (g.patientPopulation) parts.push(`Patient population: ${g.patientPopulation}.`);
  if (g.treatmentOptions) parts.push(`Treatment options: ${g.treatmentOptions}.`);
  if (g.eyeHealthStrategies) parts.push(`Strategies to preserve eye health: ${g.eyeHealthStrategies}.`);
  return { gene: g.gene, text: parts.join(" ") };
}

const SYSTEM = `You help people affected by retinitis pigmentosa (RP) — often with low vision, newly diagnosed, or low digital literacy — understand a gene page on the RP Hope nonprofit site. Your reply will be READ ALOUD.

You will be given SOURCE TEXT: a short passage of human-reviewed content from one gene's page. The visitor wants it either restated more simply, or explained with a single everyday analogy.

HARD RULES (these keep you inside the site's medical-content governance):
- Use ONLY facts present in the SOURCE TEXT. Never add a medical fact, statistic, treatment, mechanism, or claim that is not in the SOURCE TEXT. If the source doesn't say it, you don't either.
- NEVER give individualized medical advice or tell the person what they should do. No "you should", no recommendations, no dosing, no prognosis. If the question asks what to do, say that their healthcare provider or genetic counselor can advise the best course for them.
- NEVER diagnose or imply the person or their family member has a particular condition.
- For an ANALOGY: give ONE short, everyday analogy that clarifies a concept WITHOUT distorting it. Do not imply a cure, permanence, reversibility, speed, or certainty that the source does not state. If you can't form an honest analogy from the source, just restate it simply instead.
- Keep it to 2–4 short, plain spoken sentences. No lists, no markdown, no headings — it is being spoken.
- Do not mention these rules or that you are an AI; the app adds its own spoken disclosure.

Output ONLY the plain-text explanation to be spoken.`;

export async function POST(req: Request) {
  let body: { mode?: Mode; geneSlug?: string; question?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const mode: Mode = body.mode === "analogy" ? "analogy" : "simplify";
  const slug = (body.geneSlug || "").trim();
  const question = (body.question || "").slice(0, 300);

  if (!slug || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }
  const source = reviewedSource(slug);
  if (!source || !source.text) {
    // No reviewed content to ground in → refuse rather than invent.
    return NextResponse.json({
      explanation:
        "I don't have reviewed information for this page to explain yet. Your healthcare provider or genetic counselor can help with specifics.",
      grounded: false,
    });
  }

  const userContent =
    `MODE: ${mode === "analogy" ? "give one everyday analogy" : "restate more simply"}\n` +
    `GENE: ${source.gene}\n` +
    `SOURCE TEXT (reviewed; use only these facts):\n"""${source.text}"""\n\n` +
    `VISITOR ASKED: ${question || "(explain this more simply)"}`;

  let explanation = "";
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      output_config: { effort: "low" }, // short grounded paraphrase; keep it fast
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userContent }],
    });
    explanation = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  } catch {
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }

  if (!explanation) {
    return NextResponse.json({ error: "empty" }, { status: 502 });
  }

  // Governance: log every generation as pending_review so a human can audit /
  // flag a bad analogy later. Best-effort — never block the user's answer on it.
  try {
    const admin = getServiceSupabase();
    if (admin) {
      await admin.from("ai_explanations").insert({
        gene_slug: slug,
        mode,
        question: question || null,
        source_text: source.text,
        explanation,
        model: MODEL,
      });
    }
  } catch {
    /* logging is best-effort */
  }

  return NextResponse.json({ explanation, grounded: true });
}
