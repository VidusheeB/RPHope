import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // New brand (Figma direction) — warm research-hub palette
        forest: {
          DEFAULT: "#234b43", // deep teal/forest — primary
          dark: "#1a3a34",
          deep: "#16322d",
        },
        gold: {
          DEFAULT: "#cf9f4e", // warm gold accent (icons, links)
          soft: "#ecdca6", // pale gold for hero italic phrase
        },
        cream: {
          DEFAULT: "#f4f1e9", // page background
          header: "#f6f3ec", // header / lighter sections
          card: "#eae5d8", // tan card
        },
        ink: "#1e1c19", // near-black headings / footer
        // soft tinted cards
        mint: "#e3eee4",
        butter: "#f6efd1",
        lilac: "#e9e7f4",
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
