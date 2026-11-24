import type {
  IsoDate,
  PlanningClass,
  ReferenceBasis,
  ReferenceCapex,
  ReferenceCapexLine,
  ReferenceClaim,
  ReferenceCustomer,
  ReferenceMeterDay,
  ReferenceOpexFloor,
  ReferenceOpexLine,
  ReferencePayment,
  ReferenceSite,
  ReferenceSiteDay,
  ReferenceSingleTariffUse,
  ReferenceTariffChange,
  ReferenceTariffEvent,
  ReferenceUseWindow,
} from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";
import { accountsCreatedTo, creditBuyers } from "../../reference/buyers.ts";
import { YEARS } from "./benchmark.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: A REFERENCE SITE AS A PLANNING BASIS
   (gridintel.planning.minigrid-reference-basis 0.1.0; MG-PLAN.md 3.2, 3.3)

   What a plan takes from one reference site's published records:

   - Years of operation are 365-day years from the first day with
     meter data.
   - Days left out: no meter data (gap), the low-use window and stale
     repeated totals, by the publisher's own day flags. Zero
     meter-days are kept (a zero cannot be told from "off").
   - Site kWh per reporting meter-day: each day's sum of the meters ÷
     meters reporting; the P50 and P90 by linear interpolation between
     the nearest ranks.
   - The default basis (Founder, 24 November 2026): the P50 and P90,
     and the class factors, pooled over the years of operation that lie
     wholly within the site's first tariff, held flat for a new site.
     The same figures by year of operation are kept as what happened at
     the site: a decline confounded by tariff rises and an outage.
   - Class factor: the class's share of the year's metered energy ÷
     its share of the year's meter-days. Class P90 meter-day: across
     the whole record, for the no-diversity upper bound only.
   - Connection ramp and buying share by calendar year from the first
     year (year 1 is the calendar year operation started): accounts
     created to the end of the year ÷ accounts with a year created;
     customers who bought credit in the year ÷ accounts created to
     date.
   - Tariff changes: for each change, up to 182 days that were not
     left out either side of it, the month of the change left out of
     both (its day is not recorded); use per reporting meter-day
     over each window, with what else changed.
   - The 2019 build cost by the publisher's categories, with the PV,
     battery and meters it bought, and the accounts beside them.
   - The recurring operating-cost lines by year (company-account
     lines in ₦ a year): a reported floor, never full opex, with the
     lines the source leaves blank named.
========================================================== */

export interface ReferenceBasisParameters {
  yearDays: number;
  /** Days each side of a tariff change. */
  windowDays: number;
  /** The publisher's day flags that leave a day out. */
  excludedFlags: string[];
}

export const MINIGRID_REFERENCE_BASIS: Methodology<ReferenceBasisParameters> = {
  id: "gridintel.planning.minigrid-reference-basis",
  version: "0.1.0",
  name: "GridIntel reference planning basis from a reference site",
  description: "A reference site's published records as planning figures by year of operation: site kWh per reporting meter-day (P50, P90), class factors, the connection ramp, the buying share, tariff changes and the build cost.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { yearDays: 365, windowDays: 182, excludedFlags: ["gap_no_meter_data", "low_use_window", "stale_repeated_total"] },
};

/** The records a basis is built from (structurally the reference repository's records). */
export interface ReferenceBasisRecords {
  site: ReferenceSite;
  days: readonly ReferenceSiteDay[];
  meterDays: readonly ReferenceMeterDay[];
  customers: readonly ReferenceCustomer[];
  payments: readonly ReferencePayment[];
  tariffEvents: readonly ReferenceTariffEvent[];
  capex: readonly ReferenceCapexLine[];
  claims: readonly ReferenceClaim[];
  opex: readonly ReferenceOpexLine[];
}

const CLASSES: readonly PlanningClass[] = ["residential", "non_residential"];
const DAY_MS = 86_400_000;
const dayNumber = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

