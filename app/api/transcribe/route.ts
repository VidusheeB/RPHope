import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Generic OpenAI audio transcription — same model already used for the
// Realtime voice assistant's input transcription (lib/voice/agent.ts's
// TRANSCRIBE_MODEL), reused here as a one-shot file endpoint instead of a
// streaming session. Not story-specific, so it's reusable elsewhere later
// (same shape as /api/tts).
//
// Two request shapes:
//  - multipart/form-data with an "audio" field — a short browser-recorded
//    clip (MediaRecorder or a small uploaded audio file), sent directly.
//  - JSON { mediaPath } — an already-uploaded story video or audio file.
//    Fetched from Supabase Storage SERVER-SIDE rather than re-uploaded
//    here, so it never hits this route's own request-body size (the
//    signed-upload flow in /api/stories/upload-video and upload-audio
//    exists specifically to avoid that limit) — used for video always,
//    and for any audio file large enough that sending it directly wasn't
//    a safe assumption.
//
// OpenAI's transcription endpoint caps input at 25MB — fine for a dictation
// clip, but a heavier file may exceed it; in that case a reviewer can still
// watch/listen to it and type the story text themselves.

const KEY = process.env.OPENAI_API_KEY;
const MODEL = "gpt-4o-mini-transcribe";
const MAX_BYTES = 25 * 1024 * 1024;

async function transcribeBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);
  form.append("model", MODEL);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI transcription failed: ${res.status} ${detail}`);
  }
  const data = await res.json();
  return String(data.text ?? "");
}

export async function POST(req: Request) {
  if (!KEY) {
    return NextResponse.json({ error: "Transcription not configured" }, { status: 501 });
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No audio provided." }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "Recording is too long to transcribe." }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await transcribeBuffer(buffer, file.name || "audio.webm", file.type || "audio/webm");
      return NextResponse.json({ text });
    }

    const body = await req.json();
    const mediaPath = String(body?.mediaPath ?? body?.videoPath ?? "");
    if (!mediaPath) {
      return NextResponse.json({ error: "No media path provided." }, { status: 400 });
    }
    const service = getServiceSupabase();
    if (!service) {
      return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }
    const { data, error } = await service.storage.from("story-videos").download(mediaPath);
    if (error || !data) {
      return NextResponse.json({ error: "Could not read the uploaded file." }, { status: 502 });
    }
    if (data.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large to auto-transcribe. A reviewer can transcribe it manually." },
        { status: 413 }
      );
    }
    const isAudio = mediaPath.endsWith(".webm") || mediaPath.endsWith(".mp3") || mediaPath.endsWith(".wav");
    const buffer = Buffer.from(await data.arrayBuffer());
    const text = await transcribeBuffer(
      buffer,
      isAudio ? "audio.webm" : "video.mp4",
      isAudio ? "audio/webm" : "video/mp4"
    );
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Transcription error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Transcription failed." }, { status: 502 });
  }
}
