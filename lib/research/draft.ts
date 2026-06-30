// Opus researches a gene with the server-side web_search tool and drafts items.
//
// Unlike a fixed PubMed/ClinicalTrials.gov fetch, Opus runs its OWN web searches
// (Anthropic-hosted tool) across many academic sources — journals, PubMed,
// ClinicalTrials.gov, institutions — so it isn't restricted to two databases.
// For each item it returns the real title + the real source URL from its search
// results (never invented) plus ONE plain-English "why it matters" line.
//
// Governance: this is a DRAFTING step — everything it returns is stored as
// `pending_review` and checked by a human before publish (CLAUDE.md → Content
// governance). Opus is used (not Haiku) because this is low-volume and quality-
// critical, the inverse of the high-volume navigation assistant.
//
// Cost note: the web_search tool is billed per search (plus tokens). max_uses
// bounds searches per gene; the weekly cron keeps total volume low.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8"; // quality-critical research drafting; intentionally NOT Haiku

export type DraftedItem = {
  source: string; // domain label, e.g. "pubmed", "clinicaltrials", "nature.com"
  externalId: string; // normalized URL — used to dedup
  title: string;
  sourceUrl: string;
  publishedLabel?: string;
  whyItMatters: string;
};

const SYSTEM = `You research recent retinitis pigmentosa (RP) findings for ONE gene and return them as data for a nonprofit's research library aimed at non-scientists.

Use the web_search tool to find RECENT, credible research about this gene in the context of RP — peer-reviewed journals and PubMed, ClinicalTrials.gov, and reputable research institutions. Explore multiple sources; do not rely on a single database.

For the 3-6 most relevant and recent items you find, produce:
- title: the real article / study / trial title, copied accurately from the source.
- url: the real source URL from your search results — NEVER invent or guess a URL.
- published_label: the publication or update date/year if available; omit if unknown.
- why_it_matters: ONE clear, everyday-language sentence (~12-25 words) on why an RP patient or family might care. Do NOT invent or imply findings, results, or efficacy beyond what the title/source states. No medical advice. For a clinical trial, say it is studying/testing something — never that it works.

Rules:
- Only include items genuinely about THIS gene in the context of RP or closely related inherited retinal disease.
- Use only real URLs returned by your searches.
- Prefer work from the last few years.

After searching, respond with ONLY a JSON array (no markdown fences, no prose before or after) of exactly this shape:
[{"title": string, "url": string, "published_label": string, "why_it_matters": string}]
If you find nothing credible, return [].`;

function sourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("pubmed") || host.includes("ncbi.nlm.nih.gov")) return "pubmed";
    if (host.includes("clinicaltrials.gov")) return "clinicaltrials";
    return host;
  } catch {
    return "web";
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.toLowerCase();
  }
}

/** Pull the JSON array out of the model's final text (tolerates stray prose). */
function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```json\s*|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* fall through to bracket extraction */
  }
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* give up */
    }
  }
  return [];
}

/**
 * Discover and draft recent research for one gene using Opus + web search.
 * Returns an empty array on any failure (no key, parse error, API error) so the
 * pipeline never throws — the next run simply tries again.
 */
export async function discoverResearch(gene: string): Promise<DraftedItem[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const tools = [
    { type: "web_search_20250305", name: "web_search", max_uses: 5 },
  ] as unknown as Anthropic.Messages.ToolUnion[];

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Gene: ${gene}. Find recent retinitis pigmentosa research for this gene.`,
    },
  ];

  try {
    // Server-side web search runs an internal loop; on pause_turn, re-send to
    // resume. Stream so long searches don't hit request timeouts.
    let finalText = "";
    for (let i = 0; i < 5; i++) {
      const stream = client().messages.stream({
        model: MODEL,
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      });
      const msg = await stream.finalMessage();

      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      finalText = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      break;
    }

    const raw = extractJsonArray(finalText) as Array<{
      title?: string;
      url?: string;
      published_label?: string;
      why_it_matters?: string;
    }>;

    const seen = new Set<string>();
    const items: DraftedItem[] = [];
    for (const r of raw) {
      if (!r?.title || !r?.url) continue;
      const externalId = normalizeUrl(r.url);
      if (seen.has(externalId)) continue;
      seen.add(externalId);
      items.push({
        source: sourceFromUrl(r.url),
        externalId,
        title: r.title.trim(),
        sourceUrl: r.url.trim(),
        publishedLabel: r.published_label?.trim() || undefined,
        whyItMatters: r.why_it_matters?.trim() || "A recent RP-related research item; see the source for details.",
      });
    }
    return items;
  } catch {
    return [];
  }
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}
