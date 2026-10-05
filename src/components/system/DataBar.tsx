import { formatPeriod, formatTime } from "./format";

/* The one place a screen says what data it is looking at: the SYNTHETIC DATA label when the
   data is synthetic, the reporting period, and the time the data is as of. It sits above every
   dashboard screen, so no screen repeats it and none can be without it. */

export interface DataContext {
  /** What must be said about the data; null for real data. */
  notice: { label: string; summary: string } | null;
  period: { start: string; end: string };
  asOf: string;
}

export function DataBar({ context }: { context: DataContext }) {
  const { notice } = context;
  return (
    <div
      role="note"
      aria-label="About the data on this screen"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-6 py-1.5 text-xs lg:px-8 ${notice ? "border-caution-line/50 bg-caution-surface/90 text-caution-ink" : "border-line bg-panel text-ink-3"}`}
    >
      {notice ? (
        <>
          <span className="border border-caution-line px-1.5 py-px text-caption font-bold tracking-label text-caution">{notice.label}</span>
          <span>{notice.summary}</span>
        </>
      ) : null}
      <dl className="ml-auto flex flex-wrap gap-x-4 gap-y-0.5 text-caption" data-context>
        <div className="flex gap-1.5">
          <dt className="opacity-80">Reporting period</dt>
          <dd className="font-mono">{formatPeriod(context.period)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="opacity-80">Data as of</dt>
          <dd className="font-mono">{formatTime(context.asOf)}</dd>
        </div>
      </dl>
    </div>
  );
}
