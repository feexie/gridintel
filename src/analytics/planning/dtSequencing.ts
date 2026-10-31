import type { Methodology } from "../core/methodology.ts";
import { methodologyRef, REFERENCE_DISCLAIMER } from "../core/methodology.ts";
import type { MethodologyRef } from "@/domain";

/* ==========================================================
   ANALYTICS — WHICH DISTRIBUTION TRANSFORMER TO METER FIRST

   Inside one DisCo, every distribution transformer (DT) with
   unmetered customers is ranked by the revenue a year that metering
   them recovers, per naira of CAPEX:
   - CAPEX = unmetered customers × the installed cost of a meter;
   - recovered a year = 12 × (the estimated billing on the DT a month
     × the share of it recovered once metered
     + the DT's commercial loss a month × the unmetered customers'
     share of its connections × the share of it recovered).
   A part with no figure (a DT with no boundary meter has no loss) is
   left out of the DT's figure and named; it is never counted as 0.

   The revolving effect: a fixed budget a month buys meters in an
   order, and what the meters already installed recover is spent on
   more meters. The ranked order is run against a fixed shuffled
   order, with the same budget, so the two can be compared. The
   shuffle is seeded: it is the same order on every run.

   Every input is passed in. Nothing here reads the clock, a file or
   an unseeded random number.
========================================================== */

export interface DtSequencingParameters {
  /** The seed of the fixed shuffled order the ranked order is compared with. */
  shuffleSeed: number;
}

export const DT_SEQUENCING_REFERENCE: Methodology<DtSequencingParameters> = {
  id: "gridintel.planning.dt-sequencing",
  version: "0.1.0",
  name: "GridIntel reference DT sequencing for metering",
  description:
    "Distribution transformers ranked by the revenue a year metering their unmetered customers recovers per naira of CAPEX, from estimated billing and commercial loss on each DT; the revolving effect of that order against a fixed shuffled order with the same budget.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { shuffleSeed: 15 },
};

export interface DtFacts {
  id: string;
  connections: number;
  unmetered: number;
  /** Estimated billing on the DT a month, in naira; null when no billing is held. */
  estimatedBillingPerMonth: number | null;
  /** The value of energy delivered to the DT and not billed, a month, in naira; null without a boundary meter. */
  commercialLossPerMonth: number | null;
}

export interface DtRecovery {
  /** The share of a DT's estimated billing recovered once its customers are metered, 0 to 1. */
  estimatedBilling: number;
  /** The share of the unmetered customers' part of the commercial loss recovered, 0 to 1. */
  commercialLoss: number;
}

export interface RankedDt {
  id: string;
  /** 1 for the first to meter; null for a DT with no unmetered customer. */
  rank: number | null;
  unmetered: number;
  capex: number;
  fromEstimatedBilling: number | null;
  fromCommercialLoss: number | null;
  recoveredPerYear: number;
  /** Recovered a year per naira of CAPEX; null with nothing to meter. */
  perNaira: number | null;
  missing: ("estimated billing" | "commercial loss")[];
}

export function rankDts(dts: readonly DtFacts[], costPerMeter: number, recovery: DtRecovery): RankedDt[] {
  const scored = dts.map((dt): RankedDt => {
    const missing: RankedDt["missing"] = [];
    if (dt.estimatedBillingPerMonth === null) missing.push("estimated billing");
    if (dt.commercialLossPerMonth === null) missing.push("commercial loss");
    const fromEstimatedBilling = dt.estimatedBillingPerMonth === null ? null : 12 * dt.estimatedBillingPerMonth * recovery.estimatedBilling;
    // A negative loss (more billed than delivered) recovers nothing; it is not netted.
    const fromCommercialLoss =
      dt.commercialLossPerMonth === null || dt.connections === 0 ? null : 12 * Math.max(0, dt.commercialLossPerMonth) * (dt.unmetered / dt.connections) * recovery.commercialLoss;
    const recoveredPerYear = (fromEstimatedBilling ?? 0) + (fromCommercialLoss ?? 0);
    const capex = dt.unmetered * costPerMeter;
    return { id: dt.id, rank: null, unmetered: dt.unmetered, capex, fromEstimatedBilling, fromCommercialLoss, recoveredPerYear, perNaira: capex > 0 ? recoveredPerYear / capex : null, missing };
  });
  const order = scored.filter((dt) => dt.perNaira !== null).sort((a, b) => b.perNaira! - a.perNaira! || a.id.localeCompare(b.id));
  order.forEach((dt, index) => (dt.rank = index + 1));
  return [...order, ...scored.filter((dt) => dt.perNaira === null)];
}

/** The DTs to meter in a fixed shuffled order: a seeded Fisher–Yates shuffle, the same on every run. */
export function shuffledOrder<T>(items: readonly T[], seed = DT_SEQUENCING_REFERENCE.parameters.shuffleSeed): T[] {
  let state = seed >>> 0;
  const next = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RevolvingMonth {
  month: number;
  metersInstalled: number;
  capex: number;
  /** Recovered revenue up to the month. */
  recovered: number;
}

export interface RevolvingRun {
  months: RevolvingMonth[];
  /** The month every unmetered customer in the order is metered; null if not within the months run. */
  monthAllMetered: number | null;
}

/**
 * Meters bought in the order given with `budgetPerMonth`, plus what installed meters recover each
 * month, spent on more meters (the fund revolving). Meters are bought one by one and a DT may be
 * metered over several months; a meter recovers from the month after it is installed.
 */
export function revolve(order: readonly RankedDt[], budgetPerMonth: number, months: number): RevolvingRun {
  const queue = order.filter((dt) => dt.unmetered > 0).map((dt) => ({ left: dt.unmetered, costPerMeter: dt.capex / dt.unmetered, recoveredPerMeterMonth: dt.recoveredPerYear / 12 / dt.unmetered }));
  const total = queue.reduce((sum, dt) => sum + dt.left, 0);
  let cash = 0;
  let recoveringPerMonth = 0;
  let installed = 0;
  let capex = 0;
  let recovered = 0;
  let monthAllMetered: number | null = total === 0 ? 0 : null;
  const out: RevolvingMonth[] = [{ month: 0, metersInstalled: 0, capex: 0, recovered: 0 }];
  let at = 0;
  for (let month = 1; month <= months; month++) {
    recovered += recoveringPerMonth;
    cash += budgetPerMonth + recoveringPerMonth;
    let added = 0;
    while (at < queue.length && cash >= queue[at].costPerMeter) {
      const dt = queue[at];
      const meters = Math.min(dt.left, Math.floor(cash / dt.costPerMeter));
      cash -= meters * dt.costPerMeter;
      capex += meters * dt.costPerMeter;
      installed += meters;
      dt.left -= meters;
      added += meters * dt.recoveredPerMeterMonth;
      if (dt.left === 0) at++;
    }
    recoveringPerMonth += added;
    if (monthAllMetered === null && installed >= total) monthAllMetered = month;
    out.push({ month, metersInstalled: installed, capex, recovered });
  }
  return { months: out, monthAllMetered };
}

export function dtSequencingMethodology(): MethodologyRef {
  return methodologyRef(DT_SEQUENCING_REFERENCE);
}
