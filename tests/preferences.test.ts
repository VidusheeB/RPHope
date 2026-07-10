import { describe, it, expect, beforeEach } from "vitest";
import {
  getPreferences,
  setPreferences,
  applyPreferences,
  DEFAULT_PREFERENCES,
} from "@/lib/voice/accessibilityPreferences";

describe("accessibility preference persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-contrast");
    document.documentElement.removeAttribute("data-reduced-motion");
  });

  it("defaults when nothing stored", () => {
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("persists and merges updates", () => {
    setPreferences({ textScale: "large" });
    expect(getPreferences().textScale).toBe("large");
    setPreferences({ contrast: "high" });
    const prefs = getPreferences();
    expect(prefs.textScale).toBe("large"); // previous value preserved
    expect(prefs.contrast).toBe("high");
    expect(window.localStorage.getItem("rphope_a11y")).toContain("high");
  });

  it("applies preferences to the document root", () => {
    setPreferences({ contrast: "high", reducedMotion: true });
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe("true");
  });

  it("survives corrupted storage", () => {
    window.localStorage.setItem("rphope_a11y", "{not json");
    expect(getPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("applyPreferences scales root font size", () => {
    applyPreferences({ ...DEFAULT_PREFERENCES, textScale: "extra-large" });
    expect(document.documentElement.style.fontSize).toBe("125%");
  });
});
