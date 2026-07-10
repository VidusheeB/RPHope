import type { Metadata } from "next";
import CTAButton from "@/components/site/CTAButton";

export const metadata: Metadata = {
  title: "Financial Transparency — RP Hope",
  description:
    "RP Hope's annual tax filings and nonprofit financial disclosures, available to download.",
};

// Faithful recreation of the Wix "Annual Tax Filings" page. Each file lives in
// /public/transparency and downloads directly. Ordered newest first.
// NOTE: the 2023 Form 990-EZ (~42 MB scan) is intentionally not committed here
// because of its size — see the Implementation log. Add a compressed copy or an
// external link when available.
const filings: { file: string; label: string; year: string; note?: string }[] = [
  {
    file: "Charitable-Trust-Annual-Filing-2024.pdf",
    label: "Charitable Trust Annual Filing",
    year: "2024",
  },
  {
    file: "CT-TR1-Form-2024.pdf",
    label: "California CT-TR-1 (Annual Treasurer's Report)",
    year: "2024",
  },
  {
    file: "Taxes-N990-2024.pdf",
    label: "IRS Form 990-N (e-Postcard)",
    year: "2024",
  },
  {
    file: "Taxes-2022.pdf",
    label: "IRS Form 990 filing",
    year: "2022",
  },
  {
    file: "Taxes-990ez-2021.pdf",
    label: "IRS Form 990-EZ",
    year: "2021",
  },
];

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function TransparencyPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-widest text-forest">
          Accountability
        </p>
        <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Financial transparency
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink/75">
          RP Hope is a registered 501(c)(3) nonprofit. We publish our annual tax
          filings and charitable disclosures here so donors and families can see
          exactly how the organization is run.
        </p>
        <p className="mt-3 font-mono text-sm text-ink/60">
          EIN: 86-3745576 · 501(c)(3) public charity
        </p>

        <h2 className="mt-12 font-display text-2xl font-medium tracking-tight text-ink">
          Annual tax filings
        </h2>
        <ul className="mt-6 space-y-3">
          {filings.map((f) => (
            <li key={f.file}>
              <a
                href={`/transparency/${f.file}`}
                download
                className="group flex items-center gap-4 rounded-lg border border-ink/10 bg-white p-5 transition hover:border-forest/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">
                  <DownloadIcon />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-lg font-bold text-ink">
                    {f.label}
                  </span>
                  <span className="block text-sm text-ink/60">
                    Tax year {f.year} · PDF
                  </span>
                </span>
                <span className="text-sm font-bold text-forest">
                  Download
                  <span className="sr-only"> {f.label}, tax year {f.year} (PDF)</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-sm text-ink/50">
          Documents open or download as PDFs. Need a filing that isn&rsquo;t
          listed here, or an accessible format?{" "}
          <a
            href="mailto:information@rphope.org"
            className="font-semibold text-forest underline"
          >
            Email us
          </a>{" "}
          and we&rsquo;ll send it over.
        </p>

        <div className="mt-12">
          <CTAButton href="/who-we-are" variant="secondary" arrow>
            About RP Hope
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
