// Small uppercase section label with a hairline underline — the recurring
// "editorial" device across the site (replaces the old emoji pills).
//
// Accessibility: on light (cream) sections the *text* is forest for contrast and
// the gold (#cf9f4e) shows only as the underline rule (decorative, so no
// contrast requirement).
//
// On dark grounds the text is WHITE, not gold. The only dark-tone use is the
// homepage hero, which now sits on rotating photography rather than a flat teal
// panel — gold at this size (12px, bold, wide tracking) had little contrast
// headroom left over a photo, and small uppercase text is where it runs out
// first. White clears it on every photo in the set.
export default function Eyebrow({
  children,
  tone = "light",
  className = "",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  const styles =
    tone === "dark" ? "text-white border-white/40" : "text-forest border-gold";
  return (
    <span
      className={`inline-block border-b pb-2 text-xs font-bold uppercase tracking-[0.2em] ${styles} ${className}`}
    >
      {children}
    </span>
  );
}
