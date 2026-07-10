// Mints a short-lived ephemeral client token (ek_...) for the browser to open a
// Realtime WebRTC session. The real OPENAI_API_KEY never leaves the server and
// is never returned to the client. Returns 503 when the key is absent so the UI
// can show a clear "not configured" state.

import { NextResponse } from "next/server";
import { rateLimit, clientKey } from "@/lib/voice/rateLimit";

export const runtime = "nodejs";

const KEY = process.env.OPENAI_API_KEY;
const REALTIME_MODEL = "gpt-realtime-2.1";

// Lightweight probe for the UI (no secret involved).
export async function GET() {
  return NextResponse.json({ configured: Boolean(KEY) });
}

export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json(
      { error: "Voice assistant is not configured yet." },
      { status: 503 }
    );
  }

  const rl = rateLimit(`realtime:${clientKey(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many voice sessions started. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 30) } }
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: { type: "realtime", model: REALTIME_MODEL },
      }),
    });

    if (!res.ok) {
      // Do not surface upstream error bodies (may contain sensitive detail).
      console.error("Realtime token request failed:", res.status);
      return NextResponse.json(
        { error: "Could not start a voice session. Please try again." },
        { status: 502 }
      );
    }

    const data = await res.json();
    // The ephemeral secret is the only thing the browser needs.
    const value: string | undefined = data?.value ?? data?.client_secret?.value;
    const expiresAt =
      data?.expires_at ?? data?.client_secret?.expires_at ?? null;

    if (!value || typeof value !== "string") {
      console.error("Realtime token response missing ephemeral value");
      return NextResponse.json(
        { error: "Could not start a voice session. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ value, expiresAt, model: REALTIME_MODEL });
  } catch (err) {
    console.error("Realtime token exception:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { error: "Could not start a voice session. Please try again." },
      { status: 502 }
    );
  }
}
