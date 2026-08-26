// Deterministic normalization of messy condition + gene input.
//
// We intentionally normalize with a dictionary + fuzzy match against RP Hope's
// known gene list rather than an AI call. For "did you mean RPGR?" this is more
// reliable, instant (runs client-side in the intake form, no round trip), and
// keeps governance tight — the model can never invent a gene that isn't real.
// AI is reserved for relevance explanation downstream (lib/trials/explain.ts).

import { geneGrid } from "@/lib/geneGrid";
import { geneCatalog } from "@/lib/geneCatalog";
import { canonGene } from "./geneUtil";

// ---- Condition normalization ----------------------------------------------

export type ConditionNormalization = {
  raw: string;
  normalized?: string; // canonical display, e.g. "Retinitis pigmentosa"
  confidence: "high" | "medium" | "low";
  // term handed to the ClinicalTrials.gov condition query
  ctgovCondition: string;
};

type ConditionEntry = { canonical: string; ctgov: string; patterns: RegExp[] };

const CONDITIONS: ConditionEntry[] = [
  {
    canonical: "Retinitis pigmentosa",
    ctgov: "retinitis pigmentosa",
    patterns: [/\brp\b/i, /retinitis\s*pigmentosa/i],
  },
  {
    canonical: "Usher syndrome",
    ctgov: "usher syndrome",
    patterns: [/usher/i],
  },
  {
    canonical: "Leber congenital amaurosis",
    ctgov: "leber congenital amaurosis",
    patterns: [/\blca\b/i, /leber\s*congenital/i, /\bamaurosis\b/i],
  },
  {
    canonical: "Stargardt disease",
    ctgov: "stargardt disease",
    patterns: [/stargardt/i],
  },
  {
    canonical: "Cone-rod dystrophy",
    ctgov: "cone-rod dystrophy",
    patterns: [/cone[\s-]*rod/i, /\bcrd\b/i],
  },
  {
    canonical: "Inherited retinal disease",
    ctgov: "inherited retinal disease",
    patterns: [
      /\bird\b/i,
      /inherited\s*retinal\s*(disease|dystrophy|degeneration)/i,
      /retinal\s*dystrophy/i,
    ],
  },
];

export function normalizeCondition(raw: string): ConditionNormalization {
  const text = (raw || "").trim();
  if (!text) {
    // empty → default to the broadest umbrella term
    return {
      raw: text,
      normalized: "Inherited retinal disease",
      confidence: "low",
      ctgovCondition: "inherited retinal disease",
    };
  }

  for (const entry of CONDITIONS) {
    if (entry.patterns.some((p) => p.test(text))) {
      return {
        raw: text,
        normalized: entry.canonical,
        confidence: "high",
        ctgovCondition: entry.ctgov,
      };
    }
  }

  // No dictionary hit — search the registry on the raw phrase but flag it low,
  // and broaden to IRD so the user still gets results.
  return {
    raw: text,
    normalized: undefined,
    confidence: "low",
    ctgovCondition: text,
  };
}

// ---- Gene normalization ----------------------------------------------------

export type GeneNormalization = {
  raw: string;
  // "exact"     → input already matches a known gene
  // "corrected" → fuzzy-matched to one gene (ask user to confirm)
  // "ambiguous" → several plausible genes (ask user to pick)
  // "none"      → no plausible match
  status: "exact" | "corrected" | "ambiguous" | "none";
  normalized?: string; // best single match (exact/corrected)
  candidates: string[]; // for ambiguous, the options to offer
  confidence: "high" | "medium" | "low";
  source: "exact" | "fuzzy" | "none";
};

// Known genes (uppercase display names) from the RP Hope library.
const KNOWN_GENES: string[] = Array.from(
  new Set(geneGrid.map((g) => g.display.toUpperCase())),
);

// Former and alternative symbols -> the gene's current name.
//
// A visitor's lab report or an older paper may name a symbol the library no
// longer lists: HGNC renamed C8orf37 to CFAP418, and USH3A / BBS3 are older
// names for CLRN1 / ARL6. Typing one of those used to fall through to fuzzy
// matching and usually resolve to nothing, which reads to the visitor as "your
// gene isn't here." Aliases are verified data from lib/geneCatalog.ts (the
// sheet's column B), so this is still a dictionary lookup, not a guess.
const GENE_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const g of geneCatalog) {
    for (const alias of g.aliases) {
      const key = canonGene(alias);
      // Never let an alias shadow a real gene symbol that exists in its own
      // right (a gene's current name always wins).
      if (key && !map[key]) map[key] = g.gene.toUpperCase();
    }
  }
  return map;
})();

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

export function normalizeGene(raw: string): GeneNormalization {
  const text = (raw || "").trim();
  const token = canonGene(text);
  if (!token) {
    return { raw: text, status: "none", candidates: [], confidence: "low", source: "none" };
  }

  // 1. Exact match (after canonicalization).
  if (KNOWN_GENES.includes(token)) {
    return {
      raw: text,
      status: "exact",
      normalized: token,
      candidates: [token],
      confidence: "high",
      source: "exact",
    };
  }

  // 2. A former or alternative symbol for a gene we do list (e.g. "C8orf37" ->
  //     CFAP418, "USH3A" -> CLRN1). Verified aliases, so treat as a confident
  //     correction rather than a fuzzy guess.
  const aliasHit = GENE_ALIASES[token];
  if (aliasHit && !KNOWN_GENES.includes(token)) {
    return {
      raw: text,
      status: "corrected",
      normalized: aliasHit,
      candidates: [aliasHit],
      confidence: "high",
      source: "exact",
    };
  }

  // 3. Prefix matches (e.g. "USH" → USH2A). If several, it's ambiguous.
  const prefixHits = KNOWN_GENES.filter((g) => g.startsWith(token) && g !== token);
  if (prefixHits.length === 1) {
    return {
      raw: text,
      status: "corrected",
      normalized: prefixHits[0],
      candidates: prefixHits,
      confidence: "medium",
      source: "fuzzy",
    };
  }
  if (prefixHits.length > 1) {
    return {
      raw: text,
      status: "ambiguous",
      candidates: prefixHits.slice(0, 4),
      confidence: "low",
      source: "fuzzy",
    };
  }

  // 3. Edit-distance fuzzy match. Threshold scales a little with length.
  const maxDist = token.length <= 4 ? 1 : 2;
  const scored = KNOWN_GENES.map((g) => ({ g, d: levenshtein(token, g) }))
    .filter((x) => x.d <= maxDist)
    .sort((a, b) => a.d - b.d);

  if (scored.length === 0) {
    return { raw: text, status: "none", candidates: [], confidence: "low", source: "none" };
  }

  const best = scored[0];
  const tied = scored.filter((x) => x.d === best.d).map((x) => x.g);
  if (tied.length === 1) {
    return {
      raw: text,
      status: "corrected",
      normalized: best.g,
      candidates: tied,
      confidence: best.d <= 1 ? "high" : "medium",
      source: "fuzzy",
    };
  }
  return {
    raw: text,
    status: "ambiguous",
    candidates: tied.slice(0, 4),
    confidence: "low",
    source: "fuzzy",
  };
}

export function isKnownGene(name: string): boolean {
  return KNOWN_GENES.includes(canonGene(name));
}

export { KNOWN_GENES };
