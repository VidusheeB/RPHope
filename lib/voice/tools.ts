// The voice assistant's tools. Each is strongly typed with a Zod schema and
// executes in the browser (the Realtime session runs client-side over WebRTC).
// Optional inputs are modeled as `.nullable()` (present, may be null) so the
// schema stays compatible with strict function-calling.

import { tool } from "@openai/agents/realtime";
import { z } from "zod";
import { searchKnowledge } from "../knowledge/search";
import { resolveDestination } from "./navigationRegistry";
import {
  getCurrentPageContext,
  listCurrentPageSections,
  readPageSection,
  scrollToSection,
} from "./pageContext";
import {
  setPreferences,
  type AccessibilityPreferences,
} from "./accessibilityPreferences";
import { getVoiceBridge } from "./bridge";
import { getStoryFormBridge } from "./storyFormBridge";

const search_rp_hope = tool({
  name: "search_rp_hope",
  description:
    "Search RP Hope's reviewed website content (genes, sections, articles, organization info). Call this before answering any factual question about the site. Returns source excerpts with links.",
  parameters: z.object({
    query: z.string().describe("What to look for, in the user's own words."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .nullable()
      .describe("Max results (default 5). Pass null for default."),
  }),
  execute: async ({ query, limit }) => {
    try {
      const currentUrl = getVoiceBridge()?.getPathname();
      const results = searchKnowledge(query, {
        limit: limit ?? 5,
        currentUrl,
      });
      if (results.length === 0) {
        return JSON.stringify({
          results: [],
          note: "No reviewed RP Hope content matched. Tell the user you couldn't verify it and suggest the closest section.",
        });
      }
      return JSON.stringify({
        results: results.map((r) => ({
          title: r.title,
          heading: r.heading,
          url: r.url,
          snippet: r.snippet,
          contentType: r.contentType,
        })),
      });
    } catch {
      return JSON.stringify({ results: [], error: "Search is unavailable right now." });
    }
  },
});

const get_current_page_context = tool({
  name: "get_current_page_context",
  description:
    "Get the meaningful content of the page the user is currently viewing (title, main heading, main text, section headings, primary actions). Use when the user refers to 'this page' or 'here'.",
  parameters: z.object({}),
  execute: async () => {
    try {
      return JSON.stringify(getCurrentPageContext());
    } catch {
      return JSON.stringify({ error: "Couldn't read the current page." });
    }
  },
});

const list_current_page_sections = tool({
  name: "list_current_page_sections",
  description:
    "List the visible section headings (h1/h2/h3) on the current page in reading order, each with a stable id for reading or scrolling.",
  parameters: z.object({}),
  execute: async () => {
    try {
      return JSON.stringify({ sections: listCurrentPageSections() });
    } catch {
      return JSON.stringify({ sections: [] });
    }
  },
});

const read_page_section = tool({
  name: "read_page_section",
  description:
    "Return the meaningful text of one section of the current page to read aloud. Pass mode 'verbatim' to read as written or 'summary' to paraphrase. Pass continue=true to read the next chunk of the section you last read.",
  parameters: z.object({
    sectionId: z.string().nullable().describe("Section id from list_current_page_sections, or null."),
    heading: z.string().nullable().describe("Section heading text to match, or null."),
    mode: z.enum(["verbatim", "summary"]),
    continue: z.boolean().nullable().describe("True to continue the previous section."),
  }),
  execute: async ({ sectionId, heading, mode, continue: cont }) => {
    try {
      const res = readPageSection({
        sectionId: sectionId ?? undefined,
        heading: heading ?? undefined,
        mode,
        continue: cont ?? false,
      });
      return JSON.stringify(res);
    } catch {
      return JSON.stringify({ found: false, message: "Couldn't read that section." });
    }
  },
});

const navigate_to_page = tool({
  name: "navigate_to_page",
  description:
    "Navigate to an RP Hope page by natural name or gene symbol (e.g. 'the gene library', 'RPGR', 'donate'). Only real internal pages are allowed. Confirm the destination after it succeeds.",
  parameters: z.object({
    destination: z.string().describe("Where to go, in natural language."),
    reason: z.string().nullable().describe("Why (optional)."),
  }),
  execute: async ({ destination }) => {
    const dest = resolveDestination(destination);
    if (!dest) {
      return JSON.stringify({
        navigated: false,
        error: `No RP Hope page matches "${destination}". Offer to search instead.`,
      });
    }
    const bridge = getVoiceBridge();
    if (!bridge) {
      return JSON.stringify({ navigated: false, error: "Navigation is unavailable." });
    }
    bridge.navigate(dest.href);
    return JSON.stringify({ navigated: true, title: dest.title, route: dest.href });
  },
});

const go_back = tool({
  name: "go_back",
  description: "Go back to the previous page using in-app history.",
  parameters: z.object({}),
  execute: async () => {
    const bridge = getVoiceBridge();
    if (!bridge) return JSON.stringify({ ok: false, error: "Unavailable." });
    const ok = bridge.goBack();
    return JSON.stringify({ ok, note: ok ? "Went back." : "No previous page." });
  },
});

/** Hope calls this the moment the user signals they are done ("bye",
 *  "goodbye", "stop listening", "I'm done", "that's all"). The hook's
 *  endSession is idempotent, so a duplicate call — or a race with the
 *  transcript-based fallback detector — is harmless. */
const end_voice_session = tool({
  name: "end_voice_session",
  description:
    "End the voice conversation. Call this immediately when the user says or clearly means goodbye, 'stop listening', 'end the conversation', \"I'm done\", or \"that's all\". Say only the short goodbye line, nothing else.",
  parameters: z.object({}),
  execute: async () => {
    const bridge = getVoiceBridge();
    if (!bridge) return JSON.stringify({ ok: false, error: "Unavailable." });
    bridge.endSession();
    return JSON.stringify({ ok: true, note: "Session ending." });
  },
});

const scroll_to_section = tool({
  name: "scroll_to_section",
  description: "Scroll a section of the current page into view and focus it.",
  parameters: z.object({
    heading: z.string().describe("The section heading to scroll to."),
  }),
  execute: async ({ heading }) => {
    try {
      const res = scrollToSection(heading);
      const bridge = getVoiceBridge();
      if (res.found && res.heading) bridge?.announce(`Scrolled to ${res.heading}`);
      return JSON.stringify(res);
    } catch {
      return JSON.stringify({ found: false });
    }
  },
});

const set_accessibility_preferences = tool({
  name: "set_accessibility_preferences",
  description:
    "Adjust display and speech preferences: text size, contrast, reduced motion, speech pace, captions. Applies immediately and persists.",
  parameters: z.object({
    textScale: z.enum(["default", "large", "extra-large"]).nullable(),
    contrast: z.enum(["default", "high"]).nullable(),
    reducedMotion: z.boolean().nullable(),
    speechPace: z.enum(["slower", "normal", "faster"]).nullable(),
    captions: z.boolean().nullable(),
  }),
  execute: async (input) => {
    const update: Partial<AccessibilityPreferences> = {};
    if (input.textScale != null) update.textScale = input.textScale;
    if (input.contrast != null) update.contrast = input.contrast;
    if (input.reducedMotion != null) update.reducedMotion = input.reducedMotion;
    if (input.speechPace != null) update.speechPace = input.speechPace;
    if (input.captions != null) update.captions = input.captions;
    try {
      const next = setPreferences(update);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("rphope-a11y-changed", { detail: next }));
      }
      return JSON.stringify({ ok: true, preferences: next });
    } catch {
      return JSON.stringify({ ok: false, error: "Couldn't update preferences." });
    }
  },
});

