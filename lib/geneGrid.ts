// The Genetic Insights gene grid — the 94 genes from
// RP_Hope_genes_to_include_94.xlsx (compiled 22 August 2026), plus BEST2 and
// ENSA held pending Carin's decision (see lib/geneCatalog.ts for why).
//
// This file is DISPLAY DATA ONLY: gene name, URL slug, and the inheritance
// label as Carin labels it. Evidence tier, aliases, and disease search terms
// live in lib/geneCatalog.ts — that is the authoritative list, and this grid
// is generated to match it.
//
// RECONCILED AGAINST THE 94-GENE SHEET (previous grid held 99 rows):
//   + CFAP418, OFD1, TTC8   added
//   ~ C8ORF37 -> CFAP418    renamed (HGNC); old slug redirects
//   ~ BBS3    -> ARL6       same gene, merged; old slug redirects
//   ~ USH3A   -> CLRN1      same gene, merged; old slug redirects
//   ~ LCA     -> LCA5       "LCA" was a typo for the gene LCA5; old slug redirects
//   - RP17, RP51            locus names, not genes — no gene was ever assigned
// See lib/geneRedirects.mjs for the redirect map. No URL 404s as a result of this.
//
// ⚠️ OFD1 ("X-linked") and TTC8 ("autosomal recessive") are the only two labels
// here NOT carried over from the previous grid — they are new genes, so their
// inheritance labels need Carin's confirmation like every other label on this list.
export type GeneGridItem = { display: string; slug: string; label: string };

