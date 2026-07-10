// Small uppercase section label with a hairline underline — the recurring
// "editorial" device across the site (replaces the old emoji pills).
//
// Accessibility: the gold (#cf9f4e) is only legible on dark grounds. On light
// (cream) sections the *text* is forest for contrast and the gold shows only as
// the underline rule (decorative, so no contrast requirement). On dark grounds
// the text itself is gold.
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
    tone === "dark" ? "text-gold border-white/25" : "text-forest border-gold";
  return (
    <span
      className={`inline-block border-b pb-2 text-xs font-bold uppercase tracking-[0.2em] ${styles} ${className}`}
    >
      {children}
    </span>
  );
}
