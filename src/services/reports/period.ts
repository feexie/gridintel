/* ==========================================================
   SERVICES — REPORT PERIODS

   A report is for a day, a month or a year, named in its address:
   "2026-09-14", "2026-09", "2026". A period is in the data's own
   time zone (West Africa Time for the demonstration), from its
   first instant to the first instant of the next.

   A period the data does not wholly cover is NOT AVAILABLE. It is
   never filled, shortened to the part that is covered, or scaled:
   a year of which one month is held is not a year. Which periods
   are covered is the composition root's to say (`ReportCoverage`).

   Pure functions: no clock, no I/O.
========================================================== */

export type PeriodKind = "day" | "month" | "year";

/** What the data covers: [start, end), and the UTC offset its days are counted in, e.g. "+01:00". */
export interface ReportCoverage {
  start: string;
  end: string;
  offset: string;
}

export interface ReportPeriod {
  kind: PeriodKind;
  /** As it is written in the address: "2026-09-14", "2026-09", "2026". */
  key: string;
  /** [start, end), ISO timestamps in the coverage's offset. */
  start: string;
  end: string;
  /** In words: "14 September 2026", "September 2026", "2026". */
  label: string;
}

export type PeriodAvailability = { available: true } | { available: false; reason: string };

export interface PeriodChoice {
  period: ReportPeriod;
  available: boolean;
}

/** The periods offered for a report: every day and month the data covers, and each year it touches, which is offered only when wholly covered. */
export interface PeriodChoices {
  days: PeriodChoice[];
  months: PeriodChoice[];
  years: PeriodChoice[];
  /** The data's coverage, in words. */
  coverage: string;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

function instant(year: number, month: number, day: number, offset: string): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T00:00:00${offset}`;
}

/** The calendar date after (year, month, day), in the proleptic Gregorian calendar. */
function nextDay(year: number, month: number, day: number): [number, number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

/** The period an address names; null when it names none. */
export function parsePeriod(key: string, offset: string): ReportPeriod | null {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(key);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = match[2] === undefined ? null : Number(match[2]);
  const day = match[3] === undefined ? null : Number(match[3]);
  if (month !== null && (month < 1 || month > 12)) return null;
  if (month === null) return { kind: "year", key, start: instant(year, 1, 1, offset), end: instant(year + 1, 1, 1, offset), label: String(year) };
  if (day === null) {
    const [ny, nm] = month === 12 ? [year + 1, 1] : [year, month + 1];
    return { kind: "month", key, start: instant(year, month, 1, offset), end: instant(ny, nm, 1, offset), label: `${MONTH_NAMES[month - 1]} ${year}` };
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  const [ny, nm, nd] = nextDay(year, month, day);
  return { kind: "day", key, start: instant(year, month, day, offset), end: instant(ny, nm, nd, offset), label: `${day} ${MONTH_NAMES[month - 1]} ${year}` };
}

/** The data's coverage in words: "1 September 2026 to 30 September 2026". */
export function coverageLabel(coverage: ReportCoverage): string {
  const days = periodsOfKind("day", coverage);
  if (days.length === 0) return "no day";
  return days.length === 1 ? days[0].label : `${days[0].label} to ${days[days.length - 1].label}`;
}

/** Any span of whole days in words: "14 September 2026", "1 September 2026 to 30 September 2026". */
export function periodWords(period: { start: string; end: string }, offset: string): string {
  return coverageLabel({ ...period, offset });
}

const NEEDS: Record<PeriodKind, string> = {
  day: "A daily report needs the whole day",
  month: "A monthly report needs the whole month",
  year: "An annual report needs the whole year",
};

/** Whether the data wholly covers the period; when it does not, why, in words. */
export function availability(period: ReportPeriod, coverage: ReportCoverage): PeriodAvailability {
  const [start, end] = [Date.parse(period.start), Date.parse(period.end)];
  const [from, to] = [Date.parse(coverage.start), Date.parse(coverage.end)];
  if (start >= from && end <= to) return { available: true };
  const overlaps = start < to && end > from;
  return {
    available: false,
    reason: overlaps
      ? `Not available for this period. The data covers ${coverageLabel(coverage)} only, which is part of ${period.label}. ${NEEDS[period.kind]}; it is not filled, shortened or scaled from the part that is held.`
      : `Not available for this period. The data covers ${coverageLabel(coverage)} only; nothing is held for ${period.label}.`,
  };
}

/** Every period of a kind that starts inside the coverage, or (for months and years) overlaps it. */
function periodsOfKind(kind: PeriodKind, coverage: ReportCoverage): ReportPeriod[] {
  const start = coverage.start.slice(0, 10);
  const [y, m, d] = start.split("-").map(Number);
  const end = Date.parse(coverage.end);
  const out: ReportPeriod[] = [];
  if (kind === "day") {
    let [cy, cm, cd] = [y, m, d];
    for (let guard = 0; guard < 400; guard++) {
      const period = parsePeriod(`${pad(cy, 4)}-${pad(cm)}-${pad(cd)}`, coverage.offset);
      if (period === null || Date.parse(period.start) >= end) break;
      out.push(period);
      [cy, cm, cd] = nextDay(cy, cm, cd);
    }
  } else if (kind === "month") {
    let [cy, cm] = [y, m];
    for (let guard = 0; guard < 24; guard++) {
      const period = parsePeriod(`${pad(cy, 4)}-${pad(cm)}`, coverage.offset);
      if (period === null || Date.parse(period.start) >= end) break;
      out.push(period);
      [cy, cm] = cm === 12 ? [cy + 1, 1] : [cy, cm + 1];
    }
  } else {
    for (let cy = y; ; cy++) {
      const period = parsePeriod(pad(cy, 4), coverage.offset);
      if (period === null || Date.parse(period.start) >= end) break;
      out.push(period);
    }
  }
  return out;
}

export function periodChoices(coverage: ReportCoverage): PeriodChoices {
  const choose = (kind: PeriodKind): PeriodChoice[] =>
    periodsOfKind(kind, coverage).map((period) => ({ period, available: availability(period, coverage).available }));
  return { days: choose("day").filter((choice) => choice.available), months: choose("month"), years: choose("year"), coverage: coverageLabel(coverage) };
}

/** The period a report opens on: the month of the default reporting period. */
export function defaultPeriodKey(reportingPeriodStart: string): string {
  return reportingPeriodStart.slice(0, 7);
}

/** True when two periods are the same instants, however they are written. */
export function samePeriod(a: { start: string; end: string }, b: { start: string; end: string }): boolean {
  return Date.parse(a.start) === Date.parse(b.start) && Date.parse(a.end) === Date.parse(b.end);
}
