import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — MONITORING THE METERING PROGRAMME

   Plan against actual for one DisCo in one quarter:
   - the plan spreads the DisCo's meters evenly over the quarters;
   - fund money is released in tranches against verified installs
     (results-based): a tranche pays for verified meters at the cost
     of a meter, and what the plan expected beyond them is held;
   - planned escrow = planned meters × the months each is in place on
     average (half the quarter) × the charge a meter a month; in the
     GridIntel structure escrow repays investors, so planned
     repayment is planned escrow.
   A figure with no input (a DisCo with no tariff for the band, a
   quarter with no record) is null, never 0.
========================================================== */

export interface MonitoringParameters {
  /** Months a meter installed in a quarter is in place in that quarter, on average. */
  monthsInPlaceInQuarter: number;
  /** Verified installs below this share of plan count as behind. */
  behindBelow: number;
}

export const MONITORING_REFERENCE: Methodology<MonitoringParameters> = {
  id: "gridintel.planning.monitoring",
  version: "0.1.0",
  name: "GridIntel reference monitoring of a metering programme",
  description: "Plan against actual per DisCo per quarter: installs, verified installs, results-based tranches, escrow and investor repayment.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { monthsInPlaceInQuarter: 1.5, behindBelow: 0.9 },
};

/** A total spread evenly over quarters, in whole meters; the remainder goes to the first quarters. */
export function spreadOverQuarters(total: number, quarters: number): number[] {
  const whole = Math.floor(total / quarters);
  const left = Math.round(total - whole * quarters);
  return Array.from({ length: quarters }, (_, index) => whole + (index < left ? 1 : 0));
}

export interface QuarterActual {
  metersInstalled: number;
  metersVerified: number;
  escrowCollected: number;
  investorRepaid: number;
}

export interface QuarterComparison {
  /** Verified installs ÷ planned meters; null with no plan. */
  againstPlan: number | null;
  behind: boolean;
  trancheReleased: number;
  trancheHeld: number;
  /** Null when there is no charge to plan with. */
  escrowPlan: number | null;
}

export function compareQuarter(plannedMeters: number, actual: QuarterActual, costPerMeter: number, chargePerMeterMonth: number | null, methodology = MONITORING_REFERENCE): QuarterComparison {
  const againstPlan = plannedMeters > 0 ? actual.metersVerified / plannedMeters : null;
  return {
    againstPlan,
    behind: againstPlan !== null && againstPlan < methodology.parameters.behindBelow,
    trancheReleased: actual.metersVerified * costPerMeter,
    trancheHeld: Math.max(0, plannedMeters - actual.metersVerified) * costPerMeter,
    escrowPlan: planEscrow(plannedMeters, chargePerMeterMonth, methodology),
  };
}

export function planEscrow(plannedMeters: number, chargePerMeterMonth: number | null, methodology = MONITORING_REFERENCE): number | null {
  return chargePerMeterMonth === null ? null : plannedMeters * methodology.parameters.monthsInPlaceInQuarter * chargePerMeterMonth;
}
