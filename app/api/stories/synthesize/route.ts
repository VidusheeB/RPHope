import { NextResponse } from "next/server";

export const runtime = "nodejs";

// "Synthesize" button on the story form: cleans up a typed, dictated, or
// video-transcribed draft — removes filler words/false starts, light
// grammar polish only, keeps the submitter's own wording/voice/facts intact.
// Same model + call shape as /api/openai/rp-expert (gpt-5.4, reasoning_effort
// "medium") — this is the site's other "stay faithful to the source, don't
// invent" reasoning task, so it reuses that exact convention.

const KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-5.4";
const MAX_TEXT = 6000;

const INSTRUCTIONS = `You clean up a personal story someone is submitting to a retinitis pigmentosa nonprofit's website. The text may come from typing, voice dictation, or a video transcript, so it may have filler words ("um", "uh", "like"), false starts, repeated words, or run-on sentences.

Your only job: remove filler and false starts, fix light grammar/punctuation, and merge stray fragments into coherent sentences. Preserve the person's own wording, voice, facts, and meaning as closely as possible. Do not add details, embellish, change the meaning of anything, or make it sound like someone else wrote it. Do not shorten it significantly — keep roughly the same length unless it's extremely repetitive. Return only the cleaned story text, nothing else (no preamble, no quotes around it).`;

export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json({ error: "Synthesis is not configured yet." }, { status: 503 });
  }

  let text = "";
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }
  text = text.slice(0, MAX_TEXT);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: INSTRUCTIONS },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Synthesize model request failed:", res.status);
      return NextResponse.json({ error: "Synthesis failed." }, { status: 502 });
    }

    const data = await res.json();
    const synthesized = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!synthesized) {
      return NextResponse.json({ error: "Synthesis returned nothing." }, { status: 502 });
    }
    return NextResponse.json({ synthesized });
  } catch (err) {
    console.error("Synthesize exception:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Synthesis failed." }, { status: 502 });
  }
}
