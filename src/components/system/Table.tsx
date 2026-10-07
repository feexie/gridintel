import type { ReactNode } from "react";
import { formatPercent } from "./format";

/* Table and heading primitives of the design system. A workspace composes these and the
   metric components; it does not restate their classes. */

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header>
      <p className="text-micro font-semibold uppercase tracking-eyebrow text-link/80">{eyebrow}</p>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {children ? <p className="text-xs text-ink-4">{children}</p> : null}
    </header>
  );
}

/** The heading of a block inside a panel. */
export function SubHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`mb-1 text-caption uppercase tracking-wide text-ink-4 ${className}`}>{children}</h3>;
}

/** Fine print under a table or a chart. */
export function Note({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "caution" }) {
  return <p className={`text-caption leading-snug ${tone === "caution" ? "text-caution-ink/90" : "text-ink-4"}`}>{children}</p>;
}

export function Table({ children, name }: { children: ReactNode; name?: string }) {
  return (
    <table className="w-full border-collapse text-xs" data-table={name}>
      {children}
    </table>
  );
}

/** The heading row. `sticky` keeps it in view while a long table scrolls inside its panel. */
export function HeadRow({ children, sticky = false }: { children: ReactNode; sticky?: boolean }) {
  return (
    <thead className={sticky ? "sticky top-0 bg-panel" : undefined}>
      <tr className="border-b border-line-strong text-left text-micro uppercase tracking-wide text-ink-5">{children}</tr>
    </thead>
  );
}

export function Th({ children, right = false, className = "" }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <th className={`py-1 pr-2 font-normal ${right ? "text-right" : ""} ${className}`}>{children}</th>;
}

/** A row. `hover` marks the row under the pointer, for a long list of links. */
export function Row({ children, id, hover = false }: { children: ReactNode; id?: string; hover?: boolean }) {
  return (
    <tr className={`border-b border-line/60 align-top ${hover ? "hover:bg-line/30" : ""}`} data-row={id}>
      {children}
    </tr>
  );
}

/** A cell. `figure` sets a number in the monospace face, right-aligned. */
export function Td({ children, figure = false, right = false, className = "" }: { children?: ReactNode; figure?: boolean; right?: boolean; className?: string }) {
  return <td className={`py-1 pr-2 ${figure ? "whitespace-nowrap text-right font-mono tabular-nums text-ink" : right ? "text-right" : "text-ink-2"} ${className}`}>{children}</td>;
}

/** A share of a whole as a bar with its percentage: one series, labelled, never colour alone. */
export function ShareBar({ share, label }: { share: number | null; label?: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-2 flex-1 bg-line">
        <div className="h-full rounded-r-[2px]" style={{ width: `${Math.max(0, Math.min(1, share ?? 0)) * 100}%`, background: "var(--color-series-technical)" }} />
      </div>
      <span className="w-12 text-right font-mono tabular-nums text-ink-3">{formatPercent(share)}</span>
    </div>
  );
}
