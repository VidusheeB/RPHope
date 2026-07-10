// Browser-only readers that extract MEANINGFUL page content for the voice
// assistant — the visible main-content text, section headings, and primary
// actions — while excluding navigation, footer, the assistant's own UI, hidden
// text, scripts, and styling. Used by the get_current_page_context,
// list_current_page_sections, read_page_section, and scroll_to_section tools.

export type PageContext = {
  url: string;
  route: string;
  pageTitle: string;
  mainHeading: string;
  mainText: string;
  focusedElement: string | null;
  primaryActions: string[];
  sectionHeadings: string[];
};

export type PageSection = {
  id: string;
  level: number;
  heading: string;
};

const EXCLUDE_SELECTOR =
  "nav, header, footer, script, style, noscript, [aria-hidden='true'], [data-voice-assistant], .voice-assistant";

function mainEl(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    document.getElementById("main") ||
    document.querySelector("main") ||
    document.body
  );
}

function isExcluded(el: Element): boolean {
  return Boolean(el.closest(EXCLUDE_SELECTOR));
}

function slugify(s: string, i: number): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base ? `sec-${base}` : `sec-${i}`;
}

function visibleText(root: HTMLElement): string {
  // Clone, strip excluded regions, then read textContent. Cloning avoids
  // mutating the live DOM.
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(EXCLUDE_SELECTOR).forEach((n) => n.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

export function getCurrentPageContext(): PageContext {
  const main = mainEl();
  const route = typeof location !== "undefined" ? location.pathname : "";
  const url = typeof location !== "undefined" ? location.href : "";
  const h1 = main?.querySelector("h1");
  const active =
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null;

  const headings = main
    ? Array.from(main.querySelectorAll("h1, h2, h3"))
        .filter((h) => !isExcluded(h))
        .map((h) => (h.textContent || "").trim())
        .filter(Boolean)
    : [];

  const actions = main
    ? Array.from(main.querySelectorAll("a[href], button"))
        .filter((el) => !isExcluded(el))
        .map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 1 && t.length < 60)
        .slice(0, 12)
    : [];

  return {
    url,
    route,
    pageTitle: typeof document !== "undefined" ? document.title : "",
    mainHeading: (h1?.textContent || "").trim(),
    mainText: main ? visibleText(main).slice(0, 6000) : "",
    focusedElement: active
      ? (active.getAttribute("aria-label") ||
          active.textContent?.trim().slice(0, 60) ||
          active.tagName.toLowerCase())
      : null,
    primaryActions: Array.from(new Set(actions)),
    sectionHeadings: headings,
  };
}

export function listCurrentPageSections(): PageSection[] {
  const main = mainEl();
  if (!main) return [];
  const out: PageSection[] = [];
  const used = new Set<string>();
  Array.from(main.querySelectorAll("h1, h2, h3"))
    .filter((h) => !isExcluded(h))
    .forEach((h, i) => {
      const heading = (h.textContent || "").trim();
      if (!heading) return;
      let id = h.id;
      if (!id) {
        id = slugify(heading, i);
        let n = id;
        let k = 1;
        while (used.has(n)) n = `${id}-${k++}`;
        id = n;
        h.id = id; // stabilize so scroll/focus works later
      }
      used.add(id);
      out.push({ id, level: Number(h.tagName[1]), heading });
    });
  return out;
}

// Track the last section read so "continue" advances through its chunks.
let lastRead: { id: string; chunks: string[]; index: number } | null = null;

function chunk(text: string, size = 600): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > size) {
      chunks.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export type ReadResult = {
  found: boolean;
  heading?: string;
  text?: string;
  hasMore?: boolean;
  message?: string;
};

export function readPageSection(opts: {
  sectionId?: string;
  heading?: string;
  mode: "verbatim" | "summary";
  continue?: boolean;
}): ReadResult {
  const sections = listCurrentPageSections();
  if (sections.length === 0) return { found: false, message: "No readable sections on this page." };

  // "continue" advances the previously-read section.
  if (opts.continue && lastRead && lastRead.index < lastRead.chunks.length) {
    const text = lastRead.chunks[lastRead.index++];
    return {
      found: true,
      text,
      hasMore: lastRead.index < lastRead.chunks.length,
    };
  }

  let target = sections.find((s) => s.id === opts.sectionId);
  if (!target && opts.heading) {
    const hq = opts.heading.toLowerCase();
    target =
      sections.find((s) => s.heading.toLowerCase() === hq) ||
      sections.find((s) => s.heading.toLowerCase().includes(hq));
  }
  if (!target) target = sections[0];

  const headingEl = document.getElementById(target.id);
  if (!headingEl) return { found: false, message: "Couldn't locate that section." };

  // Collect content between this heading and the next same-or-higher heading.
  const parts: string[] = [];
  let node: Element | null = headingEl.nextElementSibling;
  const stopLevel = target.level;
  while (node) {
    if (/^H[1-3]$/.test(node.tagName)) {
      const lvl = Number(node.tagName[1]);
      if (lvl <= stopLevel) break;
    }
    if (!isExcluded(node)) {
      const t = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
    }
    node = node.nextElementSibling;
  }

  const full = parts.join(" ").trim() || target.heading;
  const chunks = chunk(full);
  lastRead = { id: target.id, chunks, index: 1 };
  return {
    found: true,
    heading: target.heading,
    text: chunks[0],
    hasMore: chunks.length > 1,
  };
}

export function resetReadCursor(): void {
  lastRead = null;
}

export function scrollToSection(heading: string): { found: boolean; heading?: string } {
  const sections = listCurrentPageSections();
  const hq = heading.toLowerCase();
  const target =
    sections.find((s) => s.heading.toLowerCase() === hq) ||
    sections.find((s) => s.heading.toLowerCase().includes(hq));
  if (!target) return { found: false };
  const el = document.getElementById(target.id);
  if (!el) return { found: false };
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.setAttribute("tabindex", "-1");
  (el as HTMLElement).focus({ preventScroll: true });
  return { found: true, heading: target.heading };
}
