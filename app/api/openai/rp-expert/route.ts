// Server-side expert reasoner. The Realtime agent calls this (via the
// ask_rp_expert tool) only for questions needing synthesis. We retrieve the top
// reviewed RP Hope excerpts here, pass ONLY those + the question to gpt-5.4, and
// return a structured, grounded answer. The API key never leaves the server.
// Sources are mapped from the retrieved excerpts, so returned links are always
// real (the model cannot invent a URL).

import { NextResponse } from "next/server";
import { searchKnowledge } from "@/lib/knowledge/search";
import { rateLimit, clientKey } from "@/lib/voice/rateLimit";

export const runtime = "nodejs";

const KEY = process.env.OPENAI_API_KEY;
const EXPERT_MODEL = "gpt-5.4";

const MAX_QUESTION = 2000;
const MAX_CONTEXT = 4000;
const MAX_BODY_BYTES = 12_000;

const EXPERT_INSTRUCTIONS = `You are the RP Hope expert reasoner. You help the RP Hope voice guide answer harder questions about retinitis pigmentosa resources.

Reason carefully and only from the SOURCES provided. Distinguish evidence (stated in a source) from inference (your reasoning). If the sources don't support an answer, say so and point to the closest resource — never invent facts, genes, trials, or links.

Medical boundary: do not diagnose, prescribe, or guarantee clinical-trial eligibility. You may explain reviewed information, suggest questions for a clinician or genetic counselor, and describe trials as options to review. Keep the answer conversational and concise (the guide will speak it aloud) — a few sentences unless more is clearly needed.

Return JSON only. Set isSuggestion=true when the answer is advice/next-steps rather than a stated fact. Set confidence based on how well the sources support the answer. Cite the sources you used by their id in usedSourceIds.`;

type Excerpt = { id: string; title: string; heading: string; url: string; text: string };

function sanitize(text: string, max: number): string {
  return text.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").slice(0, max).trim();
}

export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json(
      { error: "Expert reasoning is not configured yet." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`expert:${clientKey(req)}`, { limit: 15, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 30) } }
    );
  }

  // Bounded body read.
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  let question = "";
  let context = "";
  try {
    const body = JSON.parse(raw);
    question = sanitize(String(body?.question ?? ""), MAX_QUESTION);
    context = sanitize(String(body?.context ?? ""), MAX_CONTEXT);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "No question provided." }, { status: 400 });
  }

  // Retrieve reviewed excerpts server-side.
  const excerpts: Excerpt[] = searchKnowledge(question, { limit: 6 }).map((r) => ({
    id: r.id,
    title: r.title,
    heading: r.heading,
    url: r.url,
    text: r.snippet,
  }));

  const sourcesBlock = excerpts.length
    ? excerpts
        .map((e) => `[${e.id}] ${e.title} — ${e.heading}\n${e.text}`)
        .join("\n\n")
    : "(no matching reviewed sources)";

  const userPrompt = `SOURCES:\n${sourcesBlock}\n\n${
    context ? `CONVERSATION CONTEXT:\n${context}\n\n` : ""
  }QUESTION:\n${question}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EXPERT_MODEL,
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: EXPERT_INSTRUCTIONS },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "rp_expert_answer",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: { type: "string" },
                usedSourceIds: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                isSuggestion: { type: "boolean" },
                limitations: { type: "string" },
              },
              required: [
                "answer",
                "usedSourceIds",
                "confidence",
                "isSuggestion",
                "limitations",
              ],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      console.error("Expert model request failed:", res.status);
      return NextResponse.json(
        { error: "Expert reasoning failed." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    let parsed: {
      answer?: string;
      usedSourceIds?: string[];
      confidence?: "high" | "medium" | "low";
      isSuggestion?: boolean;
      limitations?: string;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Expert reasoning failed." }, { status: 502 });
    }

    // Map used source ids to REAL metadata (guards against invented links).
    const byId = new Map(excerpts.map((e) => [e.id, e]));
    const used = (parsed.usedSourceIds ?? [])
      .map((id) => byId.get(id))
      .filter((e): e is Excerpt => Boolean(e));
    const sources = (used.length ? used : excerpts.slice(0, 2)).map((e) => ({
      title: e.title,
      heading: e.heading,
      url: e.url,
    }));

    return NextResponse.json({
      answer: parsed.answer ?? "I couldn't find enough reviewed information to answer that.",
      sources,
      confidence: parsed.confidence ?? "low",
      isSuggestion: Boolean(parsed.isSuggestion),
      limitations: parsed.limitations || undefined,
    });
  } catch (err) {
    console.error("Expert reasoning exception:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Expert reasoning failed." }, { status: 502 });
  }
}
