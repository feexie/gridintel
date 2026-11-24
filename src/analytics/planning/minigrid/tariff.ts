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

   Scenarios side by side: the fixed budget, each change's own e, and
   the user's e. Where the changes give elasticities of opposite sign
   the result gives their range, low to high, with "the reference
   events disagree", and never a single figure or an average
   (Founder, 24 November 2026). No single combined e is ever given.
========================================================== */

export const MINIGRID_TARIFF_RESPONSE_REFERENCE: Methodology<Record<string, never>> = {
  id: "gridintel.planning.minigrid-tariff-response",
  version: "0.1.0",
  name: "GridIntel reference tariff response for a planned mini-grid",
  description: "kWh and revenue a day under tariff options, for a fixed budget, each reference tariff change's own elasticity and the user's; the range where the changes disagree.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: {},
};

export const EVENTS_DISAGREE = "the reference events disagree";

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

export interface TariffScenario {
  kind: "fixed_budget" | "reference_change" | "user";
  label: string;
  elasticity: number;
  rows: TariffRow[];
  /** For a reference change: its site, windows, days and what else changed. */
  change?: { siteId: string; id: string; fromTariff: number; toTariff: number; before: string; after: string; days: { before: number; after: number }; confounders: string[] };
}

export interface TariffResponseResult {
  baseKwh: number;
  baseTariff: number;
  scenarios: TariffScenario[];
  /** "agree" when every change's e has one sign; "disagree" when signs differ; "one" or "none" otherwise. */
  agreement: "agree" | "disagree" | "one" | "none";
  /** The reference changes' elasticities, low to high, when there are two or more. */
  range: { low: number; high: number } | null;
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
  const scenarios: TariffScenario[] = [{ kind: "fixed_budget", label: "Fixed budget (e = −1)", elasticity: -1, rows: rows(-1) }];
  const fitted: number[] = [];
  const sites = new Set<string>();
  for (const basis of input.bases) {
    for (const change of basis.tariffChanges) {
      const elasticity = changeElasticity(change);
      if (elasticity === null) continue;
      fitted.push(elasticity);
      sites.add(basis.siteId);
      scenarios.push({
        kind: "reference_change",
        label: `${basis.siteCode}: ₦${change.fromTariff} to ₦${change.toTariff}`,
        elasticity,
        rows: rows(elasticity),
        change: {
          siteId: basis.siteId,
          id: change.id,
          fromTariff: change.fromTariff,
          toTariff: change.toTariff,
          before: `${change.before.start} to ${change.before.end}`,
          after: `${change.after.start} to ${change.after.end}`,
          days: { before: change.before.days, after: change.after.days },
          confounders: change.confounders,
        },
      });
    }
  }
  if (input.userElasticity !== null) scenarios.push({ kind: "user", label: `Your elasticity (e = ${input.userElasticity})`, elasticity: input.userElasticity, rows: rows(input.userElasticity) });

  const positive = fitted.some((e) => e > 0);
  const negative = fitted.some((e) => e < 0);
  const agreement = fitted.length === 0 ? "none" : fitted.length === 1 ? "one" : positive && negative ? "disagree" : "agree";
  return {
    baseKwh,
    baseTariff,
    scenarios,
    agreement,
    range: fitted.length < 2 ? null : { low: Math.min(...fitted), high: Math.max(...fitted) },
    note: agreement === "disagree" ? `${EVENTS_DISAGREE}: their elasticities run from ${Math.min(...fitted).toFixed(2)} to ${Math.max(...fitted).toFixed(2)}, and no single figure is given` : null,
    referenceSites: sites.size,
    method: { id: MINIGRID_TARIFF_RESPONSE_REFERENCE.id, version: MINIGRID_TARIFF_RESPONSE_REFERENCE.version },
  };
}
