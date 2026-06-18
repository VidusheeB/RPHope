import Link from "next/link";

type Variant = "primary" | "secondary" | "white" | "outline-light" | "dark";

const styles: Record<Variant, string> = {
  primary: "bg-forest text-white hover:bg-forest-dark shadow-sm",
  secondary:
    "bg-transparent text-ink border border-ink/30 hover:border-ink hover:bg-ink/5",
  white: "bg-white text-forest hover:bg-cream shadow-sm",
  "outline-light":
    "bg-transparent text-white border border-white/60 hover:bg-white/10",
  dark: "bg-ink text-white hover:bg-black",
};

export default function CTAButton({
  href,
  children,
  variant = "primary",
  className = "",
  arrow = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold transition ${styles[variant]} ${className}`}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </Link>
  );
}
