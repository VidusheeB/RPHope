// Accessibility preferences the voice assistant can set on the user's request
// ("make the text bigger", "turn on high contrast"). Persisted to localStorage
// (UI preference only — never conversation or medical data) and applied to the
// document root so site CSS can respond. See globals.css for the CSS hooks.

export type SpeechPace = "slower" | "normal" | "faster";

export type AccessibilityPreferences = {
  textScale: "default" | "large" | "extra-large";
  contrast: "default" | "high";
  reducedMotion: boolean;
  speechPace: SpeechPace;
  captions: boolean;
};

export const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textScale: "default",
  contrast: "default",
  reducedMotion: false,
  speechPace: "normal",
  captions: true,
};

const STORAGE_KEY = "rphope_a11y";

const TEXT_SCALE_ROOT: Record<AccessibilityPreferences["textScale"], string> = {
  default: "100%",
  large: "112.5%",
  "extra-large": "125%",
};

export const SPEECH_RATE: Record<SpeechPace, number> = {
  slower: 0.85,
  normal: 1,
  faster: 1.15,
};

export function getPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AccessibilityPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function applyPreferences(prefs: AccessibilityPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = TEXT_SCALE_ROOT[prefs.textScale];
  root.setAttribute("data-contrast", prefs.contrast);
  root.setAttribute("data-reduced-motion", prefs.reducedMotion ? "true" : "false");
}

/**
 * Merge and persist a partial preferences update, apply it to the DOM, and
 * return the full resulting preferences. Safe to call on the server (no-op
 * persistence). Never throws.
 */
export function setPreferences(
  update: Partial<AccessibilityPreferences>
): AccessibilityPreferences {
  const next = { ...getPreferences(), ...update };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota/availability errors */
    }
  }
  applyPreferences(next);
  return next;
}
