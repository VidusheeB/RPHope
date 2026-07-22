import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { storySubmissionSchema } from "@/lib/stories/validation";
import { sendStoryReceivedEmail, sendReviewerNotificationEmail } from "@/lib/email";

export const runtime = "nodejs";

// Public submission endpoint for "Share your story". Validates with the
// shared Zod schema (defense in depth — the multi-step form already
// enforces this client-side), inserts as pending_review with the
// service-role client (bypasses RLS deliberately — there is no public
// insert policy on story_submissions), and fires the "received" +
// reviewer-notification emails. Emails silently no-op if RESEND_API_KEY
// isn't set yet; the submission still succeeds.
export async function POST(req: Request) {
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = storySubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid submission.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const v = parsed.data;

  const { data, error } = await service
    .from("story_submissions")
    .insert({
      full_name: v.fullName,
      email: v.email,
      phone: v.phone || null,
      contact_method: v.contactMethod,
      consent_to_publish: v.consentToPublish,
      edit_permission: v.editPermission,
      display_name: v.displayName,
      display_contact: v.displayContact,
      gene_slug: v.geneSlug || null,
      story_text: v.storyText,
      story_text_raw: v.storyTextRaw || null,
      video_path: v.videoPath || null,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Story submission insert failed:", error);
    return NextResponse.json({ error: "Could not save submission." }, { status: 502 });
  }

  await Promise.all([
    sendStoryReceivedEmail(v.email, v.fullName),
    sendReviewerNotificationEmail(data.id as string),
  ]);

  return NextResponse.json({ ok: true, id: data.id });
}
