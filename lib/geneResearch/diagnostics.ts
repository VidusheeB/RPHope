// Human-readable formatter for the retrieve-only diagnostic (retrieval spec
// requirement: "Add a retrieve-only diagnostic that reports for every
// candidate paper: which query found it; whether it came from Gene-to-PubMed
// ELink; which gene term or alias matched; score and category; whether it was
// selected or excluded; reason for exclusion.").
//
// Pure formatting — no network, no Anthropic usage. The CLI writes the result
// to gene-review-scratch/ (gitignored) so a reviewer can audit exactly what
// retrieval found and why each candidate was kept or dropped, WITHOUT any
// Opus call.

import type { RetrievalDiagnostics } from "./pipeline";
import type { FoundBy, LiteratureRecord } from "./types";

function foundByLabel(foundBy: FoundBy[]): string {
  return foundBy.length ? foundBy.join(", ") : "(none)";
}

function candidateLine(index: number, r: LiteratureRecord): string {
  const status = r.selected ? "SELECTED" : "excluded";
  const elink = r.foundBy.includes("pubmed-elink") ? "yes" : "no";
  const lines = [
    `${index}. [${status}] ${r.title}`,
    `     sourceId:     ${r.sourceId}${r.pmid ? `  (PMID ${r.pmid})` : ""}${r.doi ? `  (DOI ${r.doi})` : ""}`,
    `     year/journal: ${r.year ?? "n/a"}${r.journal ? ` — ${r.journal}` : ""}`,
    `     found by:     ${foundByLabel(r.foundBy)}`,
    `     via ELink:    ${elink}`,
    `     matched term: ${r.matchedTerm ?? "(ELink association — no text match)"}`,
    `     score:        ${r.score}`,
    `     category:     ${r.evidenceCategory}`,
  ];
  if (!r.selected && r.exclusionReason) {
    lines.push(`     excluded:     ${r.exclusionReason}`);
  }
  return lines.join("\n");
}

export function formatRetrievalDiagnostics(diag: RetrievalDiagnostics): string {
  const sorted = [...diag.candidates].sort((a, b) => b.score - a.score);

  const header = [
    `Retrieval diagnostics — ${diag.geneSymbol} (NCBI Gene ID ${diag.geneId})`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SEARCH TERMS",
    `  used (symbol + full name + safe aliases): ${diag.searchTerms.join(", ")}`,
    `  safe aliases:     ${diag.safeAliases.length ? diag.safeAliases.join(", ") : "(none)"}`,
    `  excluded aliases: ${diag.excludedAliases.length ? diag.excludedAliases.join(", ") : "(none)"}`,
    "",
    "RETRIEVAL COUNTS (raw, before cross-source dedup)",
    `  PubMed broad+focused: ${diag.rawCounts.pubmed}`,
    `  PubMed via ELink:     ${diag.rawCounts.pubmedElink} (from ${diag.elinkPmidCount} linked PMID(s))`,
    `  Europe PMC:           ${diag.rawCounts.europepmc}`,
    "",
    `  deduplicated candidates: ${diag.candidateCount}`,
    `  selected for Opus:       ${diag.selectedCount}`,
    `  web-fallback records:    ${diag.webFallbackCount}`,
    "",
    "CANDIDATES (highest score first)",
    "",
  ].join("\n");

  const body = sorted.map((r, i) => candidateLine(i + 1, r)).join("\n\n");
  return `${header}${body}\n`;
}
