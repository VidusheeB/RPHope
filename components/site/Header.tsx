import Link from "next/link";
import Image from "next/image";
import AboutMenu from "./AboutMenu";

// "About" is rendered separately as a dropdown (Who We Are / Contact Us).
const nav = [
  { href: "/genetic-insights", label: "Genetic Insights" },
  { href: "/my-pathway", label: "My RP Pathway" },
  { href: "/clinical-trials", label: "Clinical Trials" },
  { href: "/events", label: "Events" },
  { href: "/stories", label: "Stories" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/10 bg-cream-header/95 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"
      >
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/home/logo.png"
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-full"
          />
          <span className="font-display text-2xl font-medium tracking-tight text-forest">
            RP Hope
          </span>
        </Link>

        <ul className="hidden items-center gap-7 text-[0.9rem] font-semibold text-ink/75 md:flex">
          <li>
            <AboutMenu />
          </li>
          {nav.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                className="border-b-2 border-transparent pb-0.5 transition-colors hover:border-gold hover:text-forest"
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/donate"
          className="inline-flex items-center gap-2 rounded-md bg-forest px-5 py-2.5 font-semibold text-white hover:bg-forest-dark"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.8 8.6a5 5 0 0 0-8.8-3.2A5 5 0 0 0 3.2 8.6c0 4.2 5.6 8 8.8 10.4 3.2-2.4 8.8-6.2 8.8-10.4Z" />
          </svg>
          Donate
        </Link>
      </nav>
    </header>
  );
}
