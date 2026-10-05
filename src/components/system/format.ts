import type { DisplayOrigin, DisplayStatus, LevelKind, MetricView } from "@/services/operations/views";

/* Presentation only: how values, statuses and links are written on screen. */

const BASE = "/dashboard/utility/operations";

const SEGMENT: Record<LevelKind, string> = {
  region: "regions",
  substation: "substations",
  feeder: "feeders",
  distribution_transformer: "transformers",
  service_point: "service-points",
};

export function levelHref(kind: LevelKind, id: string): string {
  return `${BASE}/${SEGMENT[kind]}/${encodeURIComponent(id)}`;
}

export const OPERATIONS_HOME = BASE;

export const LEVEL_NAME: Record<LevelKind, string> = {
  region: "Region",
  substation: "Substation",
  feeder: "Feeder",
  distribution_transformer: "Transformer",
  service_point: "Service point",
};

const number = (digits: number) => new Intl.NumberFormat("en-NG", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function formatNumber(value: number, digits = 0): string {
  // A value that rounds to zero is written as zero: never "-0.0".
  const rounded = Number(value.toFixed(digits));
  return number(digits).format(rounded === 0 ? 0 : rounded);
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? "—" : `${number(digits).format(value * 100)}%`;
}

export function formatMoney(value: number, currency: string | null): string {
  const symbol = currency === "NGN" ? "₦" : currency ? `${currency} ` : "";
  return `${value < 0 ? "−" : ""}${symbol}${number(Math.abs(value) < 1000 && !Number.isInteger(value) ? 2 : 0).format(Math.abs(value))}`;
}

/** A price per unit, always to two decimals: a rate that happens to be a whole number is still a rate. */
export function formatRate(value: number, currency: string | null): string {
  const symbol = currency === "NGN" ? "₦" : currency ? `${currency} ` : "";
  return `${value < 0 ? "−" : ""}${symbol}${number(2).format(Math.abs(value))}`;
}

/** The value of a metric as text, or a dash when it has none. */
export function formatMetric(metric: MetricView): string {
  if (metric.value === null) return "—";
  switch (metric.unit) {
    case "fraction":
      return formatPercent(metric.value);
    case "kWh":
      return `${formatNumber(metric.value)} kWh`;
    case "kVA":
      return `${formatNumber(metric.value, 1)} kVA`;
    case "currency":
      return formatMoney(metric.value, metric.currency);
    case "hours":
      return `${formatNumber(metric.value, 1)} h`;
    case "hours_per_day":
      return `${formatNumber(metric.value, 1)} h/day`;
    case "interruptions_per_customer":
      return formatNumber(metric.value, 1);
    case "count":
      return formatNumber(metric.value);
  }
}

/** A difference, written with its sign: "+56.7 h". A difference that rounds to zero has none. */
export function formatSigned(metric: MetricView): string {
  const text = formatMetric({ ...metric, value: metric.value });
  return metric.value !== null && metric.value > 0 && /[1-9]/.test(text) ? `+${text}` : text;
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  ok: "OK",
  calculated_with_estimates: "Estimated inputs",
  insufficient_data: "Insufficient data",
  not_computable: "Not computable",
  not_available: "Not available",
};

export const STATUS_HINT: Record<DisplayStatus, string> = {
  ok: "Every input is present and measured.",
  calculated_with_estimates: "Calculated; every input is present, but at least one was estimated rather than measured.",
  insufficient_data: "An input this figure needs is missing. No value is shown rather than a guess.",
  not_computable: "The inputs exist but the calculation is undefined for them.",
  not_available: "The platform has no source for this figure.",
};

export const ORIGIN_LABEL: Record<DisplayOrigin, string> = {
  measured: "Measured",
  reported: "Reported",
  calculated: "Calculated",
  estimated: "Estimated",
  derived: "Derived",
};

export const ORIGIN_HINT: Record<DisplayOrigin, string> = {
  measured: "Read from a meter, device or source record.",
  reported: "Published by someone else; shown as stated.",
  calculated: "Computed by GridIntel under a named methodology.",
  estimated: "An estimate, not a measurement.",
  derived: "A residual: what is left after subtracting other figures. It inherits their uncertainty.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const WAT_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * The parts of an instant in West Africa Time. Month names are written here and not taken from
 * the runtime, whose abbreviations differ between versions ("Sep" in one, "Sept" in another).
 */
function watParts(iso: string): { day: string; month: string; year: string; time: string } {
  const parts = Object.fromEntries(WAT_PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { day: String(Number(parts.day)), month: MONTHS[Number(parts.month) - 1], year: parts.year, time: `${parts.hour}:${parts.minute}` };
}

/** A timestamp in West Africa Time, e.g. "30 Sep 2026, 20:00 WAT". */
export function formatTime(iso: string): string {
  const { day, month, year, time } = watParts(iso);
  return `${day} ${month} ${year}, ${time} WAT`;
}

export function formatDay(iso: string): string {
  const { day, month, year } = watParts(iso);
  return `${day} ${month} ${year}`;
}

/** A reporting period, e.g. "1 Sep 2026 – 30 Sep 2026" for [1 Sep, 1 Oct). */
export function formatPeriod(period: { start: string; end: string }): string {
  const lastDay = new Date(new Date(period.end).getTime() - 1).toISOString();
  return `${formatDay(period.start)} – ${formatDay(lastDay)}`;
}
