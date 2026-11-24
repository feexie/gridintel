import type { ReferenceMeterDay, ReferenceSiteDay } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — REFERENCE SITE: METERED USE BY YEAR

   For each calendar year, over the days with meter data:
   - days with data, the sum of the meters' kWh and its mean a day;
   - the mean number of meters reporting;
   - kWh per reporting meter-day = Σ kWh ÷ Σ meters reporting;
   - the share of meter-days that are 0 kWh (a 0 can be no use, a
     switched-off meter or no supply; the data does not say which).

   Days with no meter data are left out, never counted as 0. The
   sum of the meters under-counts the site total (meterGap.ts).
========================================================== */

export const REFERENCE_USE: Methodology<Record<string, never>> = {
  id: "gridintel.reference.use",
  version: "0.1.0",
  name: "Metered use by year",
  description: "The sum of the customer meters by calendar year, per day and per reporting meter, with the share of zero meter-days.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export interface UseYear {
  year: number;
  daysInData: number;
  daysWithMeterData: number;
  metersKwh: number;
  kwhPerDay: number | null;
  meanMetersReporting: number | null;
  kwhPerReportingMeterDay: number | null;
  zeroMeterDayShare: number | null;
}

export function meteredUseByYear(days: readonly ReferenceSiteDay[], meterDays: readonly ReferenceMeterDay[]): UseYear[] {
  const years = new Map<number, { daysInData: number; withData: number; kwh: number; meters: number; meterDays: number; zero: number }>();
  const year = (date: string) => Number(date.slice(0, 4));
  const at = (key: number) => {
    let entry = years.get(key);
    if (!entry) years.set(key, (entry = { daysInData: 0, withData: 0, kwh: 0, meters: 0, meterDays: 0, zero: 0 }));
    return entry;
  };
  for (const day of days) {
    const entry = at(year(day.date));
    entry.daysInData++;
    if (day.sumOfMetersKwh === null || day.metersReporting === null) continue;
    entry.withData++;
    entry.kwh += day.sumOfMetersKwh;
    entry.meters += day.metersReporting;
  }
  for (const meterDay of meterDays) {
    const entry = at(year(meterDay.date));
    entry.meterDays++;
    if (meterDay.kwh === 0) entry.zero++;
  }
  return [...years.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, entry]) => ({
      year: key,
      daysInData: entry.daysInData,
      daysWithMeterData: entry.withData,
      metersKwh: entry.kwh,
      kwhPerDay: entry.withData > 0 ? entry.kwh / entry.withData : null,
      meanMetersReporting: entry.withData > 0 ? entry.meters / entry.withData : null,
      kwhPerReportingMeterDay: entry.meters > 0 ? entry.kwh / entry.meters : null,
      zeroMeterDayShare: entry.meterDays > 0 ? entry.zero / entry.meterDays : null,
    }));
}