/** The p-th percentile by linear interpolation between the nearest ranks; null for no values. */
export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function referenceBasisFrom(records: ReferenceBasisRecords, parameters: ReferenceBasisParameters = MINIGRID_REFERENCE_BASIS.parameters): ReferenceBasis | null {
  const first = records.days.find((day) => day.sumOfMetersKwh !== null);
  if (!first) return null;
  const start = dayNumber(first.date);
  const yearOf = (date: IsoDate) => Math.floor((dayNumber(date) - start) / parameters.yearDays) + 1;
  const excludedFlag = (day: ReferenceSiteDay) => day.flags.find((flag) => parameters.excludedFlags.includes(flag));
  const kept = (day: ReferenceSiteDay) => day.sumOfMetersKwh !== null && day.metersReporting !== null && day.metersReporting > 0 && excludedFlag(day) === undefined;
  const keptDays = records.days.filter((day) => day.date >= first.date && kept(day));
  const keptDates = new Set(keptDays.map((day) => day.date));

  // Site kWh per reporting meter-day, by year of operation.
  const perMeter = (day: ReferenceSiteDay) => (day.sumOfMetersKwh as number) / (day.metersReporting as number);
  const yearValues = YEARS.map((year) => keptDays.filter((day) => yearOf(day.date) === year).map(perMeter));

  // Class factors by year, and each class's P90 meter-day, over the kept days.
  const classYear = YEARS.map(() => Object.fromEntries(CLASSES.map((klass) => [klass, { kwh: 0, days: 0 }])) as Record<PlanningClass, { kwh: number; days: number }>);
  const classDays: Record<PlanningClass, number[]> = { residential: [], non_residential: [] };
  for (const meterDay of records.meterDays) {
    if (meterDay.customerClass === null || !keptDates.has(meterDay.date)) continue;
    const year = yearOf(meterDay.date);
    classDays[meterDay.customerClass].push(meterDay.kwh);
    if (year < 1 || year > YEARS.length) continue;
    const cell = classYear[year - 1][meterDay.customerClass];
    cell.kwh += meterDay.kwh;
    cell.days += 1;
  }
  const classFactor = Object.fromEntries(
    CLASSES.map((klass) => [
      klass,
      classYear.map((year) => {
        const energy = CLASSES.reduce((sum, one) => sum + year[one].kwh, 0);
        const days = CLASSES.reduce((sum, one) => sum + year[one].days, 0);
        return energy <= 0 || days <= 0 || year[klass].days === 0 ? null : year[klass].kwh / energy / (year[klass].days / days);
      }),
    ]),
  ) as Record<PlanningClass, (number | null)[]>;

  // Ramp and buying share by calendar year from the year operation started.
  const firstYear = Number(first.date.slice(0, 4));
  const accounts = records.customers.filter((customer) => customer.yearCreated !== null).length;
  const ramp = YEARS.map((year) => (accounts === 0 ? null : accountsCreatedTo(records.customers, firstYear + year - 1) / accounts));
  const buyingShare = YEARS.map((year) => {
    const created = accountsCreatedTo(records.customers, firstYear + year - 1);
    return created === 0 ? null : creditBuyers(records.payments, firstYear + year - 1) / created;
  });

  const left = records.days.filter((day) => day.date >= first.date && !kept(day));
  const count = (flag: string) => left.filter((day) => day.flags.includes(flag)).length;
  const noData = left.filter((day) => day.sumOfMetersKwh === null || !day.metersReporting).length;
  const exclusions = [
    `Years of operation are ${parameters.yearDays}-day years from ${first.date}, the first day with meter data.`,
    `${left.length} days left out: ${noData} with no meter data, ${count("low_use_window")} in the low-use window, ${count("stale_repeated_total")} with a stale repeated total (a day can carry more than one flag).`,
    "Zero meter-days are kept: a zero cannot be told from a meter that was off.",
    `The ramp and the buying share are by calendar year, year 1 being ${firstYear}.`,
  ];
  if (records.meterDays.some((meterDay) => meterDay.customerClass === null)) exclusions.push("Meter-days with no class are left out of the class factors.");

  const tariffs = records.tariffEvents.filter((event) => event.recordType === "tariff" && event.value !== null);

  // The years of operation wholly within the first tariff, pooled.
  const firstTariff = tariffs[0];
  const firstEnd = firstTariff?.periodEnd && /^\d{4}-\d{2}/.test(firstTariff.periodEnd) ? dayNumber(`${firstTariff.periodEnd.slice(0, 7)}-01`) : Infinity;
  const singleYears = YEARS.filter((year) => start + year * parameters.yearDays <= firstEnd);
  let singleTariff: ReferenceSingleTariffUse | null = null;
  if (firstTariff && singleYears.length > 0) {
    const pooled = keptDays.filter((day) => singleYears.includes(yearOf(day.date)));
    const pooledDates = new Set(pooled.map((day) => day.date));
    const cells = Object.fromEntries(CLASSES.map((klass) => [klass, { kwh: 0, days: 0 }])) as Record<PlanningClass, { kwh: number; days: number }>;
    for (const meterDay of records.meterDays) {
      if (meterDay.customerClass === null || !pooledDates.has(meterDay.date)) continue;
      cells[meterDay.customerClass].kwh += meterDay.kwh;
      cells[meterDay.customerClass].days += 1;
    }
    const energy = CLASSES.reduce((sum, one) => sum + cells[one].kwh, 0);
    const meterDays = CLASSES.reduce((sum, one) => sum + cells[one].days, 0);
    const values = pooled.map(perMeter);
    singleTariff = {
      tariff: firstTariff.value as number,
      years: singleYears,
      days: pooled.length,
      p50: percentile(values, 0.5),
      p90: percentile(values, 0.9),
      classFactor: Object.fromEntries(
        CLASSES.map((klass) => [klass, energy <= 0 || meterDays <= 0 || cells[klass].days === 0 ? null : cells[klass].kwh / energy / (cells[klass].days / meterDays)]),
      ) as Record<PlanningClass, number | null>,
    };
  }
  const gaps = records.claims.filter((claim) => claim.key === "meter_gap_share").map((claim) => claim.value);

  return {
    siteId: records.site.id,
    siteCode: records.site.code,
    sourceId: records.site.sourceId,
    operationStart: first.date,
    singleTariff,
    siteKwhPerMeterDay: { p50: yearValues.map((values) => percentile(values, 0.5)), p90: yearValues.map((values) => percentile(values, 0.9)) },
    classFactor,
    classP90MeterDay: { residential: percentile(classDays.residential, 0.9), non_residential: percentile(classDays.non_residential, 0.9) },
    ramp,
    buyingShare,
    exclusions,
    meterGap: gaps.length === 0 ? null : { low: Math.min(...gaps), high: Math.max(...gaps) },
    tariffChanges: tariffChanges(records, tariffs, keptDays, parameters),
    capex: capexOf(records),
    opexFloor: opexFloorOf(records.opex),
    opexBlank: records.opex.filter((line) => line.amount === null).map((line) => line.item),
    tariffs: tariffs.map((event) => event.value as number),
  };
}

