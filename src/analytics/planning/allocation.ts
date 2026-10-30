import type { Methodology } from "../core/methodology.ts";
import { methodologyRef, REFERENCE_DISCLAIMER } from "../core/methodology.ts";
import type { MethodologyRef } from "@/domain";

/* ==========================================================
   ANALYTICS — WHERE THE FIRST METERS GO, DISCO BY DISCO

   Two scores for each DisCo, from published figures:
   - need: its share of the national metering gap, how far its
     metering rate is from 100%, and its share of low-band or
     residential customers;
   - repayment risk: how much of its billing it fails to collect, and
     its ATC&C loss.
   Each component is scaled 0 to 1 across the DisCos given (the
   highest is 1). A component a DisCo has no figure for is left out of
   its score, and the score says so; it is never counted as 0.

   A tranche of meters is then split: public meters in proportion to
   each DisCo's unmetered customers weighted by need; private capital
   in proportion to unmetered customers weighted by low repayment
   risk, to a power that falls as the track record builds (1 at first:
   risk counts fully; 0 later: plain pro-rata). No DisCo receives more
   meters than it has unmetered customers. Today's pro-rata split, by
   unmetered customers alone, is given beside it.
========================================================== */

export interface AllocationParameters {
  /** Months in which a pace is held, for "months to 100%". */
  horizonMonths: number;
}

export const ALLOCATION_REFERENCE: Methodology<AllocationParameters> = {
  id: "gridintel.planning.disco-allocation",
  version: "0.1.0",
  name: "GridIntel reference DisCo allocation of meters and capital",
  description: "Need and repayment-risk scores per DisCo from published figures, and a split of a tranche of meters: public meters weighted to need, private capital weighted to low repayment risk, against a pro-rata split.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { horizonMonths: 60 },
};

export interface DiscoFacts {
  id: string;
  activeCustomers: number;
  meteredCustomers: number;
  /** Meters installed a month, recently. */
  installsPerMonth: number;
  /** Active customers added a month, recently. */
  growthPerMonth: number;
  /** Share of billing collected, 0 to 1; null when not published. */
  collectionEfficiency: number | null;
  /** ATC&C loss, 0 to 1; null when not published. */
  atccLoss: number | null;
  /** Share of customers in low bands or residential, 0 to 1; null when not published. */
  lowBandShare: number | null;
}

export interface Weights {
  need: { gapShare: number; meteringShortfall: number; lowBandShare: number };
  risk: { collectionShortfall: number; atccLoss: number };
}

export const DEFAULT_WEIGHTS: Weights = {
  need: { gapShare: 0.5, meteringShortfall: 0.3, lowBandShare: 0.2 },
  risk: { collectionShortfall: 0.5, atccLoss: 0.5 },
};

export interface ScoredDisco {
  id: string;
  unmetered: number;
  gapShare: number;
  meteringRate: number;
  /** Months to meter every customer at the recent pace; null when installs do not exceed growth. */
  monthsTo100: number | null;
  need: number;
  /** The need components that had no figure and were left out. */
  needMissing: string[];
  risk: number | null;
  riskMissing: string[];
}

export interface DiscoAllocation {
  id: string;
  proRata: number;
  publicMeters: number;
  privateMeters: number;
  /** Public and private together. */
  recommended: number;
}

export interface AllocationResult {
  methodology: MethodologyRef;
  scored: ScoredDisco[];
  allocation: DiscoAllocation[];
  totalUnmetered: number;
}

/** A weighted mean over the components that have a figure; null when none has. */
function weighted(parts: { value: number | null; weight: number; name: string }[]): { score: number | null; missing: string[] } {
  const present = parts.filter((part) => part.value !== null && part.weight > 0);
  const missing = parts.filter((part) => part.value === null && part.weight > 0).map((part) => part.name);
  const total = present.reduce((sum, part) => sum + part.weight, 0);
  if (total === 0) return { score: null, missing };
  return { score: present.reduce((sum, part) => sum + part.weight * (part.value as number), 0) / total, missing };
}

/** Each value divided by the largest of them; nulls stay null. */
function scaled(values: (number | null)[]): (number | null)[] {
  const largest = Math.max(0, ...values.filter((value): value is number => value !== null));
  return values.map((value) => (value === null ? null : largest === 0 ? 0 : value / largest));
}

