// Resend wrapper for the "Share your story" review loop (received/notify/
// approval-request/published/declined emails). Returns null when
// RESEND_API_KEY isn't set, same config-null-fallback shape as
// supabaseConfigured/stripeConfigured — so the rest of the story pipeline
// (DB insert, reviewer dashboard) still works before the key is added; only
// the emails are skipped. This is also the fix Contact Us has needed since
// its mailto: interim (see app/contact/ContactForm.tsx) — reuse this module
// there too when ready, rather than adding a second email client.

import { Resend } from "resend";
import { reviewHref } from "./reviewer/paths";

const FROM = process.env.STORY_EMAIL_FROM || "RP Hope <information@rphope.org>";
const REVIEWER_INBOX = process.env.STORY_REVIEWER_EMAIL || "information@rphope.org";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rp-hope.vercel.app";

export const emailConfigured = Boolean(process.env.RESEND_API_KEY);

export function buildApprovalUrl(approvalToken: string): string {
  return `${SITE_URL}/stories/approve/${approvalToken}`;
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

async function send(to: string, subject: string, text: string): Promise<void> {
  const client = getClient();
  if (!client) {
    console.info(`[email skipped, RESEND_API_KEY not set] to=${to} subject="${subject}"`);
    return;
  }
  const { error } = await client.emails.send({ from: FROM, to, subject, text });
  if (error) console.error("Resend send failed:", error);
}

export async function sendStoryReceivedEmail(to: string, fullName: string): Promise<void> {
  await send(
    to,
    "We received your story — RP Hope",
    `Hi ${fullName},\n\n` +
      "Thank you for sharing your story with RP Hope. Here's what happens next:\n\n" +
      "1. A reviewer will read it over.\n" +
      "2. If you asked to review the final version, we'll send it to you before it goes live. If you gave us permission to edit freely, we'll publish once it's ready.\n" +
      "3. Either way, we'll follow up within about 10 business days.\n\n" +
      "If you have questions in the meantime, just reply to this email or write to information@rphope.org.\n\n" +
      "— RP Hope"
  );
}

export async function sendReviewerNotificationEmail(submissionId: string): Promise<void> {
  await send(
    REVIEWER_INBOX,
    "New story submission awaiting review",
    `A new story was submitted and is waiting for review.\n\n` +
      `Review it here: ${SITE_URL}${reviewHref(`/stories/${submissionId}`)}`
  );
}

export async function sendApprovalRequestEmail(
  to: string,
  fullName: string,
  approvalToken: string
): Promise<void> {
  await send(
    to,
    "Your story is ready to review — RP Hope",
    `Hi ${fullName},\n\n` +
      "We've finished reviewing and lightly editing your story. Please take a look and let us know if it's ready to publish:\n\n" +
      `${buildApprovalUrl(approvalToken)}\n\n` +
      "You can approve it as-is or request changes from that page.\n\n" +
      "— RP Hope"
  );
}

export async function sendStoryPublishedEmail(to: string, fullName: string, storyId: string): Promise<void> {
  await send(
    to,
    "Your story is live on RP Hope",
    `Hi ${fullName},\n\n` +
      "Your story is now published. Thank you for sharing it with the RP Hope community:\n\n" +
      `${SITE_URL}/stories/${storyId}\n\n` +
      "— RP Hope"
  );
}

export async function sendStoryDeclinedEmail(to: string, fullName: string): Promise<void> {
  await send(
    to,
    "About your story submission — RP Hope",
    `Hi ${fullName},\n\n` +
      "Thank you for sharing your story with us. After review, we're not able to publish it at this time. " +
      "If you'd like to talk about it, reach out anytime at information@rphope.org.\n\n" +
      "— RP Hope"
  );
}
