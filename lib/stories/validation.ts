// Shared validation for a story submission — used both client-side (the
// multi-step form's per-step "can continue" checks) and server-side
// (/api/stories/submit, defense in depth against a client that skips the UI).

import { z } from "zod";
import {
  STORY_WORD_COUNT_RECOMMENDED_MAX,
  STORY_WORD_COUNT_RECOMMENDED_MIN,
} from "./types";

export const storySubmissionSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().optional(),
    contactMethod: z.enum(["email", "phone"]),
    consentToPublish: z
      .boolean()
      .refine((v) => v === true, "Consent to publish is required to submit a story."),
    editPermission: z.enum(["review_first", "free_edit"]),
    displayName: z.string().trim().min(1, 'Enter a display name, or "Anonymous".'),
    displayContact: z.enum(["email", "phone", "none"]),
    geneSlug: z.string().trim().optional(),
    storyText: z.string().trim().min(1, "Your story can't be empty."),
    storyTextRaw: z.string().optional(),
    videoPath: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.contactMethod === "phone" && !val.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number is required when phone is your preferred contact method.",
      });
    }
    if (val.displayContact === "phone" && !val.phone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "A phone number is needed to display it publicly.",
      });
    }
  });

export type StorySubmissionParsed = z.infer<typeof storySubmissionSchema>;

/** Word count helper for the story text area's ~300–400 word guidance. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function wordCountHint(text: string): string {
  const n = wordCount(text);
  if (n === 0) return `Recommended length: ${STORY_WORD_COUNT_RECOMMENDED_MIN}–${STORY_WORD_COUNT_RECOMMENDED_MAX} words.`;
  if (n < STORY_WORD_COUNT_RECOMMENDED_MIN) return `${n} words — a bit shorter than the recommended ${STORY_WORD_COUNT_RECOMMENDED_MIN}–${STORY_WORD_COUNT_RECOMMENDED_MAX}, and that's okay.`;
  if (n > STORY_WORD_COUNT_RECOMMENDED_MAX) return `${n} words — longer than the recommended ${STORY_WORD_COUNT_RECOMMENDED_MIN}–${STORY_WORD_COUNT_RECOMMENDED_MAX}, but that's okay too.`;
  return `${n} words — right in the recommended range.`;
}
