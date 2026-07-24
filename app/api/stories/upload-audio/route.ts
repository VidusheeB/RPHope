import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Mints a Supabase Storage signed UPLOAD url/token for a "Record my story"
// audio clip — same signed-upload pattern as /api/stories/upload-video (and
// the same reasoning: keep the recording bytes off this server's own
// request body). Reuses the story-videos bucket rather than adding a second
// one; audio and video just live under different filenames.
export async function POST() {
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const path = `${crypto.randomUUID()}.webm`;
  const { data, error } = await service.storage
    .from("story-videos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Could not create signed upload URL:", error);
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 502 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
