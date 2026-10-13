import Link from "next/link";
import type { MetricView } from "@/services/operations/views";
import type { LossSplitView, SiteMixView } from "@/services/overview/views";
import { MetricCell } from "./Metric";
import { formatMetric } from "./format";
import { siteHref } from "./map/links";

/* Small visuals for where a picture explains faster than a sentence. Each is drawn from the
   figures of a read model and holds no number of its own: a width is a figure's own value, and
   every value is also written beside its mark, so no visual is read by colour alone and each is
   its own table. No blur, glow or movement: these are figures. */

const LOSS = {
  technical: { label: "Technical", colour: "var(--color-series-technical)" },
  commercial: { label: "Commercial", colour: "var(--color-series-commercial)" },
  collection: { label: "Collection", colour: "var(--color-series-collection)" },
};

/** ATC&C loss as its three parts: one bar, each part as wide as its share of the loss. */
export function LossSplit({ split }: { split: LossSplitView }) {
  // Parts of a whole can be drawn as one bar only when each has a value above zero.
  const drawable = split.parts.every((part) => part.metric.value !== null && part.metric.value > 0);
  return (
    <figure className="space-y-3" data-loss-split>
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-caption text-ink-4">{split.total.label}, by where it is lost</figcaption>
        <span className="text-sm">
          <MetricCell metric={split.total} />
        </span>
      </div>
      {drawable ? (
        <div className="flex h-5 w-full gap-[2px]" role="img" aria-label={split.parts.map((part) => `${LOSS[part.key].label} ${formatMetric(part.metric)}`).join(", ")}>
          {split.parts.map((part) => (
            <div key={part.key} title={`${LOSS[part.key].label}: ${formatMetric(part.metric)}`} className="h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]" // Each part grows by its own value, so the widths are in the parts' proportion; the factor only keeps the bar full width.
              style={{ flexGrow: (part.metric.value as number) * 1000, flexBasis: 0, background: LOSS[part.key].colour }} />
          ))}
        </div>
      ) : (
        <p className="rounded-tile border border-dashed border-line-strong px-3 py-2 text-xs text-ink-4">The split cannot be drawn as parts of one bar: a part has no value, or is not above zero. The figures are below.</p>
      )}
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-3">
        {split.parts.map((part) => (
          <li key={part.key} className="flex items-baseline justify-between gap-2 text-xs sm:block" data-figure={part.metric.label}>
            <span className="flex items-center gap-1.5 text-ink-3">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: LOSS[part.key].colour }} />
              {LOSS[part.key].label}
            </span>
            <MetricCell metric={part.metric} />
          </li>
        ))}
      </ul>
      {split.scopeNote ? <p className="text-caption leading-snug text-ink-4">{split.scopeNote}</p> : null}
    </figure>
  );
}

const MIX = { renewable: "var(--color-series-collection)", generator: "var(--color-series-commercial)" };

function fraction(metric: MetricView): number | null {
  return metric.value === null ? null : Math.max(0, Math.min(1, metric.value));
}

/** Each site's generation mix: the renewable share as the filled part of a bar, the generator's as the rest. */
export function SiteMix({ sites }: { sites: SiteMixView[] }) {
  return (
    <figure className="space-y-2" data-site-mix>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-4">
        <span>Share of energy generated</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: MIX.renewable }} /> Solar PV
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: MIX.generator }} /> Generator
        </span>
      </figcaption>
      <ul className="divide-y divide-line/60">
        {sites.map((site) => {
          const share = fraction(site.renewableFraction);
          return (
            <li key={site.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto]" data-site={site.id}>
              <div className="min-w-0">
                <Link href={siteHref(site.id)} className="text-sm font-medium text-link hover:text-link-hover hover:underline">
                  {site.name}
                </Link>
                <p className="truncate text-micro text-ink-5">{site.plant}</p>
              </div>
              <span className="text-xs sm:order-last" data-figure="Renewable fraction">
                <MetricCell metric={site.renewableFraction} />
              </span>
              {share === null ? (
                <p className="col-span-2 text-caption text-ink-4 sm:col-span-1">Cannot be drawn: the renewable fraction has no value.</p>
              ) : (
                // The bar is the generator's colour; the renewable share is laid over it from the left, so the rest is the generator's without a subtraction.
                <div className="col-span-2 h-3 overflow-hidden rounded-[4px] sm:col-span-1" style={{ background: MIX.generator }} role="img" aria-label={`Solar PV ${formatMetric(site.renewableFraction)} of energy generated; the rest from the generator`}>
                  <div className={`h-full ${share < 1 ? "border-r-2 border-panel" : ""}`} style={{ width: `${share * 100}%`, background: MIX.renewable }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
