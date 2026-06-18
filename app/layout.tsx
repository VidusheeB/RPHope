import type { Metadata } from "next";
import { Fraunces, Mulish } from "next/font/google";
import "./globals.css";
import SkipLink from "@/components/SkipLink";
import Header from "@/components/site/Header";
import Footer from "@/components/site/Footer";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Mulish({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RP Hope — Understand RP research. Find your path forward.",
  description:
    "RP Hope helps patients, families, caregivers, researchers, and supporters navigate retinitis pigmentosa research, genetic insights, clinical trials, events, and community resources.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-cream font-sans text-ink">
        <SkipLink />
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
