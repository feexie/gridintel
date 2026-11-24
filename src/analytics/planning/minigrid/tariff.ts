import type { ReferenceBasis, ReferenceTariffChange } from "@/domain";
import type { Methodology } from "../../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../../core/methodology.ts";

/* ==========================================================
   ANALYTICS — MINI-GRID PLANNING: TARIFF RESPONSE
   (gridintel.planning.minigrid-tariff-response 0.1.0; MG-PLAN.md 3.2 (3))

   kWh(t) = kWh(t₀) × (t ÷ t₀)^e; revenue = kWh × t. e = −1 is a
   fixed budget (spend unchanged), e = 0 no response.

   Each tariff change at a reference site gives its own e:
   ln(use after ÷ use before) ÷ ln(tariff after ÷ tariff before), on
   use per reporting meter-day (kWh only, never payments), with its
   windows, days and what else changed.

   Scenarios: the fixed budget (e = −1) as the middle case, each
   reference change whose e is not positive, and the user's e. A
   positive e (use rising with the price) is not a price response:
   such a change is shown with its confounders, labelled "not usable
   as a price response", and left out of every scenario and the range;
   a positive user e is left out the same way (Founder, 24 November
   2026). No single combined e is ever given.
========================================================== */

export const MINIGRID_TARIFF_RESPONSE_REFERENCE: Methodology<Record<string, never>> = {
  id: "gridintel.planning.minigrid-tariff-response",
  version: "0.1.0",
  name: "GridIntel reference tariff response for a planned mini-grid",
  description: "kWh and revenue a day under tariff options: the fixed budget as the middle case, each reference tariff change whose elasticity is not positive, and the user's; a positive elasticity is shown and left out.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export const NOT_A_PRICE_RESPONSE = "not usable as a price response";

/** kWh a day at a tariff, from kWh a day at a base tariff and an elasticity. */
export function kwhAtTariff(baseKwh: number, baseTariff: number, tariff: number, elasticity: number): number {
  return baseKwh * (tariff / baseTariff) ** elasticity;
}

/** A tariff change's own elasticity; null when the tariff did not change or use is not positive on both sides. */
export function changeElasticity(change: ReferenceTariffChange): number | null {
  const { before, after } = change;
  if (change.toTariff === change.fromTariff || before.kwhPerMeterDay <= 0 || after.kwhPerMeterDay <= 0) return null;
  return Math.log(after.kwhPerMeterDay / before.kwhPerMeterDay) / Math.log(change.toTariff / change.fromTariff);
}

export interface TariffRow {
  tariff: number;
  kwhPerDay: number;
  revenuePerDay: number;
}

export interface TariffChangeShown {
  siteId: string;
  id: string;
  fromTariff: number;
  toTariff: number;
  before: string;
  after: string;
  days: { before: number; after: number };
  confounders: string[];
}

export interface TariffScenario {
  kind: "fixed_budget" | "reference_change" | "user";
  label: string;
  elasticity: number;
  /** The fixed budget is the middle case. */
  middle: boolean;
  rows: TariffRow[];
  change?: TariffChangeShown;
}

/** A change, or a user figure, whose elasticity is positive: shown, never used. */
export interface UnusableResponse {
  kind: "reference_change" | "user";
  label: string;
  elasticity: number;
  reason: string;
  change?: TariffChangeShown;
}

export interface TariffResponseResult {
  baseKwh: number;
  baseTariff: number;
  scenarios: TariffScenario[];
  /** The scenarios' elasticities, low to high; never a single combined figure. */
  range: { low: number; high: number };
  unusable: UnusableResponse[];
  note: string | null;
  referenceSites: number;
  method: { id: string; version: string };
}

export function tariffResponse(input: { baseKwh: number; baseTariff: number; tariffs: readonly number[]; userElasticity: number | null; bases: readonly ReferenceBasis[] }): TariffResponseResult {
  const { baseKwh, baseTariff, tariffs } = input;
  const rows = (elasticity: number): TariffRow[] =>
    tariffs.map((tariff) => {
      const kwhPerDay = kwhAtTariff(baseKwh, baseTariff, tariff, elasticity);
      return { tariff, kwhPerDay, revenuePerDay: kwhPerDay * tariff };
    });
  const scenarios: TariffScenario[] = [{ kind: "fixed_budget", label: "Fixed budget (e = −1), the middle case", elasticity: -1, middle: true, rows: rows(-1) }];
  const unusable: UnusableResponse[] = [];
  const sites = new Set<string>();
  for (const basis of input.bases) {
    for (const change of basis.tariffChanges) {
      const elasticity = changeElasticity(change);
      if (elasticity === null) continue;
      const label = `${basis.siteCode}: ₦${change.fromTariff} to ₦${change.toTariff}`;
      const shown: TariffChangeShown = {
        siteId: basis.siteId,
        id: change.id,
        fromTariff: change.fromTariff,
        toTariff: change.toTariff,
        before: `${change.before.start} to ${change.before.end}`,
        after: `${change.after.start} to ${change.after.end}`,
        days: { before: change.before.days, after: change.after.days },
        confounders: change.confounders,
      };
      if (elasticity > 0) {
        unusable.push({ kind: "reference_change", label, elasticity, reason: `Use rose with the price: ${NOT_A_PRICE_RESPONSE}`, change: shown });
        continue;
      }
      sites.add(basis.siteId);
      scenarios.push({ kind: "reference_change", label, elasticity, middle: false, rows: rows(elasticity), change: shown });
    }
  }
  const user = input.userElasticity;
  if (user !== null) {
    if (user > 0) unusable.push({ kind: "user", label: `Your elasticity (e = ${user})`, elasticity: user, reason: `A positive elasticity is ${NOT_A_PRICE_RESPONSE}` });
    else scenarios.push({ kind: "user", label: `Your elasticity (e = ${user})`, elasticity: user, middle: false, rows: rows(user) });
  }
  const used = scenarios.map((scenario) => scenario.elasticity);
  return {
    baseKwh,
    baseTariff,
    scenarios,
    range: { low: Math.min(...used), high: Math.max(...used) },
    unusable,
    note: unusable.length === 0 ? null : `${unusable.map((one) => `${one.label} (e = ${one.elasticity >= 0 ? "+" : ""}${one.elasticity.toFixed(2)})`).join("; ")}: ${NOT_A_PRICE_RESPONSE}, shown with ${unusable.length === 1 ? "its" : "their"} confounders and left out of the scenarios`,
    referenceSites: sites.size,
    method: { id: MINIGRID_TARIFF_RESPONSE_REFERENCE.id, version: MINIGRID_TARIFF_RESPONSE_REFERENCE.version },
  };
}
