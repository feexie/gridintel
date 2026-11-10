import type { InitiativeFigureView } from "@/services/initiatives/views";

/* One figure of the front door, as the service gives it: the value or "Not yet available", what
   kind of figure it is (reported, calculated), SYNTHETIC when it rests on designed records, and
   the line that says where it came from. It formats nothing and calculates nothing. */

const ORIGIN_WORD: Record<NonNullable<InitiativeFigureView["origin"]>, string> = { reported: "Reported", calculated: "Calculated" };

export function Marks({ figure }: { figure: InitiativeFigureView }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {figure.origin ? <Mark>{ORIGIN_WORD[figure.origin]}</Mark> : <Mark>Not yet available</Mark>}
      {figure.synthetic ? <Mark strong>Synthetic</Mark> : null}
    </span>
  );
}

function Mark({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={`inline-flex rounded-[3px] border px-1.5 py-px text-micro font-medium uppercase tracking-wide ${strong ? "border-caution-line/60 text-caution" : "border-line-strong text-ink-3"}`}>
      {children}
    </span>
  );
}

/** The headline of a card: large value, marks, label and source line. */
export function Headline({ figure }: { figure: InitiativeFigureView }) {
  return (
    <div data-figure={figure.id} data-status={figure.status}>
      <p className="text-sm text-ink-3">{figure.label}</p>
      <p className="mt-0.5 text-3xl font-semibold tracking-tight text-ink">{figure.value ?? <span className="text-lg font-medium text-ink-4">Not yet available</span>}</p>
      <div className="mt-1">
        <Marks figure={figure} />
      </div>
    </div>
  );
}

/** A bar for a share from 0 to 1, given by the service. Nothing is drawn when it gives none. */
export function ProgressBar({ figure }: { figure: InitiativeFigureView }) {
  if (figure.share === null) return null;
  const width = `${Math.max(0, Math.min(1, figure.share)) * 100}%`;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={`${figure.label}: ${figure.value}`} data-progress>
      <div className="h-full rounded-full bg-brand" style={{ width }} />
    </div>
  );
}

/** A smaller figure: label, value and marks on one line. */
export function FigureRow({ figure }: { figure: InitiativeFigureView }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" data-figure={figure.id} data-status={figure.status}>
      <span className="text-sm text-ink-3">{figure.label}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-base font-semibold text-ink">{figure.value ?? "Not yet available"}</span>
        <Marks figure={figure} />
      </span>
    </div>
  );
}

/** Where a figure came from, or how it is calculated, in one line. */
export function Basis({ figure }: { figure: InitiativeFigureView }) {
  const lead = figure.origin === "calculated" ? "How this is calculated: " : figure.origin === "reported" ? "Source: " : "";
  return (
    <p className="text-caption leading-snug text-ink-4">
      {lead}
      {figure.basis}
    </p>
  );
}
