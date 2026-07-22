import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Mints a Supabase Storage signed UPLOAD url/token for a story video, rather
// than accepting the video bytes in this route's own request body. A 3-5
// minute video easily exceeds Vercel serverless functions' request-body
// limit, so the browser uploads DIRECTLY to Supabase Storage using the
// token this returns (lib/stories client code calls
// supabase.storage.from('story-videos').uploadToSignedUrl(path, token, file)
// with the anon-key browser client) — the video never passes through this
// server at all. The bucket is private; the path/token pair is the only way
// in, and it's single-use.
export async function POST() {
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const path = `${crypto.randomUUID()}.mp4`;
  const { data, error } = await service.storage
    .from("story-videos")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("Could not create signed upload URL:", error);
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 502 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
