// A tiny client-side bridge so the voice tools (defined at module scope) can
// reach the live Next.js router and an ARIA live region owned by the React
// hook. The hook installs the bridge on mount; tools read it at call time.
// Everything here is browser-only.

export type VoiceBridge = {
  /** Client-side navigation via the app router (no full reload). */
  navigate: (href: string) => void;
  /** Router back. Returns false if there's no in-app history to go back to. */
  goBack: () => boolean;
  /** Announce a message via a polite ARIA live region. */
  announce: (message: string) => void;
  /** The current pathname. */
  getPathname: () => string;
};

let bridge: VoiceBridge | null = null;

export function setVoiceBridge(next: VoiceBridge | null): void {
  bridge = next;
}

export function getVoiceBridge(): VoiceBridge | null {
  return bridge;
}
