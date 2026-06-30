// Canonicalize a gene symbol for comparison: spell out greek letters, strip
// spaces/punctuation, uppercase. "PDE6 beta" → "PDE6B", "RP G R" → "RPGR".
export function canonGene(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/\balpha\b/g, "a")
    .replace(/\bbeta\b/g, "b")
    .replace(/\bgamma\b/g, "g")
    .replace(/\bdelta\b/g, "d")
    .replace(/[^a-z0-9]/g, "")
    .toUpperCase();
}
