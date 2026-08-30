import { describe, it, expect } from "vitest";
import { z } from "zod";
import { rpHopeTools } from "@/lib/voice/tools";

// Schema mirroring set_accessibility_preferences, used to confirm the Zod
// validation we rely on for tool inputs rejects out-of-enum values.
const prefsSchema = z.object({
  textScale: z.enum(["default", "large", "extra-large"]).nullable(),
  contrast: z.enum(["default", "high"]).nullable(),
});

describe("tool input validation", () => {
  it("accepts valid enum values", () => {
    expect(prefsSchema.safeParse({ textScale: "large", contrast: null }).success).toBe(true);
  });

  it("rejects invalid enum values", () => {
    expect(prefsSchema.safeParse({ textScale: "huge", contrast: null }).success).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(prefsSchema.safeParse({ textScale: 3, contrast: "high" }).success).toBe(false);
  });

  it("exposes the expected set of named tools", () => {
    const names = rpHopeTools.map((t) => (t as { name: string }).name).sort();
    expect(names).toEqual(
      [
        "ask_rp_expert",
        "end_voice_session",
        "get_current_page_context",
        "go_back",
        "list_current_page_sections",
        "navigate_to_page",
        "read_page_section",
        "scroll_to_section",
        "search_rp_hope",
        "set_accessibility_preferences",
        "submit_story",
      ].sort()
    );
  });
});
