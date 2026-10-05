import type { DisplayOrigin, DisplayStatus, MetricView, SourcingView } from "@/services/operations/views";
import { ORIGIN_HINT, ORIGIN_LABEL, STATUS_HINT, STATUS_LABEL, formatMetric, formatNumber, formatPercent } from "./format";

const STATUS_STYLE: Record<DisplayStatus, string> = {
  ok: "border-ok-line/40 text-ok",
  calculated_with_estimates: "border-caution-line/50 text-caution",
  insufficient_data: "border-alert-line/50 text-alert",
  not_computable: "border-alert-line/50 text-alert",
  not_available: "border-line-bold text-ink-4",
};

const STATUS_MARK: Record<DisplayStatus, string> = {
  ok: "●",
  calculated_with_estimates: "≈",
  insufficient_data: "!",
  not_computable: "∅",
  not_available: "–",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span
      title={STATUS_HINT[status]}
      className={`inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-px text-micro font-medium uppercase tracking-wide ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden>{STATUS_MARK[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OriginTag({ origin }: { origin: DisplayOrigin }) {
  return (
    <span
      title={ORIGIN_HINT[origin]}
      className="inline-flex border border-line-strong bg-line/60 px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-3"
    >
      {ORIGIN_LABEL[origin]}
    </span>
  );
}

function share(value: number | null): string {
  return value === null ? "share not known" : `${formatPercent(value)} estimated`;
}

/** Everything behind a number: how it was obtained, by which method, from which inputs and sources. */
export function SourceAndMethod({ metric, sourcing }: { metric: MetricView; sourcing?: SourcingView }) {
  return (
    <div className="space-y-2 text-caption leading-snug text-ink-3">
      <p>
        <span className="text-ink-5">Status: </span>
        {STATUS_HINT[metric.status]}
      </p>
      <p>
        <span className="text-ink-5">Origin: </span>
        {ORIGIN_LABEL[metric.origin]}. {ORIGIN_HINT[metric.origin]}
      </p>
      {metric.derivation ? (
        <p>
          <span className="text-ink-5">How: </span>
          {metric.derivation}
        </p>
      ) : null}
      {metric.method ? (
        <p>
          <span className="text-ink-5">Method: </span>
          {metric.method.name} <span className="font-mono text-ink-4">({metric.method.id} v{metric.method.version})</span>
          {metric.method.disclaimer ? <span className="block text-ink-4">{metric.method.disclaimer}</span> : null}
        </p>
      ) : null}
      {metric.inputs.length > 0 ? (
        <table className="w-full border-collapse font-mono text-micro">
          <thead>
            <tr className="text-left text-ink-5">
              <th className="pr-2 font-normal">Input</th>
              <th className="pr-2 text-right font-normal">Value</th>
              <th className="pr-2 font-normal">Origin</th>
              <th className="font-normal">Quality</th>
            </tr>
          </thead>
          <tbody>
            {metric.inputs.map((input) => (
              <tr key={input.name} className="border-t border-line align-top">
                <td className="break-all pr-2">{input.name}</td>
                <td className="whitespace-nowrap pr-2 text-right">
                  {input.value === null ? "missing" : `${formatNumber(input.value, Math.abs(input.value) < 10 ? 3 : 0)} ${input.unit}`}
                </td>
                <td className="pr-2">{ORIGIN_LABEL[input.origin]}</td>
                <td>
                  {input.quality}
                  {input.origin === "estimated" ? ` (${share(input.estimatedShare)})` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {metric.estimatedInputs.length > 0 ? (
        <p>
          <span className="text-caution">Estimated inputs: </span>
          {metric.estimatedInputs.map((input) => `${input.name} (${share(input.share)})`).join("; ")}
        </p>
      ) : null}
      {metric.missingInputs.length > 0 ? (
        <p>
          <span className="text-alert">Missing: </span>
          {metric.missingInputs.slice(0, 6).join("; ")}
          {metric.missingInputs.length > 6 ? ` and ${metric.missingInputs.length - 6} more` : ""}
        </p>
      ) : null}
      {metric.warnings.length > 0 ? (
        <ul className="list-disc pl-4 text-ink-4">
          {metric.warnings.slice(0, 5).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {sourcing ? (
        <p>
          <span className="text-ink-5">Data sources: </span>
          {sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}
        </p>
      ) : null}
    </div>
  );
}

/** A headline figure with its status, origin and a click-through to source and method. */
export function MetricTile({
  metric,
  sourcing,
  emphasis = false,
  children,
}: {
  metric: MetricView;
  sourcing?: SourcingView;
  emphasis?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div data-metric={metric.label} className="relative border border-line bg-well/40 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-caption uppercase tracking-wide text-ink-4">{metric.label}</p>
        {/* A figure the platform has no source for has no origin to state. */}
        {metric.status === "not_available" ? null : <OriginTag origin={metric.origin} />}
      </div>
      <p className={`mt-1 font-mono tabular-nums text-ink ${emphasis ? "text-2xl" : "text-lg"}`}>{formatMetric(metric)}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={metric.status} />
        {children}
      </div>
      {metric.note ? <p className="mt-1.5 text-caption leading-snug text-ink-4">{metric.note}</p> : null}
      <details className="group mt-1.5">
        <summary className="cursor-pointer list-none text-caption text-link/90 hover:text-link-hover">
          <span className="group-open:hidden">Source &amp; method ▸</span>
          <span className="hidden group-open:inline">Source &amp; method ▾</span>
        </summary>
        <div className="absolute left-0 top-full z-30 mt-1 w-[26rem] max-w-[90vw] border border-line-strong bg-app p-3 shadow-xl shadow-black/60">
          <SourceAndMethod metric={metric} sourcing={sourcing} />
        </div>
      </details>
    </div>
  );
}

/** A figure in a table row: value, a status mark, and the full trail on hover. */
export function MetricCell({ metric, mark }: { metric: MetricView | undefined; mark?: string }) {
  if (!metric) return <span className="text-ink-5">—</span>;
  // Kept short: a table can hold hundreds of cells. Everything the cell means is already
  // visible (value, status mark, origin tag, footnote); the full trail is on the row's own page.
  const hover = [
    `${metric.label} · ${STATUS_LABEL[metric.status]} · ${ORIGIN_LABEL[metric.origin]}`,
    metric.estimatedInputs.length > 0 ? `Estimated: ${metric.estimatedInputs.map((input) => `${input.name} (${share(input.share)})`).join("; ")}` : "",
    metric.missingInputs.length > 0 ? `Missing: ${metric.missingInputs.slice(0, 2).join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span title={hover} className="inline-flex items-baseline justify-end gap-1 whitespace-nowrap font-mono tabular-nums">
      <span className={metric.value === null ? "text-ink-5" : "text-ink"}>
        {metric.value === null ? STATUS_LABEL[metric.status].toLowerCase() : formatMetric(metric)}
      </span>
      <span aria-label={STATUS_LABEL[metric.status]} className={`text-micro ${STATUS_STYLE[metric.status].split(" ")[1]}`}>
        {STATUS_MARK[metric.status]}
      </span>
      {metric.value === null ? null : <span className="text-nano uppercase text-ink-5">{ORIGIN_LABEL[metric.origin].slice(0, 4)}</span>}
      {mark ? <span className="font-sans text-caption text-caution">{mark}</span> : null}
    </span>
  );
}

export function Panel({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-title text-ink-2">{title}</h2>
        {aside ? <div className="text-caption text-ink-4">{aside}</div> : null}
      </header>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

export function Legend() {
  const statuses: DisplayStatus[] = ["ok", "calculated_with_estimates", "insufficient_data", "not_available"];
  const origins: DisplayOrigin[] = ["measured", "reported", "calculated", "estimated", "derived"];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-ink-5">
      <span>Status:</span>
      {statuses.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
      <span className="ml-2">Origin:</span>
      {origins.map((origin) => (
        <OriginTag key={origin} origin={origin} />
      ))}
    </div>
  );
}
