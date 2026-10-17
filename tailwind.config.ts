import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand palette. Values are CSS variables (RGB channels) defined in
        // app/globals.css, because the public site and the Team Portal use
        // DIFFERENT colours under the same token names:
        //   - public site (:root / .theme-public) — owner decision 2026-10-17:
        //     green became blue #0b3445, gold became yellow #fad40d, and purple
        //     became green (so `forest` is blue and `lilac` is green there).
        //   - Team Portal (.theme-portal, set in SiteChrome) — the original
        //     green/gold/lilac, kept on purpose: its red/yellow/green colours
        //     carry status meaning for reviewers.
        // Change colours in globals.css, not here.
        forest: {
          DEFAULT: "rgb(var(--c-forest) / <alpha-value>)",
          dark: "rgb(var(--c-forest-dark) / <alpha-value>)",
          deep: "rgb(var(--c-forest-deep) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "rgb(var(--c-gold) / <alpha-value>)",
          soft: "rgb(var(--c-gold-soft) / <alpha-value>)",
          // small accent label text on WHITE cards — yellow can't be read on
          // white, so the public site uses blue here; the portal keeps gold.
          label: "rgb(var(--c-gold-label) / <alpha-value>)",
        },
        cream: {
          DEFAULT: "#f4f1e9", // page background
          header: "#f6f3ec", // header / lighter sections
          card: "#eae5d8", // tan card
        },
        ink: "#1e1c19", // near-black headings / footer
        // soft tinted cards
        mint: "rgb(var(--c-mint) / <alpha-value>)",
        butter: "#f6efd1",
        lilac: {
          DEFAULT: "rgb(var(--c-lilac) / <alpha-value>)",
          ink: "rgb(var(--c-lilac-ink) / <alpha-value>)", // text on a lilac tag
        },
        // ---- legacy tokens (keep so the older replica pages still render) ----
        teal: { DEFAULT: "#234b43", dark: "#16322d" },
        maroon: { DEFAULT: "#8a1c1c", dark: "#6f1616" },
        // The two "act now" controls — the header Donate button and the voice
        // launcher — in the owner-specified maroon. Kept separate from the
        // legacy `maroon` above, which exists only so the archived Wix replica
        // in StaticDemoOriginal/ still renders and must not shift.
        // White on #661414 measures 12.5:1, comfortably AAA.
        "maroon-brand": { DEFAULT: "#661414", dark: "#4d0f0f" },
        link: "#1f5e8a",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
