import { NextResponse } from "next/server";

export const runtime = "nodejs";

// OpenAI text-to-speech. TRIAL: a more natural voice than the browser-native
// Web Speech API for both "Listen to this page" and the conversational voice
// assistant. Uses `gpt-4o-mini-tts`, whose `instructions` field lets us steer
// tone/inflection (warm, caring) — the thing the browser voice can't do.
//
// Governance/cost note: CLAUDE.md defaults to free client-side Web Speech; this
// paid path is opt-in and only active when OPENAI_API_KEY is set. Without a key
// the client falls back to the browser voice, so nothing breaks.

const KEY = process.env.OPENAI_API_KEY;

// Warm, expressive default. Voices: alloy, ash, ballad, coral, echo, fable,
// nova, onyx, sage, shimmer.
const DEFAULT_VOICE = "coral";
const DEFAULT_INSTRUCTIONS =
  "Speak warmly and clearly, like a caring guide helping someone with vision loss. " +
  "Use a calm, natural pace with gentle inflection. Read gene symbols letter by letter.";

// GET is a capability probe the client uses to decide OpenAI vs browser voice.
export async function GET() {
  return NextResponse.json({ available: Boolean(KEY) });
}

export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json(
      { error: "TTS not configured" },
      { status: 501 }
    );
  }

  let text: string;
  let voice: string | undefined;
  let instructions: string | undefined;
  try {
    const body = await req.json();
    text = String(body?.text ?? "").trim();
    voice = body?.voice;
    instructions = body?.instructions;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "No text" }, { status: 400 });
  }
  // OpenAI caps input at 4096 chars; the client chunks below this, but guard anyway.
  if (text.length > 4096) text = text.slice(0, 4096);

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voice || DEFAULT_VOICE,
        input: text,
        instructions: instructions || DEFAULT_INSTRUCTIONS,
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("OpenAI TTS error:", res.status, detail);
      return NextResponse.json(
        { error: "Voice generation failed" },
        { status: 502 }
      );
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("OpenAI TTS fetch error:", err);
    return NextResponse.json({ error: "Voice generation failed" }, { status: 502 });
  }
}
