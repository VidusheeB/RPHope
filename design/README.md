# Design directions — homepage polish (in progress)

`design-directions.html` — open it in a browser. A one-page study comparing four
treatments of the homepage hero + "Choose your path" cards, aimed at making the
site read less "AI-generated" and more intentionally designed. Same palette,
copy, and fonts throughout — only the *treatment* changes.

Samples:
- **00 — Current** (today's site, with the AI "tells" labeled: emoji icons,
  frosted middot pill, bold centered everything, big soft radius + drop shadows)
- **★ Blend** — 01's warmth + 02's sharpness. **This is the working direction**
  (owner picked "something between 1 and 2"): real line icons, gold eyebrow,
  left-aligned, italic serif accent, warm forest+cream cards, but crisp 5px
  corners, small-caps labels, hairline rules, flat (no shadow).
- **01 — Editorial Refined** (reference — the warm end)
- **02 — Institutional / Sharp** (reference — the sharp end)
- **03 — Warm Nonprofit / Human** (reference — the donor-facing end)

Note: fonts in the HTML are system stand-ins (real Fraunces + Mulish only load in
the app), so judge weight/spacing/corners/icons/layout, not exact letterforms.
The dark background is just a presentation surface; the real site stays light.

**Status:** owner is thinking on it. Not yet applied to real components. When
approved, implement the Blend in `components/site/Hero.tsx`,
`components/site/ChoosePath.tsx`, and `components/site/CTAButton.tsx`, then review
on localhost. Optional dials discussed: sharper (corners → 3px, roman serif) or
softer (corners → 8px).
