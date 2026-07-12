import { describe, it, expect } from "vitest";
import {
  parseEfetchXml,
  buildTermGroup,
  buildBroadQuery,
  buildFocusedQuery,
  RETINAL_VOCABULARY,
} from "@/lib/geneResearch/pubmed";

const SAMPLE_XML = `<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">12345678</PMID>
      <Article>
        <Journal><Title>Journal of Retinal Research</Title></Journal>
        <ArticleTitle>RPGR variants &amp; X-linked retinitis pigmentosa</ArticleTitle>
        <Abstract>
          <AbstractText Label="BACKGROUND">RPGR is a major cause of XLRP.</AbstractText>
          <AbstractText Label="RESULTS">We report novel variants.</AbstractText>
        </Abstract>
        <ArticleDate><Year>2022</Year></ArticleDate>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID Version="1">99999999</PMID>
      <Article>
        <Journal><Title>Vision Science</Title></Journal>
        <ArticleTitle>Unrelated <i>italic</i> title</ArticleTitle>
        <Abstract>
          <AbstractText>Plain abstract text.</AbstractText>
        </Abstract>
      </Article>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>`;

describe("parseEfetchXml", () => {
  it("extracts pmid, title, journal, and year for each article", () => {
    const records = parseEfetchXml(SAMPLE_XML);
    expect(records).toHaveLength(2);
    expect(records[0].pmid).toBe("12345678");
    expect(records[0].journal).toBe("Journal of Retinal Research");
    expect(records[0].year).toBe(2022);
  });

  it("decodes HTML entities in the title", () => {
    const records = parseEfetchXml(SAMPLE_XML);
    expect(records[0].title).toBe("RPGR variants & X-linked retinitis pigmentosa");
  });

  it("joins multiple labeled AbstractText segments", () => {
    const records = parseEfetchXml(SAMPLE_XML);
    expect(records[0].abstract).toContain("major cause of XLRP");
    expect(records[0].abstract).toContain("novel variants");
  });

  it("strips inner tags from titles", () => {
    const records = parseEfetchXml(SAMPLE_XML);
    expect(records[1].title).toBe("Unrelated italic title");
  });

  it("builds a correct PubMed URL", () => {
    const records = parseEfetchXml(SAMPLE_XML);
    expect(records[0].url).toBe("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("returns an empty array for empty/garbage input", () => {
    expect(parseEfetchXml("")).toEqual([]);
    expect(parseEfetchXml("<not>pubmed</not>")).toEqual([]);
  });

  it("skips an article with no PMID", () => {
    const xml = `<PubmedArticle><MedlineCitation><Article><ArticleTitle>No PMID</ArticleTitle></Article></MedlineCitation></PubmedArticle>`;
    expect(parseEfetchXml(xml)).toEqual([]);
  });
});

describe("PubMed query builders (high-recall design)", () => {
  it("buildTermGroup ORs terms in [tiab], quoting multi-word terms", () => {
    expect(buildTermGroup(["RPGR", "retinitis pigmentosa GTPase regulator"])).toBe(
      '(RPGR[tiab] OR "retinitis pigmentosa GTPase regulator"[tiab])'
    );
  });

  it("buildBroadQuery does NOT require a retinal keyword (gene terms only)", () => {
    const q = buildBroadQuery(["RPGR", "RP3"]);
    expect(q).toBe("(RPGR[tiab] OR RP3[tiab])");
    expect(q.toLowerCase()).not.toContain("retina");
  });

  it("buildFocusedQuery ANDs the gene terms with the retinal vocabulary", () => {
    const q = buildFocusedQuery(["RPGR"]);
    expect(q.startsWith("(RPGR[tiab]) AND (")).toBe(true);
    // a sampling of the retinal vocabulary must be present in the focused query
    expect(q).toContain("retina[tiab]");
    expect(q).toContain('"retinitis pigmentosa"[tiab]');
    expect(q).toContain('"Leber congenital amaurosis"[tiab]');
  });

  it("the retinal vocabulary includes non-RP disease names (e.g. LCA) so a non-RP-labeled gene isn't missed", () => {
    expect(RETINAL_VOCABULARY).toContain("Leber congenital amaurosis");
    expect(RETINAL_VOCABULARY).toContain("ciliopathy");
  });
});
