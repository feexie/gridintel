import type { IsoDate, ReferenceSiteDay } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — REFERENCE SITE: SITE TOTAL AGAINST THE SUM OF METERS

   Over the days in the window that have BOTH the site total (the
   community series at the data concentrator) and the sum of the
   meters:

     gap = (Σ site total − Σ sum of meters) ÷ Σ site total
     reached = Σ sum of meters ÷ Σ site total  (= 1 − gap)

   A day with either value blank is left out, never counted as 0.
   The gap is not a technical loss: at RMG01 it holds unmetered own
   use and theft, which the data cannot split. No split is made.
========================================================== */

export const REFERENCE_METER_GAP: Methodology<Record<string, never>> = {
  id: "gridintel.reference.meter-gap",
  version: "0.1.0",
  name: "Site total against the sum of the customer meters",
  description: "The share by which the site's own total exceeds the sum of its customer meters, over the days with both.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export interface MeterGap {
  from: IsoDate;
  to: IsoDate;
  /** Days in the window with both values. */
  daysWithBoth: number;
  siteKwh: number;
  metersKwh: number;
  /** (site − meters) ÷ site; null with no day or no energy. */
  gap: number | null;
  /** meters ÷ site; null with no day or no energy. */
  reached: number | null;
}

/** The gap over [from, to], inclusive dates. */
export function meterGap(days: readonly ReferenceSiteDay[], from: IsoDate, to: IsoDate): MeterGap {
  let daysWithBoth = 0;
  let siteKwh = 0;
  let metersKwh = 0;
  for (const day of days) {
    if (day.date < from || day.date > to || day.communityKwh === null || day.sumOfMetersKwh === null) continue;
    daysWithBoth++;
    siteKwh += day.communityKwh;
    metersKwh += day.sumOfMetersKwh;
  }
  const known = daysWithBoth > 0 && siteKwh > 0;
  return { from, to, daysWithBoth, siteKwh, metersKwh, gap: known ? (siteKwh - metersKwh) / siteKwh : null, reached: known ? metersKwh / siteKwh : null };
}

/** The gap in each calendar year that has days with both values, in year order. */
export function meterGapByYear(days: readonly ReferenceSiteDay[]): MeterGap[] {
  const years = [...new Set(days.filter((day) => day.communityKwh !== null && day.sumOfMetersKwh !== null).map((day) => day.date.slice(0, 4)))].sort();
  return years.map((year) => meterGap(days, `${year}-01-01`, `${year}-12-31`));
}
