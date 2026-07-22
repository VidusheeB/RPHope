// Strict internal route registry for the voice assistant. The assistant can
// ONLY navigate to routes in this allowlist — it physically cannot open an
// arbitrary or external URL. Natural destination names ("the gene library",
// "take me home", "RPGR") resolve to real internal routes here.

import { sections } from "../navTargets";
import { geneGrid } from "../geneGrid";

export type Destination = { href: string; title: string };

// Canonical internal routes with a human title. Sections come from the shared
// nav registry; extras cover pages not in the primary nav.
const baseRoutes: Destination[] = [
  { href: "/", title: "Home" },
  ...sections.map((s) => ({ href: s.href, title: s.label })),
  { href: "/who-we-are", title: "Who We Are" },
  { href: "/what-is-rp-hope", title: "What is RP Hope" },
  { href: "/what-is-rp", title: "What is RP" },
  { href: "/what-is-a-clinical-trial", title: "What is a Clinical Trial" },
  { href: "/share-your-story", title: "Share Your Story" },
  { href: "/transparency", title: "Financial Transparency" },
  { href: "/privacy-policy", title: "Privacy Policy" },
  { href: "/terms-of-use", title: "Terms of Use" },
];

// Gene detail routes (one per gene in the library).
const geneRoutes: Destination[] = geneGrid.map((g) => ({
  href: `/genetic-insights/${g.slug}`,
  title: `${g.display} — Genetic Insights`,
}));

const ALL_ROUTES: Destination[] = [...baseRoutes, ...geneRoutes];

// The definitive allowlist of hrefs the assistant may navigate to.
export const ALLOWED_HREFS: ReadonlySet<string> = new Set(
  ALL_ROUTES.map((r) => r.href)
);

// Friendly aliases -> canonical href. Lowercased keys.
const ALIASES: Record<string, string> = {
  home: "/",
  "home page": "/",
  "main page": "/",
  "start page": "/",
  about: "/who-we-are",
  "about us": "/who-we-are",
  "who we are": "/who-we-are",
  "what is rp hope": "/what-is-rp-hope",
  "what is rphope": "/what-is-rp-hope",
  "what is rp": "/what-is-rp",
  "what is retinitis pigmentosa": "/what-is-rp",
  "what is a clinical trial": "/what-is-a-clinical-trial",
  "what are clinical trials": "/what-is-a-clinical-trial",
  "clinical trial basics": "/what-is-a-clinical-trial",
  genes: "/genetic-insights",
  "gene library": "/genetic-insights",
  "genetic insights": "/genetic-insights",
  "genetic testing": "/newly-diagnosed",
  "newly diagnosed": "/newly-diagnosed",
  "just diagnosed": "/newly-diagnosed",
  trials: "/clinical-trials",
  "clinical trials": "/clinical-trials",
  "trial finder": "/clinical-trials",
  stories: "/stories",
  "patient stories": "/stories",
  "share your story": "/share-your-story",
  "share my story": "/share-your-story",
  "submit my story": "/share-your-story",
  "tell my story": "/share-your-story",
  "share my rp story": "/share-your-story",
  events: "/events",
  community: "/events",
  donate: "/donate",
  donation: "/donate",
  give: "/donate",
  pathway: "/my-pathway",
  "my pathway": "/my-pathway",
  "my rp pathway": "/my-pathway",
  explore: "/explore",
  finances: "/transparency",
  financials: "/transparency",
  transparency: "/transparency",
  privacy: "/privacy-policy",
  terms: "/terms-of-use",
};

export function isAllowedHref(href: string): boolean {
  return ALLOWED_HREFS.has(href);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(take me to|go to|open|show me|navigate to|the)\s+/g, "")
    .replace(/\s+page$/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a natural destination name to a real internal route, or null if it
 * can't be mapped to an allowlisted page. Never returns an external URL.
 */
export function resolveDestination(input: string): Destination | null {
  const n = normalize(input);
  if (!n) return null;

  // Exact alias.
  if (ALIASES[n]) {
    return ALL_ROUTES.find((r) => r.href === ALIASES[n]) ?? null;
  }

  // Direct href passed in (must be allowlisted).
  if (input.startsWith("/") && isAllowedHref(input)) {
    return ALL_ROUTES.find((r) => r.href === input) ?? null;
  }

  // Gene symbol appearing ANYWHERE in the input — so "INPP5E", "the INPP5E
  // gene", and "open the RPGR gene page" all resolve, not just a bare symbol.
  const tokens: string[] = input.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const geneBySymbol = geneGrid.find((g) =>
    tokens.includes(g.display.toUpperCase())
  );
  if (geneBySymbol) {
    return {
      href: `/genetic-insights/${geneBySymbol.slug}`,
      title: `${geneBySymbol.display} — Genetic Insights`,
    };
  }

  // Title contains / contained-by match against known routes.
  const byTitle = ALL_ROUTES.find((r) => {
    const t = r.title.toLowerCase();
    return t === n || t.includes(n) || n.includes(t);
  });
  if (byTitle) return byTitle;

  // Alias substring match.
  const aliasKey = Object.keys(ALIASES).find((k) => n.includes(k) || k.includes(n));
  if (aliasKey) {
    return ALL_ROUTES.find((r) => r.href === ALIASES[aliasKey]) ?? null;
  }

  return null;
}
