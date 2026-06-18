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