export const geneGrid: GeneGridItem[] = [
  { display: "ABCA4", slug: "abca4", label: "autosomal recessive" },
  { display: "ADGRA3", slug: "adgra3", label: "autosomal recessive" },
  { display: "ADIPOR1", slug: "adipor1", label: "autosomal dominant" },
  { display: "AGBL5", slug: "agbl5", label: "autosomal recessive" },
  { display: "AHR", slug: "ahr", label: "autosomal recessive" },
  { display: "ARHGEF18", slug: "arhgef18", label: "autosomal recessive" },
  { display: "ARL2BP", slug: "arl2bp", label: "autosomal recessive" },
  { display: "ARL3", slug: "arl3", label: "autosomal dominant" },
  { display: "ARL6", slug: "arl6", label: "autosomal recessive" },
  { display: "BBS1", slug: "bbs1", label: "autosomal recessive" },
  { display: "BBS2", slug: "bbs2", label: "autosomal recessive" },
  { display: "BEST1", slug: "best1", label: "autosomal dominant" },
  { display: "BEST2", slug: "best2", label: "autosomal recessive" },
  { display: "CA4", slug: "ca4", label: "autosomal dominant" },
  { display: "CERKL", slug: "cerkl", label: "autosomal recessive" },
  { display: "CFAP418", slug: "cfap418", label: "autosomal recessive" },
  { display: "CLCC1", slug: "clcc1", label: "autosomal recessive" },
  { display: "CLRN1", slug: "clrn1", label: "autosomal recessive" },
  { display: "CNGA1", slug: "cnga1", label: "autosomal recessive" },
  { display: "CNGB1", slug: "cngb1", label: "autosomal recessive" },
  { display: "CRB1", slug: "crb1", label: "autosomal recessive" },
  { display: "CRX", slug: "crx", label: "autosomal dominant" },
  { display: "CWC27", slug: "cwc27", label: "autosomal recessive" },
  { display: "CYP4V2", slug: "cyp4v2", label: "autosomal recessive" },
  { display: "DHDDS", slug: "dhdds", label: "autosomal recessive" },
  { display: "DHX38", slug: "dhx38", label: "autosomal recessive" },
  { display: "EMC1", slug: "emc1", label: "autosomal recessive" },
  { display: "ENSA", slug: "ensa", label: "autosomal recessive" },
  { display: "EYS", slug: "eys", label: "autosomal recessive" },
  { display: "FAM161A", slug: "fam161a", label: "autosomal recessive" },
  { display: "FSCN2", slug: "fscn2", label: "autosomal dominant" },
  { display: "GUCA1B", slug: "guca1b", label: "autosomal dominant" },
  { display: "HGSNAT", slug: "hgsnat", label: "autosomal recessive" },
  { display: "HK1", slug: "hk1", label: "autosomal dominant" },
  { display: "IDH3B", slug: "idh3b", label: "autosomal recessive" },
  { display: "IFT140", slug: "ift140", label: "autosomal recessive" },
  { display: "IFT172", slug: "ift172", label: "autosomal recessive" },
  { display: "IMPDH1", slug: "impdh1", label: "autosomal dominant" },
  { display: "IMPG1", slug: "impg1", label: "autosomal dominant" },
  { display: "IMPG2", slug: "impg2", label: "autosomal recessive" },
  { display: "INPP5E", slug: "inpp5e", label: "autosomal recessive" },
  { display: "KIAA1549", slug: "kiaa1549", label: "autosomal recessive" },
  { display: "KIF3B", slug: "kif3b", label: "autosomal dominant" },
  { display: "KIZ", slug: "kiz", label: "autosomal recessive" },
  { display: "KLHL7", slug: "klhl7", label: "autosomal dominant" },
  { display: "LCA5", slug: "lca5", label: "autosomal recessive" },
  { display: "LRAT", slug: "lrat", label: "autosomal recessive" },
  { display: "MAK", slug: "mak", label: "autosomal recessive" },
  { display: "MERTK", slug: "mertk", label: "autosomal recessive" },
  { display: "MVK", slug: "mvk", label: "autosomal recessive" },
  { display: "NEK2", slug: "nek2", label: "autosomal recessive" },
  { display: "NEUROD1", slug: "neurod1", label: "autosomal recessive" },
  { display: "NR2E3", slug: "nr2e3", label: "autosomal dominant / recessive" },
  { display: "NRL", slug: "nrl", label: "autosomal dominant" },
  { display: "OFD1", slug: "ofd1", label: "X-linked" },
  { display: "PCARE", slug: "pcare", label: "autosomal recessive" },
  { display: "PDE6A", slug: "pde6a", label: "autosomal recessive" },
  { display: "PDE6B", slug: "pde6b", label: "autosomal recessive" },
  { display: "PDE6G", slug: "pde6g", label: "autosomal recessive" },
  { display: "POMGNT1", slug: "pomgnt1", label: "autosomal recessive" },
  { display: "PRCD", slug: "prcd", label: "autosomal recessive" },
  { display: "PROM1", slug: "prom1", label: "autosomal recessive" },
  { display: "PROS1", slug: "pros1", label: "autosomal recessive" },
  { display: "PRPF3", slug: "prpf3", label: "autosomal dominant" },
  { display: "PRPF31", slug: "prpf31", label: "autosomal dominant" },
  { display: "PRPF4", slug: "prpf4", label: "autosomal dominant" },
  { display: "PRPF6", slug: "prpf6", label: "autosomal dominant" },
  { display: "PRPF8", slug: "prpf8", label: "autosomal dominant" },
  { display: "PRPH2", slug: "prph2", label: "autosomal dominant" },
  { display: "RBP3", slug: "rbp3", label: "autosomal recessive" },
  { display: "RDH12", slug: "rdh12", label: "autosomal dominant" },
  { display: "REEP6", slug: "reep6", label: "autosomal recessive" },
  { display: "RGR", slug: "rgr", label: "autosomal recessive" },
  { display: "RHO", slug: "rho", label: "autosomal dominant" },
  { display: "RLBP1", slug: "rlbp1", label: "autosomal recessive" },
  { display: "ROM1", slug: "rom1", label: "autosomal dominant" },
  { display: "RP1", slug: "rp1", label: "autosomal dominant" },
  { display: "RP1L1", slug: "rp1l1", label: "autosomal recessive" },
  { display: "RP2", slug: "rp2", label: "x-linked" },
  { display: "RP9", slug: "rp9", label: "autosomal dominant" },
  { display: "RPE65", slug: "rpe65", label: "autosomal recessive" },
  { display: "RPGR", slug: "rpgr", label: "x-linked" },
  { display: "SAG", slug: "sag", label: "autosomal recessive" },
  { display: "SAMD11", slug: "samd11", label: "autosomal recessive" },
  { display: "SEMA4A", slug: "sema4a", label: "autosomal dominant" },
  { display: "SLC7A14", slug: "slc7a14", label: "autosomal recessive" },
  { display: "SNRNP200", slug: "snrnp200", label: "autosomal dominant" },
  { display: "SPATA7", slug: "spata7", label: "autosomal recessive" },
  { display: "SPP2", slug: "spp2", label: "autosomal dominant" },
  { display: "TOPORS", slug: "topors", label: "autosomal dominant" },
  { display: "TRNT1", slug: "trnt1", label: "autosomal recessive" },
  { display: "TTC8", slug: "ttc8", label: "autosomal recessive" },
  { display: "TULP1", slug: "tulp1", label: "autosomal recessive" },
  { display: "USH2A", slug: "ush2a", label: "autosomal recessive" },
  { display: "ZNF408", slug: "znf408", label: "autosomal recessive" },
  { display: "ZNF513", slug: "znf513", label: "autosomal recessive" },
];
