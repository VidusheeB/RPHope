// A page-scoped bridge (mirrors lib/voice/bridge.ts's pattern) so the
// submit_story voice tool can drive the REAL Share Your Story form — fill
// its fields visibly, step through it, and submit through the same code
// path the manual "Submit story" button uses — instead of a silent
// background API call the user has no visual confirmation of.
//
// Registered only while app/share-your-story/ShareYourStoryFlow.tsx is
// mounted. If it isn't (e.g. the user navigated away mid-conversation),
// the tool falls back to a direct API submission so the story still isn't
// lost — it just won't show the visible walkthrough or the real Thank You
// screen in that edge case.

import type { StorySubmissionInput } from "@/lib/stories/types";

export type StoryFormBridge = {
  fillAndSubmit: (data: StorySubmissionInput) => Promise<{ ok: boolean; error?: string }>;
};

let bridge: StoryFormBridge | null = null;

export function setStoryFormBridge(next: StoryFormBridge | null): void {
  bridge = next;
}

export function getStoryFormBridge(): StoryFormBridge | null {
  return bridge;
}
