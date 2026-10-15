import Link from "next/link";
import type { ReactNode } from "react";

/* What a screen keeps one tap away and never removes: rules, notes, source and method, and tables
   a phone does not need on first view. Each is a native <details>, so it opens without script, is
   found by the browser's find-in-page, and reads in full to a screen reader. */

/** Notes, rules, and source and method, folded under what they explain. */
export function Fold({ label = "Notes, rules, source & method", children, name }: { label?: string; children: ReactNode; name?: string }) {
  return (
    <details className="group text-caption" data-fold={name}>
      <summary className="gi-tap flex cursor-pointer list-none items-center text-ink-4 hover:text-ink-2">
        <span className="group-open:hidden">{label} ▸</span>
        <span className="hidden group-open:inline">{label} ▾</span>
      </summary>
      <div className="mt-1 space-y-1.5 border-l-2 border-line pl-3 leading-snug text-ink-4">{children}</div>
    </details>
  );
}

/** A table, or any detail, that is folded on a phone and open on a wider screen. */
export function WideOpen({ label = "Show the table", children, name }: { label?: string; children: ReactNode; name?: string }) {
  return (
    <details className="gi-wide-open group" data-wide-open={name}>
      <summary className="gi-tap flex cursor-pointer list-none items-center text-caption font-medium text-link hover:text-link-hover">
        <span className="group-open:hidden">{label} ▸</span>
        <span className="hidden group-open:inline">Hide ▾</span>
      </summary>
      <div className="mt-1 space-y-3">{children}</div>
    </details>
  );
}

/** The sections of a long screen, as a row of links that scrolls sideways on its own on a phone. */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav aria-label="On this screen" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-sections>
      <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className="gi-tap inline-flex items-center whitespace-nowrap rounded-full border border-line bg-panel px-3 py-1 text-caption font-medium text-ink-3 hover:border-brand hover:text-ink"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The sources behind a screen, on its last line. */
export function Sources({ sourcing }: { sourcing: { sources: { name: string; kind: string }[] } }) {
  return <p className="text-micro text-ink-5">Data sources: {sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>;
}
