import { describe, it, expect } from "vitest";
import { parseEfetchXml } from "@/lib/geneResearch/pubmed";

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
