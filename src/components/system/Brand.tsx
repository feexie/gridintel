import type { ReactNode } from "react";
import { Legend } from "./Metric";

/* Brand areas of the design system: the hero art, a sector's header band, the "planned" mark and
   the folded key. They carry the look of the product. They hold no figure. */

/** Not built yet. A word in a dashed outline, so it is never told by colour alone. */
export function PlannedTag({ children = "Planned" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-dashed border-line-bold px-2 py-0.5 text-micro font-semibold uppercase tracking-wide text-ink-4">{children}</span>;
}

/** The header of a sector's screen: which sector, what the screen is, and the question it answers. */
export function SectorBand({ eyebrow, title, children, aside }: { eyebrow: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="gi-band rounded-panel border border-line px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-eyebrow text-brand">{eyebrow}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {children ? <p className="mt-1 max-w-2xl text-sm leading-snug text-ink-3">{children}</p> : null}
        </div>
        {aside}
      </div>
    </header>
  );
}

/** What the status marks and origin words mean: one tap away on every screen that shows figures. */
export function KeyFold() {
  return (
    <details className="group text-caption text-ink-4" data-key>
      <summary className="cursor-pointer list-none hover:text-ink-2">
        <span className="group-open:hidden">What the status marks and origin words mean ▸</span>
        <span className="hidden group-open:inline">Status and origin ▾</span>
      </summary>
      <div className="mt-2">
        <Legend />
      </div>
    </details>
  );
}

/**
 * The art of the hero: an energy system as a diagram. A substation feeding lines of transformers
 * and connections on one side, a solar mini-grid with its battery standing alone on the other.
 * It is an illustration, drawn by hand in code; it shows no asset and no figure of any dataset.
 */
export function EnergySystemArt({ className = "" }: { className?: string }) {
  const node = (cx: number, cy: number, r = 4) => <circle cx={cx} cy={cy} r={r} fill="#ffffff" />;
  const home = (x: number, y: number) => <path d={`M${x} ${y} l5 -5 l5 5 v6 h-10 z`} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />;
  return (
    <svg aria-hidden viewBox="0 0 420 260" className={className} fill="none">
      {/* The network: a substation and its feeders. */}
      <g stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5">
        <path d="M70 60 H150 M150 60 L210 30 H300 M150 60 L210 90 H330 M150 60 V130 H250" />
        <path d="M250 30 v18 M300 30 v18 M250 90 v18 M330 90 v18 M200 130 v18 M250 130 v18" />
      </g>
      <g stroke="#7ee7ff" strokeWidth="1.5" strokeLinecap="round" className="gi-flow">
        <path d="M70 60 H150 L210 30 H300" />
        <path d="M150 60 L210 90 H330" />
        <path d="M150 60 V130 H250" />
      </g>
      <rect x="44" y="44" width="32" height="32" rx="7" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M60 50 l-6 12 h6 l-2 9 l8 -13 h-6 z" fill="#7ee7ff" />
      {node(150, 60, 5)}
      {node(250, 30)}
      {node(300, 30)}
      {node(250, 90)}
      {node(330, 90)}
      {node(200, 130)}
      {node(250, 130)}
      {home(245, 53)}
      {home(295, 53)}
      {home(245, 113)}
      {home(325, 113)}
      {home(195, 153)}
      {home(245, 153)}

      {/* The mini-grid: an array, a battery and the homes it supplies, connected to nothing else. */}
      <g stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.5">
        <path d="M112 212 H200 M200 212 H300 M250 212 v-14 M300 212 v-14" />
      </g>
      <path d="M112 212 H300" stroke="#b9a8ff" strokeWidth="1.5" strokeLinecap="round" className="gi-flow" />
      <g stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M60 222 l10 -24 h40 l10 24 z" fill="#ffffff" fillOpacity="0.1" />
        <path d="M65 210 h50 M80 198 l-6 24 M100 198 l6 24" strokeOpacity="0.45" />
        <rect x="176" y="198" width="26" height="28" rx="4" fill="#ffffff" fillOpacity="0.1" />
        <path d="M184 194 h10" />
        <path d="M182 219 h14 M182 212 h14" stroke="#b9a8ff" />
      </g>
      {home(245, 183)}
      {home(295, 183)}
      <circle cx="92" cy="176" r="9" stroke="#ffd98a" strokeOpacity="0.9" strokeWidth="1.4" />
      <path d="M92 160 v-5 M92 197 v0 M76 176 h-5 M113 176 h-5 M80.500 164.500 l-3.500 -3.500 M103.500 164.500 l3.500 -3.500" stroke="#ffd98a" strokeOpacity="0.8" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