const ask_rp_expert = tool({
  name: "ask_rp_expert",
  description:
    "Ask the RP Hope expert reasoner for a careful answer that needs synthesis, comparison, personalized (non-medical) next steps, or complex genetic/trial explanation. Do NOT use for greetings, simple navigation, or obvious questions. Deliver the result conversationally.",
  parameters: z.object({
    question: z.string().describe("The user's question, in full."),
    context: z.string().nullable().describe("Any relevant context from the conversation, or null."),
  }),
  execute: async ({ question, context }) => {
    try {
      const res = await fetch("/api/openai/rp-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: context ?? undefined }),
      });
      if (!res.ok) {
        return JSON.stringify({
          answer:
            "I couldn't reach the expert reasoner just now. I can still search the site and tell you what I find.",
          sources: [],
          confidence: "low",
          isSuggestion: false,
        });
      }
      return await res.text();
    } catch {
      return JSON.stringify({
        answer:
          "I couldn't reach the expert reasoner just now. I can still search the site and tell you what I find.",
        sources: [],
        confidence: "low",
        isSuggestion: false,
      });
    }
  },
});

const submit_story = tool({
  name: "submit_story",
  description:
    "Submit a story to RP Hope's Share Your Story feature. Only call this AFTER reading the name and email back to the user letter-by-letter (and phone digit-by-digit, if given) and getting explicit confirmation, then doing one final full read-back of everything and getting an explicit yes to submit. Never call this without that confirmation. If the user is on the Share Your Story page, this visibly fills in and submits the real on-screen form (several seconds of visible activity) so they end up on the actual confirmation screen — say a brief line like 'let me fill that in and submit it now' right before calling this, since there will be a short pause while it runs.",
  parameters: z.object({
    fullName: z.string().describe("The submitter's full name, confirmed by spelling."),
    email: z.string().describe("The submitter's email, confirmed by spelling."),
    phone: z.string().nullable().describe("Phone number, if given and confirmed."),
    contactMethod: z.enum(["email", "phone"]).describe("How RP Hope should follow up."),
    consentToPublish: z
      .boolean()
      .describe("Must be true — the user explicitly agreed their story may be published."),
    editPermission: z
      .enum(["review_first", "free_edit"])
      .describe("review_first = send the final draft back for approval; free_edit = RP Hope may edit and publish without checking back."),
    displayName: z.string().describe('Name to show publicly, or "Anonymous".'),
    displayContact: z.enum(["email", "phone", "none"]).describe("What contact info, if any, to show publicly."),
    geneSlug: z.string().nullable().describe("Their gene, if known and mentioned (e.g. 'rpgr')."),
    storyText: z.string().describe("The story itself, in the user's own words as captured from the conversation."),
  }),
  execute: async (input) => {
    const payload = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? undefined,
      contactMethod: input.contactMethod,
      consentToPublish: input.consentToPublish,
      editPermission: input.editPermission,
      displayName: input.displayName,
      displayContact: input.displayContact,
      geneSlug: input.geneSlug ?? undefined,
      storyText: input.storyText,
    };

    // Prefer the visible, on-page replay (real form, real Thank You screen)
    // when the Share Your Story page is actually mounted.
    const formBridge = getStoryFormBridge();
    if (formBridge) {
      try {
        const result = await formBridge.fillAndSubmit(payload);
        if (result.ok) {
          return JSON.stringify({
            submitted: true,
            message:
              "Story submitted through the visible on-screen form. The user is now looking at the real confirmation screen.",
          });
        }
        return JSON.stringify({
          submitted: false,
          error: result.error || "The on-screen submission failed.",
        });
      } catch {
        /* fall through to a direct submit below */
      }
    }

    // Fallback: the page isn't mounted (e.g. the user navigated away
    // mid-conversation). Submit directly so the story isn't lost — the
    // user just won't see the visible form or the real Thank You screen.
    try {
      const res = await fetch("/api/stories/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return JSON.stringify({
          submitted: false,
          error: body?.error || "Submission failed. Suggest the Share Your Story page as a fallback.",
        });
      }
      return JSON.stringify({
        submitted: true,
        message:
          "Story submitted directly (the on-screen form wasn't open, so there's no visible confirmation screen to show). RP Hope will follow up within about 10 business days.",
      });
    } catch {
      return JSON.stringify({
        submitted: false,
        error: "Couldn't reach the server. Suggest the Share Your Story page as a fallback.",
      });
    }
  },
});

export const rpHopeTools = [
  search_rp_hope,
  get_current_page_context,
  list_current_page_sections,
  read_page_section,
  navigate_to_page,
  go_back,
  scroll_to_section,
  set_accessibility_preferences,
  ask_rp_expert,
  submit_story,
  end_voice_session,
];
