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
];
