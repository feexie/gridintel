import type { DataSource, MeteringMonitoringRecord, MeteringPlanQuarter } from "@/domain";
import type { MonitoringRepository } from "../ports/monitoring.ts";
import { seeded } from "./rng.ts";

/* ==========================================================
   DEMO ADAPTER — SYNTHETIC MONITORING OF THE METERING PROGRAMME

   Designed records of the programme's first quarter, July to
   September 2026, one per DisCo, drawn against the plan it is given
   so the screen can show plan against actual. They describe no real
   installation, supply, payment or repayment. Only quarters that end
   by the demonstration clock (1 October 2026) have records; later
   quarters have none, and are shown as not yet reported.
========================================================== */

export const SYNTHETIC_MONITORING_SOURCE: DataSource = {
  id: "synthetic-metering-monitoring",
  name: "Synthetic metering programme monitoring (designed records)",
  kind: "synthetic",
  description: "A designed first quarter of the metering programme, one record per DisCo. It describes no real installation or payment.",
};

const RECORDED_QUARTERS = new Set(["2026-Q3"]);

const between = (random: () => number, low: number, high: number) => low + (high - low) * random();

export function createSyntheticMonitoring(plan: readonly MeteringPlanQuarter[]): MonitoringRepository {
  const records: MeteringMonitoringRecord[] = plan
    .filter((row) => RECORDED_QUARTERS.has(row.quarter))
    .map((row) => {
      const random = seeded(`monitoring:${row.disco}:${row.quarter}`);
      const installed = Math.round(row.plannedMeters * between(random, 0.55, 1.05));
      const verified = Math.round(installed * between(random, 0.82, 1));
      // Meters are installed through the quarter: on average each is in place for half of it.
      const meterMonths = verified * 1.5;
      const escrow = Math.round(meterMonths * between(random, 170, 300));
      return {
        disco: row.disco,
        quarter: row.quarter,
        metersInstalled: installed,
        metersVerified: verified,
        supplyHoursPerDay: Math.round(between(random, 8, 17) * 10) / 10,
        consumptionKwhPerMonth: Math.round(between(random, 70, 115)),
        escrowCollected: escrow,
        investorRepaid: Math.round(escrow * between(random, 0.85, 1)),
        sourceId: SYNTHETIC_MONITORING_SOURCE.id,
      };
    });
  return {
    records: async () => records,
    sources: async () => [SYNTHETIC_MONITORING_SOURCE],
  };
}
