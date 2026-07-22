// Shared types for the "Share your story" submission pipeline. Mirrors the
// enums/columns in supabase/migrations/0004_story_submissions.sql — keep the
// two in sync if either changes.

export type StoryStatus = "pending_review" | "published" | "rejected";
export type ContactMethod = "email" | "phone";
export type EditPermission = "review_first" | "free_edit";
export type DisplayContact = "email" | "phone" | "none";

/** The payload the client POSTs to /api/stories/submit. */
export type StorySubmissionInput = {
  // Section 1 — private.
  fullName: string;
  email: string;
  phone?: string;
  contactMethod: ContactMethod;
  consentToPublish: boolean;
  editPermission: EditPermission;
  // Section 2 — public-facing.
  displayName: string;
  displayContact: DisplayContact;
  geneSlug?: string;
  storyText: string;
  storyTextRaw?: string;
  videoPath?: string;
};

/** A published story as read back for the public /stories pages — private
 *  Section 1 fields are never included in this shape. */
export type PublishedStory = {
  id: string;
  displayName: string;
  displayContact: DisplayContact;
  contactValue?: string; // only populated when displayContact !== "none"
  geneSlug?: string;
  storyText: string;
  /** Present when the story was submitted as video — the video IS the
   *  story on the public page; storyText becomes its transcript/caption
   *  (kept for screen-reader and low-vision visitors who can't watch it —
   *  required by this site's accessibility bar, not just a nice-to-have). */
  videoUrl?: string;
  publishedAt: string;
};

export const STORY_WORD_COUNT_RECOMMENDED_MIN = 300;
export const STORY_WORD_COUNT_RECOMMENDED_MAX = 400;