function tariffChanges(records: ReferenceBasisRecords, tariffs: readonly ReferenceTariffEvent[], keptDays: readonly ReferenceSiteDay[], parameters: ReferenceBasisParameters): ReferenceTariffChange[] {
  const changes: ReferenceTariffChange[] = [];
  for (let index = 1; index < tariffs.length; index++) {
    const previous = tariffs[index - 1];
    const next = tariffs[index];
    const changeMonth = next.periodStart?.slice(0, 7);
    if (!changeMonth || !/^\d{4}-\d{2}$/.test(changeMonth)) continue;
    const monthStart = `${changeMonth}-01`;
    const [y, m] = changeMonth.split("-").map(Number);
    const afterStart = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const nextEnd = next.periodEnd && /^\d{4}-\d{2}/.test(next.periodEnd) ? `${next.periodEnd.slice(0, 7)}-01` : null;
    const before = keptDays.filter((day) => day.date < monthStart).slice(-parameters.windowDays);
    const after = keptDays.filter((day) => day.date >= afterStart && (nextEnd === null || day.date < nextEnd)).slice(0, parameters.windowDays);
    if (before.length === 0 || after.length === 0) continue;
    const beforeWindow = windowOfUse(before, records.meterDays);
    const afterWindow = windowOfUse(after, records.meterDays);
    const between = records.days.filter((day) => day.date > beforeWindow.end && day.date < afterWindow.start && !day.date.startsWith(changeMonth)).length;
    const leftOut = records.days.filter((day) => day.date > beforeWindow.end && day.date < afterWindow.start).length - keptDays.filter((day) => day.date > beforeWindow.end && day.date < afterWindow.start).length;
    const confounders = [
      "The day of the change is not recorded; its month is left out of both windows.",
      `Meters reporting averaged ${beforeWindow.metersReporting.toFixed(0)} before and ${afterWindow.metersReporting.toFixed(0)} after.`,
      `Meter-days at 0 kWh: ${(beforeWindow.zeroShare * 100).toFixed(1)}% before, ${(afterWindow.zeroShare * 100).toFixed(1)}% after.`,
    ];
    if (leftOut > 0 && between > 0) confounders.push(`${leftOut} days between the windows are left out (no meter data, the low-use window or stale repeats); the after window follows them.`);
    changes.push({
      id: `${records.site.id}-${changeMonth}`,
      fromTariff: previous.value as number,
      toTariff: next.value as number,
      changeMonth,
      before: beforeWindow,
      after: afterWindow,
      confounders,
    });
  }
  return changes;
}