export function scoreDiscos(discos: DiscoFacts[], weights: Weights = DEFAULT_WEIGHTS): ScoredDisco[] {
  const unmetered = discos.map((disco) => Math.max(0, disco.activeCustomers - disco.meteredCustomers));
  const total = unmetered.reduce((sum, value) => sum + value, 0);
  const gap = scaled(unmetered.map((value) => (total === 0 ? 0 : value / total)));
  const shortfall = scaled(discos.map((disco) => 1 - disco.meteredCustomers / disco.activeCustomers));
  const lowBand = scaled(discos.map((disco) => disco.lowBandShare));
  const collection = scaled(discos.map((disco) => (disco.collectionEfficiency === null ? null : 1 - disco.collectionEfficiency)));
  const atcc = scaled(discos.map((disco) => disco.atccLoss));
  return discos.map((disco, index) => {
    const need = weighted([
      { value: gap[index], weight: weights.need.gapShare, name: "share of the gap" },
      { value: shortfall[index], weight: weights.need.meteringShortfall, name: "metering rate" },
      { value: lowBand[index], weight: weights.need.lowBandShare, name: "low-band share" },
    ]);
    const risk = weighted([
      { value: collection[index], weight: weights.risk.collectionShortfall, name: "collection efficiency" },
      { value: atcc[index], weight: weights.risk.atccLoss, name: "ATC&C loss" },
    ]);
    const net = disco.installsPerMonth - disco.growthPerMonth;
    return {
      id: disco.id,
      unmetered: unmetered[index],
      gapShare: total === 0 ? 0 : unmetered[index] / total,
      meteringRate: disco.meteredCustomers / disco.activeCustomers,
      monthsTo100: net > 0 ? unmetered[index] / net : null,
      need: need.score ?? 0,
      needMissing: need.missing,
      risk: risk.score,
      riskMissing: risk.missing,
    };
  });
}

/** Splits `meters` in proportion to `weights`, never giving one more than `limits`; what a limit holds back goes to the rest. */
function split(meters: number, weights: number[], limits: number[]): number[] {
  const result = weights.map(() => 0);
  let left = meters;
  let open = weights.map((weight, index) => weight > 0 && limits[index] > 0);
  for (let round = 0; round < weights.length && left > 1e-9; round++) {
    const total = weights.reduce((sum, weight, index) => sum + (open[index] ? weight : 0), 0);
    if (total === 0) break;
    let given = 0;
    weights.forEach((weight, index) => {
      if (!open[index]) return;
      const share = Math.min((left * weight) / total, limits[index] - result[index]);
      result[index] += share;
      given += share;
    });
    left -= given;
    open = open.map((isOpen, index) => isOpen && result[index] < limits[index] - 1e-9);
  }
  return result;
}

/**
 * The split of a tranche: `publicMeters` weighted to need, `privateMeters` weighted to low repayment
 * risk to the power `riskEmphasis` (1 at first, 0 when the track record is built), against pro-rata.
 */
export function allocateTranche(scored: ScoredDisco[], publicMeters: number, privateMeters: number, riskEmphasis = 1, methodology = ALLOCATION_REFERENCE): AllocationResult {
  const unmetered = scored.map((disco) => disco.unmetered);
  const totalUnmetered = unmetered.reduce((sum, value) => sum + value, 0);
  const proRata = split(publicMeters + privateMeters, unmetered, unmetered);
  const publicSplit = split(publicMeters, scored.map((disco) => disco.unmetered * disco.need), unmetered);
  const room = unmetered.map((value, index) => value - publicSplit[index]);
  // A DisCo with no risk figure is treated as the riskiest for private capital until it publishes one.
  const privateSplit = split(privateMeters, scored.map((disco) => disco.unmetered * Math.pow(1 - (disco.risk ?? 1), riskEmphasis)), room);
  return {
    methodology: methodologyRef(methodology),
    scored,
    totalUnmetered,
    allocation: scored.map((disco, index) => ({
      id: disco.id,
      proRata: proRata[index],
      publicMeters: publicSplit[index],
      privateMeters: privateSplit[index],
      recommended: publicSplit[index] + privateSplit[index],
    })),
  };
}
