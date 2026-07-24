import type { ReactNode } from "react";
import CTAButton from "@/components/site/CTAButton";
import { renderWithGlossary } from "@/lib/glossaryLinkify";

// Shared rendering for long-form educational explainer pages (Understanding
// RP, Future Therapies). Lets page content be authored as data — paragraphs,
// bullet lists, and the occasional bolded term or inline link — instead of
// hand-written JSX repeated for every section.

export type Block =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "node"; content: ReactNode };

export type ExplainerSection = {
  heading: string;
  blocks: Block[];
  cta?: { href: string; label: string };
};

// Renders **bold** markers as <strong>.
export function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{renderWithGlossary(part)}</span>;
  });
}

function renderBlock(block: Block, key: number) {
  switch (block.type) {
    case "p":
      return (
        <p key={key} className="text-lg leading-relaxed text-ink/80">
          {renderInline(block.text)}
        </p>
      );
    case "list":
      return (
        <ul
          key={key}
          className="list-disc space-y-2 pl-6 text-lg leading-relaxed text-ink/80"
        >
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "node":
      return (
        <div key={key} className="text-lg leading-relaxed text-ink/80">
          {block.content}
        </div>
      );
  }
}

export function ExplainerSections({
  sections,
}: {
  sections: ExplainerSection[];
}) {
  return (
    <div className="mt-12 space-y-10">
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="font-display text-2xl font-medium tracking-tight text-forest">
            {s.heading}
          </h2>
          <div className="mt-3 space-y-3">
            {s.blocks.map((b, i) => renderBlock(b, i))}
          </div>
          {s.cta && (
            <div className="mt-5">
              <CTAButton href={s.cta.href} variant="primary" arrow>
                {s.cta.label}
              </CTAButton>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
