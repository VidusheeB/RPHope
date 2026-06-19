import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import {
  sections,
  geneTargets,
  researchArticles,
  allowedHrefs,
} from "@/lib/navTargets";

export const runtime = "nodejs";

const MODEL = "claude-opus-4-8"; // routing task; swap to "claude-haiku-4-5" to cut cost ~5x

type Suggestion = { label: string; href: string };
type NavResult = {
  reply: string;
  confidence: "high" | "medium" | "none";
  suggestions: Suggestion[];
};

const FALLBACK: NavResult = {
  reply:
    "I'm not certain where to point you — here are the main places to start.",
  confidence: "none",
  suggestions: sections.slice(0, 4).map((s) => ({ label: s.label, href: s.href })),
};

function buildSystemPrompt(): string {
  const sectionList = sections
    .map((s) => `- ${s.label} → ${s.href}  (${s.about})`)
    .join("\n");
  const geneList = geneTargets()
    .map((g) => `- ${g.label} → ${g.href}`)
    .join("\n");
  const articleList = researchArticles
    .map((a) => `- ${a.title} → ${a.url}`)
    .join("\n");

  return `You are the navigation assistant for the RP Hope website, a nonprofit for people affected by retinitis pigmentosa (RP). Your ONLY job is to help a visitor find the right page or study. You are NOT a medical advisor.

You may direct visitors ONLY to the items listed below. Never invent a URL or a study title.

SITE SECTIONS:
${sectionList}

GENE PAGES (one per gene):
${geneList}

RESEARCH STUDIES & ARTICLES (RP Hope's reviewed library):
${articleList}

RULES:
- Map the visitor's request — even vague, plain-language, or fuzzy — to the most relevant item(s) above.
- PREFER SPECIFICITY. When the visitor asks about a particular topic, treatment, or approach (e.g. "the one where a virus fixes the gene" = gene therapy; CRISPR; stem cells; a specific gene's research), suggest the most relevant SPECIFIC STUDIES from the research library by their exact title + url — do NOT just send them to the generic Clinical Trials page when a specific study answers them better. You may add a relevant section page as a secondary suggestion.
- Use the article's EXACT title as the suggestion label, and its exact url. Point to the study; never describe or summarize its medical findings.
- NAVIGATE, DON'T DIAGNOSE. Never interpret symptoms or imply the visitor has a particular gene. Nearly all RP genes share the same symptoms (night blindness, tunnel vision, light sensitivity), so symptoms do NOT identify a gene — a genetic test does. If the visitor describes symptoms, route them to "Newly Diagnosed — Start Here" and "Genetic Insights", noting that genetic testing (not symptoms) identifies the gene. Frame everything as wayfinding, never advice.
- If the visitor clearly names a specific gene, suggest that gene's page (and optionally its key studies).
- Use only href/url values from the lists above.
- Confidence: "high" with 1–3 items when you're sure; "medium" with 2–3 best guesses when unsure; "none" with the main sections when nothing fits. Never dead-end.
- "reply" is 1–2 short, warm sentences. This is education and navigation only — never medical advice.

Respond with ONLY a JSON object (no markdown fences, no extra text) of exactly this shape:
{"reply": string, "confidence": "high" | "medium" | "none", "suggestions": [{"label": string, "href": string}]}`;
}

export async function POST(req: Request) {
  let query = "";
  try {
    ({ query } = await req.json());
  } catch {
    return NextResponse.json(FALLBACK);
  }
  if (!query?.trim() || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(),
          cache_control: { type: "ephemeral" }, // stable prompt → cache across requests
        },
      ],
      messages: [{ role: "user", content: query.slice(0, 500) }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const json = text.replace(/^```json\s*|\s*```$/g, "");
    const parsed = JSON.parse(json) as NavResult;

    // Enforce the bounded action space: drop any href that isn't a real page.
    const allowed = allowedHrefs();
    const suggestions = (parsed.suggestions || [])
      .filter((s) => s?.href && allowed.has(s.href))
      .slice(0, 4);

    return NextResponse.json({
      reply: typeof parsed.reply === "string" ? parsed.reply : FALLBACK.reply,
      confidence: ["high", "medium", "none"].includes(parsed.confidence)
        ? parsed.confidence
        : "medium",
      suggestions: suggestions.length > 0 ? suggestions : FALLBACK.suggestions,
    });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
