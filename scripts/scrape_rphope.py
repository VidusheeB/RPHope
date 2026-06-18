#!/usr/bin/env python3
"""
Scrape all content from the live RP Hope Wix site (https://www.rphope.org)
for use in the Next.js rebuild.

Reads the Wix sitemap index, fetches every page, extracts the main content
with trafilatura, and writes organized markdown + a manifest.json into
reference/content/.

Run:  python3 scripts/scrape_rphope.py
"""
import json
import re
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from xml.etree import ElementTree as ET

import trafilatura

BASE = "https://www.rphope.org"
SITEMAP_INDEX = f"{BASE}/sitemap.xml"
OUT = Path(__file__).resolve().parent.parent / "reference" / "content"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
DELAY = 0.7  # politeness between requests (seconds)

NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def encode_url(url):
    # percent-encode any non-ASCII chars in the path (e.g. accented slugs)
    from urllib.parse import urlsplit, urlunsplit, quote
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, quote(p.path), quote(p.query, safe="=&"), p.fragment))


def fetch(url, retries=3):
    url = encode_url(url)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            if attempt == retries - 1:
                print(f"    ! failed {url}: {e}", file=sys.stderr)
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def sitemap_locs(xml_text):
    if not xml_text:
        return []
    root = ET.fromstring(xml_text)
    return [el.text.strip() for el in root.findall(".//sm:loc", NS)]


def meta(html, prop):
    m = re.search(
        rf'<meta property="{re.escape(prop)}" content="(.*?)"', html, re.DOTALL
    )
    if not m:
        m = re.search(
            rf'<meta name="{re.escape(prop)}" content="(.*?)"', html, re.DOTALL
        )
    if not m:
        return ""
    # unescape common HTML entities
    val = m.group(1)
    for a, b in [("&amp;", "&"), ("&quot;", '"'), ("&#39;", "'"),
                 ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " ")]:
        val = val.replace(a, b)
    return val.strip()


def slug_from_url(url):
    s = url.rstrip("/").split("/")[-1]
    return s or "index"


def categorize(url):
    path = url[len(BASE):].strip("/")
    if path == "" or url.rstrip("/") == BASE:
        return "pages", "home"
    if path.startswith("genetic-insights-"):
        return "genes", path.replace("genetic-insights-", "")
    if path == "genetic-insights":
        return "pages", "genetic-insights-landing"
    if path.startswith("event-details/"):
        return "events", path.split("/", 1)[1]
    if path.startswith("post/"):
        return "posts", path.split("/", 1)[1]
    if path.startswith("product-page/"):
        return "products", path.split("/", 1)[1]
    return "pages", path.replace("/", "_")


def write_md(category, slug, url, title, description, body):
    d = OUT / category
    d.mkdir(parents=True, exist_ok=True)
    fp = d / f"{slug}.md"
    parts = [f"# {title}".rstrip(), ""]
    parts.append(f"> Source: {url}")
    if description:
        parts.append(f">\n> Meta description: {description}")
    parts.append("")
    parts.append("---")
    parts.append("")
    parts.append(body.strip() if body else "_(no main-content text extracted)_")
    parts.append("")
    fp.write_text("\n".join(parts), encoding="utf-8")
    return fp


def main():
    print(f"Reading sitemap index: {SITEMAP_INDEX}")
    index = sitemap_locs(fetch(SITEMAP_INDEX))
    all_urls = []
    for sm in index:
        print(f"  sub-sitemap: {sm}")
        all_urls.extend(sitemap_locs(fetch(sm)))
        time.sleep(0.2)
    # de-dupe, keep order
    seen = set()
    urls = [u for u in all_urls if not (u in seen or seen.add(u))]
    print(f"Total URLs: {len(urls)}\n")

    manifest = []
    counts = {}
    for i, url in enumerate(urls, 1):
        category, slug = categorize(url)
        existing = OUT / category / f"{slug}.md"
        # resume: skip files already saved with real extracted content
        if existing.exists() and "_(no main-content text extracted)_" not in existing.read_text(encoding="utf-8"):
            print(f"[{i:>3}/{len(urls)}] {category:8} {slug[:50]:50}  (skip, exists)")
            manifest.append({"url": url, "category": category, "slug": slug,
                             "ok": True, "skipped": True,
                             "file": str(existing.relative_to(OUT.parent.parent))})
            counts[category] = counts.get(category, 0) + 1
            continue
        html = fetch(url)
        if not html:
            manifest.append({"url": url, "category": category, "slug": slug,
                             "ok": False})
            continue
        title = meta(html, "og:title") or slug
        description = meta(html, "og:description")
        body = trafilatura.extract(
            html, include_links=True, include_tables=True,
            favor_recall=True, url=url,
        ) or ""
        fp = write_md(category, slug, url, title, description, body)
        counts[category] = counts.get(category, 0) + 1
        manifest.append({
            "url": url, "category": category, "slug": slug, "ok": True,
            "title": title, "description": description,
            "body_chars": len(body),
            "file": str(fp.relative_to(OUT.parent.parent)),
        })
        print(f"[{i:>3}/{len(urls)}] {category:8} {slug[:50]:50} "
              f"{len(body):>6} chars")
        time.sleep(DELAY)

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDone. {sum(counts.values())} pages saved.")
    for c, n in sorted(counts.items()):
        print(f"  {c:10} {n}")
    print(f"Manifest: {OUT / 'manifest.json'}")


if __name__ == "__main__":
    main()
