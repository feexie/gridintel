import type { HubSwapDay } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";

/* ==========================================================
   ANALYTICS — E-MOBILITY: AN INSTALLED HUB AGAINST ITS PLAN

   Over the days recorded: swaps against the planned swaps a day ×
   days; energy charged against planned energy (the planned day's
   kWh × days); availability = minutes the hub could swap ÷ minutes
   in the days recorded. A hub with no days recorded has no figure,
   never 0.
========================================================== */

export const EMOBILITY_VERIFY_REFERENCE: Methodology<Record<string, never>> = {
  id: "gridintel.planning.emobility-verify",
  version: "0.1.0",
  name: "GridIntel reference hub performance against plan",
  description: "Swaps, energy charged and availability of an installed hub over the days recorded, against its planned swaps and energy a day.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export interface HubAgainstPlan {
  days: number;
  swaps: number;
  plannedSwaps: number;
  /** Swaps ÷ planned swaps. */
  swapsShare: number | null;
  kwhCharged: number;
  plannedKwh: number;
  kwhShare: number | null;
  /** Minutes available ÷ minutes in the days recorded. */
  availability: number | null;
}

export function hubAgainstPlan(days: readonly HubSwapDay[], plannedSwapsPerDay: number, plannedKwhPerDay: number): HubAgainstPlan | null {
  if (days.length === 0) return null;
  const swaps = days.reduce((sum, day) => sum + day.swaps, 0);
  const kwhCharged = days.reduce((sum, day) => sum + day.kwhCharged, 0);
  const minutes = days.reduce((sum, day) => sum + day.minutesAvailable, 0);
  const plannedSwaps = plannedSwapsPerDay * days.length;
  const plannedKwh = plannedKwhPerDay * days.length;
  return {
    days: days.length,
    swaps,
    plannedSwaps,
    swapsShare: plannedSwaps > 0 ? swaps / plannedSwaps : null,
    kwhCharged,
    plannedKwh,
    kwhShare: plannedKwh > 0 ? kwhCharged / plannedKwh : null,
    availability: minutes / (days.length * 1_440),
  };
}
