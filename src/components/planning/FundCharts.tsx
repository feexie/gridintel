import type { ChartSeries } from "@/services/planning/views";

/* The Metering Fund's charts, drawn as SVG on the server: plain titles, axes with units, every
   series named in a legend beside it, nothing that needs hovering. They lay out the figures the
   service gives; they calculate none. */

const WIDTH = 640;
const HEIGHT = 260;
const PAD = { left: 64, right: 16, top: 12, bottom: 36 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const tickFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** Rounded axis ticks spanning the values, zero included. */
function ticks(min: number, max: number, count = 5): number[] {
  const low = Math.min(0, min);
  const high = Math.max(0, max);
  const raw = (high - low) / (count - 1) || 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((one) => one * magnitude).find((one) => one >= raw) ?? raw;
  const start = Math.floor(low / step) * step;
  const result: number[] = [];
  for (let value = start; value <= high + step * 0.5; value += step) result.push(Number(value.toFixed(6)));
  return result;
}

function Legend({ items }: { items: { label: string; className: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-3" data-chart-legend>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden className={item.className}>
            {item.dashed ? <line x1="0" y1="4" x2="18" y2="4" strokeWidth="2.5" strokeDasharray="4 3" stroke="currentColor" /> : <rect width="18" height="8" rx="1.5" fill="currentColor" />}
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function Axes({ yTicks, scaleY, unit, xLabels }: { yTicks: number[]; scaleY: (value: number) => number; unit: string; xLabels: { x: number; label: string }[] }) {
  return (
    <g className="text-ink-5" fontSize="12">
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={scaleY(tick)} y2={scaleY(tick)} stroke="currentColor" strokeOpacity={tick === 0 ? 0.9 : 0.25} strokeWidth={tick === 0 ? 1.25 : 1} />
          <text x={PAD.left - 8} y={scaleY(tick) + 4} textAnchor="end" fill="currentColor">
            {tickFormat.format(tick)}
          </text>
        </g>
      ))}
      <text x={14} y={PAD.top + PLOT_H / 2} transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`} textAnchor="middle" fill="currentColor">
        {unit}
      </text>
      {xLabels.map((label) => (
        <text key={label.label} x={label.x} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" fill="currentColor">
          {label.label}
        </text>
      ))}
    </g>
  );
}

/** Two series over the months of the rollout. */
export function BalanceChart({ title, unit, months, base, stressed }: { title: string; unit: string; months: number; base: ChartSeries; stressed: ChartSeries }) {
  const all = [...base.values, ...stressed.values];
  const yTicks = ticks(Math.min(...all), Math.max(...all));
  const low = yTicks[0];
  const high = yTicks[yTicks.length - 1];
  const scaleY = (value: number) => PAD.top + PLOT_H - ((value - low) / (high - low || 1)) * PLOT_H;
  const scaleX = (month: number) => PAD.left + (month / months) * PLOT_W;
  const line = (values: number[]) => values.map((value, month) => `${month === 0 ? "M" : "L"}${scaleX(month).toFixed(1)},${scaleY(value).toFixed(1)}`).join(" ");
  const xLabels = Array.from({ length: months / 12 + 1 }, (_, index) => ({ x: scaleX(index * 12), label: index === 0 ? "Month 0" : `${index * 12}` }));
  return (
    <figure className="max-w-4xl space-y-2" data-chart="balance">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${title}, in ${unit}`}>
        <Axes yTicks={yTicks} scaleY={scaleY} unit={unit} xLabels={xLabels} />
        <path d={line(stressed.values)} fill="none" strokeWidth="2.5" strokeDasharray="6 4" className="text-series-serious" stroke="currentColor" />
        <path d={line(base.values)} fill="none" strokeWidth="3" className="text-brand" stroke="currentColor" />
      </svg>
      <Legend items={[{ label: base.label, className: "text-brand" }, { label: stressed.label, className: "text-series-serious", dashed: true }]} />
    </figure>
  );
}

const STACK_COLOURS = ["text-brand", "text-ok-line", "text-caution-line", "text-series-technical"];

/** Bars by year, the series stacked. */
export function StackedBars({ title, unit, years, series, id }: { title: string; unit: string; years: string[]; series: ChartSeries[]; id: string }) {
  const totals = years.map((_, index) => series.reduce((total, one) => total + Math.max(0, one.values[index] ?? 0), 0));
  const yTicks = ticks(0, Math.max(...totals));
  const high = yTicks[yTicks.length - 1] || 1;
  const scaleY = (value: number) => PAD.top + PLOT_H - (value / high) * PLOT_H;
  const slot = PLOT_W / years.length;
  const barWidth = Math.min(64, slot * 0.6);
  const shown = series.filter((one) => one.values.some((value) => value > 0));
  return (
    <figure className="max-w-3xl space-y-2" data-chart={id}>
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${title}, in ${unit}`}>
        <Axes yTicks={yTicks} scaleY={scaleY} unit={unit} xLabels={years.map((label, index) => ({ x: PAD.left + slot * (index + 0.5), label }))} />
        {years.map((year, index) => {
          let top = 0;
          return (
            <g key={year}>
              {series.map((one, seriesIndex) => {
                const value = Math.max(0, one.values[index] ?? 0);
                const y = scaleY(top + value);
                const height = scaleY(top) - y;
                top += value;
                return value > 0 ? <rect key={one.label} x={PAD.left + slot * (index + 0.5) - barWidth / 2} y={y} width={barWidth} height={height} className={STACK_COLOURS[seriesIndex % STACK_COLOURS.length]} fill="currentColor" /> : null;
              })}
            </g>
          );
        })}
      </svg>
      <Legend items={shown.map((one) => ({ label: one.label, className: STACK_COLOURS[series.indexOf(one) % STACK_COLOURS.length] }))} />
    </figure>
  );
}