function windowOfUse(days: readonly ReferenceSiteDay[], meterDays: readonly ReferenceMeterDay[]): ReferenceUseWindow {
  const dates = new Set(days.map((day) => day.date));
  const sum = days.reduce((total, day) => total + (day.sumOfMetersKwh ?? 0), 0);
  const meters = days.reduce((total, day) => total + (day.metersReporting ?? 0), 0);
  let zero = 0;
  let all = 0;
  for (const meterDay of meterDays) {
    if (!dates.has(meterDay.date)) continue;
    all += 1;
    if (meterDay.kwh === 0) zero += 1;
  }
  return { start: days[0].date, end: days[days.length - 1].date, days: days.length, kwhPerMeterDay: meters === 0 ? 0 : sum / meters, metersReporting: meters / days.length, zeroShare: all === 0 ? 0 : zero / all };
}

const factNumber = (site: ReferenceSite, item: string): number | null => {
  const value = Number(site.facts.find((fact) => fact.item === item)?.value);
  return Number.isFinite(value) && value > 0 ? value : null;
};

function capexOf(records: ReferenceBasisRecords): ReferenceCapex | null {
  const actual = (category: string) => records.capex.find((line) => line.record === "actual_cost" && line.category === category)?.costNgn ?? null;
  const storage = actual("Storage");
  const generation = actual("Generation");
  const distribution = actual("Distribution and metering");
  const shared = actual("Shared balance of system");
  const soft = actual("Soft costs");
  const total = actual("Total");
  const pvKwp = factNumber(records.site, "PV capacity");
  const storageKwh = factNumber(records.site, "Battery capacity, value used as reference");
  const connections = factNumber(records.site, "Smart meters purchased");
  const totalLine = records.capex.find((line) => line.record === "actual_cost" && line.category === "Total");
  const priceYear = totalLine?.priceYear ?? null;
  const ngnPerUsd = totalLine?.ngnPerUsd ?? null;
  if ([storage, generation, distribution, shared, soft, total, pvKwp, storageKwh, connections, priceYear, ngnPerUsd].some((value) => value === null)) return null;
  return {
    priceYear: priceYear as number,
    ngnPerUsd: ngnPerUsd as number,
    storageNgn: storage as number,
    generationNgn: generation as number,
    distributionAndMeteringNgn: distribution as number,
    otherNgn: (shared as number) + (soft as number),
    totalNgn: total as number,
    pvKwp: pvKwp as number,
    storageKwh: storageKwh as number,
    connections: connections as number,
    accounts: factNumber(records.site, "Customer accounts in the current customer file"),
  };
}

/** The recurring company-account lines in ₦ a year, summed by year: a reported floor. One-off costs and blank lines are left out. */
function opexFloorOf(lines: readonly ReferenceOpexLine[]): ReferenceOpexFloor[] {
  const byYear = new Map<number, ReferenceOpexFloor>();
  for (const line of lines) {
    if (line.amount === null || line.unit !== "NGN per year" || !line.period || !/^\d{4}$/.test(line.period)) continue;
    const year = Number(line.period);
    const floor = byYear.get(year) ?? { year, ngnPerYear: 0, items: [] };
    floor.ngnPerYear += line.amount;
    floor.items.push(line.item);
    byYear.set(year, floor);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
