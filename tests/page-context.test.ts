import { describe, it, expect, beforeEach } from "vitest";
import {
  getCurrentPageContext,
  listCurrentPageSections,
  readPageSection,
} from "@/lib/voice/pageContext";

beforeEach(() => {
  document.title = "RPGR — Genetic Insights";
  document.body.innerHTML = `
    <header><nav>Home Genes Donate</nav></header>
    <main id="main">
      <h1>RPGR</h1>
      <p>RPGR is an X-linked gene that affects the retina and causes vision loss.</p>
      <h2>Brief Description</h2>
      <p>It is one of the most common causes of X-linked retinitis pigmentosa. Gene therapy trials are underway.</p>
      <a href="/clinical-trials">See clinical trials</a>
    </main>
    <footer>Privacy Terms Copyright 2026</footer>
  `;
});

describe("current-page content extraction", () => {
  it("reads the main heading and text, excluding nav and footer", () => {
    const ctx = getCurrentPageContext();
    expect(ctx.mainHeading).toBe("RPGR");
    expect(ctx.mainText).toContain("X-linked gene");
    expect(ctx.mainText).not.toContain("Privacy Terms"); // footer excluded
    expect(ctx.mainText).not.toContain("Home Genes Donate"); // nav excluded
  });

  it("captures section headings and primary actions", () => {
    const ctx = getCurrentPageContext();
    expect(ctx.sectionHeadings).toContain("RPGR");
    expect(ctx.sectionHeadings).toContain("Brief Description");
    expect(ctx.primaryActions).toContain("See clinical trials");
  });

  it("lists sections with stable ids in reading order", () => {
    const sections = listCurrentPageSections();
    expect(sections.map((s) => s.heading)).toEqual(["RPGR", "Brief Description"]);
    expect(sections[0].id).toBeTruthy();
    // ids are stamped back onto the DOM for later scroll/read.
    expect(document.getElementById(sections[1].id)?.textContent).toBe("Brief Description");
  });

  it("reads a section's content by heading", () => {
    const res = readPageSection({ heading: "Brief Description", mode: "verbatim" });
    expect(res.found).toBe(true);
    expect(res.text).toContain("X-linked retinitis pigmentosa");
  });
});
