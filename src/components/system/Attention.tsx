import Link from "next/link";
import type { ReportedComparisonView } from "@/services/operations/views";
import type { AttentionItemView, AttentionTarget, AttentionTone, WorkspaceKey } from "@/services/overview/views";
import { MINIGRID_WORKSPACES, UTILITY_WORKSPACES } from "@/constants/navigation";
import { MetricCell, OriginTag, SourceAndMethod, StatusBadge } from "./Metric";
import { formatMetric, formatNumber, formatSigned, levelHref } from "./format";
import { siteHref } from "./map/links";

/* The one way a finding is shown, on every overview and in every sector: what kind of line it
   is (a mark and a word, never colour alone), one sentence, its figure with status and origin,
   and where it leads. The rule that listed it, the other figures behind it and the figure's
   source and method are one tap away, never left out.

   It lays out what the read model gives and calculates nothing. */

const TONE: Record<AttentionTone, { mark: string; word: string; text: string; edge: string; ground: string }> = {
  alert: { mark: "▲", word: "Act", text: "text-alert", edge: "border-l-alert-line", ground: "bg-alert-surface/60" },
  watch: { mark: "◆", word: "Check", text: "text-caution", edge: "border-l-caution-line", ground: "bg-caution-surface/50" },
  note: { mark: "●", word: "Note", text: "text-ink-3", edge: "border-l-line-bold", ground: "bg-well/40" },
};

const WORKSPACE_ROUTE: Record<WorkspaceKey, string> = {
  "utility.executive": UTILITY_WORKSPACES[0].href,
  "utility.operations": UTILITY_WORKSPACES[1].href,
  "utility.reliability": UTILITY_WORKSPACES[2].href,
  "utility.revenue": UTILITY_WORKSPACES[3].href,
  "utility.assets": UTILITY_WORKSPACES[4].href,
  "utility.events": UTILITY_WORKSPACES[5].href,
  "minigrid.sites": MINIGRID_WORKSPACES[0].href,
};

export function workspaceHref(workspace: WorkspaceKey): string {
  return WORKSPACE_ROUTE[workspace];
}

export function targetHref(target: AttentionTarget): string {
  if (target.type === "level") return levelHref(target.kind, target.id);
  if (target.type === "site") return siteHref(target.id);
  return workspaceHref(target.workspace);
}

/** Calculated less reported, with its sign and unit, as the read model gives it. */
function varianceText(row: ReportedComparisonView): string {
  if (row.variance === null) return "—";
  if (row.varianceUnit === "percentage_points") {
    const text = formatNumber(row.variance, 1);
    return `${row.variance > 0 && /[1-9]/.test(text) ? "+" : ""}${text} pp`;
  }
  return formatSigned({ ...row.reported, value: row.variance });
}

function Comparison({ row }: { row: ReportedComparisonView }) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-2" data-variance={row.label}>
      <span>{row.label}</span>
      <span className="font-mono tabular-nums text-ink">
        {formatMetric(row.reported)} <span className="font-sans text-ink-5">reported</span> · {formatMetric(row.calculated)} <span className="font-sans text-ink-5">calculated</span>{" "}
        <span className="text-caution-ink">({varianceText(row)})</span>
      </span>
    </li>
  );
}

export function AttentionItem({ item }: { item: AttentionItemView }) {
  const tone = TONE[item.tone];
  const { figure } = item;
  const [firstComparison] = item.comparisons;
  return (
    <li className={`rounded-tile border border-line border-l-[3px] ${tone.edge} ${tone.ground} px-3 py-2.5`} data-attention={item.id} data-tone={item.tone}>
      <p className={`flex items-center gap-1.5 text-micro font-semibold uppercase tracking-wide ${tone.text}`}>
        <span aria-hidden>{tone.mark}</span>
        <span>{tone.word}</span>
        <span className="text-ink-5">·</span>
        <span>{item.kind}</span>
      </p>
      <p className="mt-1 text-sm leading-snug text-ink">{item.statement}</p>

      {figure ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1" data-figure={figure.label}>
          <span className="font-mono text-lg font-medium tabular-nums text-ink">{item.figureSigned ? formatSigned(figure) : formatMetric(figure)}</span>
          {/* What the figure is: the words the read model gives for it, or its own name. */}
          <span className="text-caption text-ink-4">{item.figureNote ?? figure.label}</span>
          <StatusBadge status={figure.status} />
          {figure.status === "not_available" ? null : <OriginTag origin={figure.origin} />}
        </div>
      ) : null}
      {/* Every further rule the subject met, each with the figure that met it. */}
      {item.findings && item.findings.length > 0 ? (
        <ul className="mt-1.5 space-y-1 border-t border-line/60 pt-1.5" data-findings>
          {item.findings.map((found, i) => (
            <li key={`${found.title}:${i}`} className="text-xs leading-snug" data-finding-line>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-ink-2">{found.title}</span>
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="font-mono tabular-nums text-ink">{found.signed ? formatSigned(found.figure) : formatMetric(found.figure)}</span>
                  {found.note ? <span className="text-caption text-ink-4">{found.note}</span> : null}
                  <StatusBadge status={found.figure.status} />
                  {found.figure.status === "not_available" ? null : <OriginTag origin={found.figure.origin} />}
                </span>
              </div>
              {found.context ? (
                <p className="text-caption text-ink-4">
                  <span className="font-mono text-ink-2">{formatMetric(found.context.figure)}</span> {found.context.figure.label.toLowerCase()}, {found.context.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {/* A line about a report has no single figure: its first differing claim stands in its place. */}
      {figure === null && firstComparison ? (
        <ul className="mt-1.5">
          <Comparison row={firstComparison} />
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Link href={targetHref(item.target)} className="text-caption font-medium text-link hover:text-link-hover hover:underline">
          {item.targetLabel} →
        </Link>
        <details className="group w-full sm:w-auto sm:flex-1 sm:text-right">
          <summary className="cursor-pointer list-none text-caption text-ink-4 hover:text-ink-2">
            <span className="group-open:hidden">Rule, figures, source &amp; method ▸</span>
            <span className="hidden group-open:inline">Hide ▾</span>
          </summary>
          <div className="mt-2 space-y-2 border-t border-line pt-2 text-left">
            <p className="text-caption leading-snug text-ink-3">
              <span className="text-ink-5">Why it is listed: </span>
              {item.ruleText}
            </p>
            {item.comparisons.length > (figure === null ? 1 : 0) ? (
              <ul className="space-y-0.5">
                {item.comparisons.slice(figure === null ? 1 : 0).map((row) => (
                  <Comparison key={row.label} row={row} />
                ))}
              </ul>
            ) : null}
            {item.more.length > 0 ? (
              <dl className="space-y-0.5">
                {item.more.map((metric, i) => (
                  <div key={`${metric.label}:${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs" data-figure={metric.label}>
                    <dt className="text-ink-3">{metric.label}</dt>
                    <dd>
                      <MetricCell metric={metric} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {figure ? <SourceAndMethod metric={figure} /> : null}
          </div>
        </details>
      </div>
    </li>
  );
}

/** The list, in the read model's order. `empty` is what to say when nothing is listed. */
export function AttentionList({ items, note }: { items: AttentionItemView[]; note: string | null }) {
  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <ol className="space-y-2" data-attention-list>
          {items.map((item) => (
            <AttentionItem key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
      {note ? <p className="rounded-tile border border-dashed border-line-strong px-3 py-2 text-xs text-ink-4">{note}</p> : null}
    </div>
  );
}
