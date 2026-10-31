import type { DiscoId, FunderKind, MarketplaceBand } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — THE METERING MARKETPLACE: MATCHING PLEDGES TO DEMAND

   - A daily meter charge, by band, is owed every day. At each
     recharge what is owed is taken into escrow, but never more than
     half of the recharge; the rest is carried to the next recharge.
     Lifeline (R1) customers are exempt.
   - Months to repay a meter = its installed cost ÷ (the charge a day
     × days in a month); with a funder's return, the months for the
     charge a month to repay the cost as a loan at that rate.
   - Bands C to E (0.2.0): the customer's charge is a share of the
     band's typical bill; over a fixed repayment period it repays part
     of the meter, and a blended top-up (DFI or public money) covers
     the rest.
   - Matching: pledges in order of the return they ask, lowest first
     (then the pledge with fewer DisCos first, then by id). A pledge
     funds a band only when its kind allows it (private money Bands A
     and B; DFI money Bands C to E; public money Bands C to E and
     Lifeline), the pledge lists the band and the DisCo, and the
     band's months to repay fit within the pledge's tenor (a grant
     has no tenor and is not repaid). Applications are taken poorest
     band first (Lifeline, E, D, C, B, A three-phase, A
     single-phase), then by DisCo. A meter is matched only when the
     pledge has its full installed cost left. What a pledge cannot
     place is queued for the next allocation.
========================================================== */

export interface MarketplaceParameters {
  /** Days in an average month. */
  daysPerMonth: number;
  /** The most of a recharge that may go to the meter charge. */
  maxShareOfRecharge: number;
}

export const MARKETPLACE_REFERENCE: Methodology<MarketplaceParameters> = {
  id: "gridintel.planning.marketplace",
  version: "0.2.0",
  name: "GridIntel reference matching of metering pledges to approved applications",
  description: "Daily meter charge by band taken at each recharge (at most half of it) into escrow; pledges matched to approved meter applications by funder kind, band, DisCo and tenor.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { daysPerMonth: 30.4, maxShareOfRecharge: 0.5 },
};

/** The order applications are taken in: poorest band first. */
export const BAND_ORDER: readonly MarketplaceBand[] = ["lifeline", "E", "D", "C", "B", "A3", "A1"];

const ALLOWED: Record<FunderKind, readonly MarketplaceBand[]> = {
  private: ["A1", "A3", "B"],
  dfi: ["C", "D", "E"],
  public: ["C", "D", "E", "lifeline"],
};

/** The bands a kind of funder may fund. */
export function allowedBands(kind: FunderKind): readonly MarketplaceBand[] {
  return ALLOWED[kind];
}

/** Months to repay a meter from its daily charge; null when the band is exempt (no charge). */
export function monthsToRepay(meterCost: number, chargePerDay: number | null, methodology = MARKETPLACE_REFERENCE): number | null {
  return chargePerDay === null || chargePerDay <= 0 ? null : meterCost / (chargePerDay * methodology.parameters.daysPerMonth);
}

/** Months for a monthly charge to repay a meter's cost as a loan at a yearly rate (monthly compounding); null when the charge never repays it. */
export function monthsToRepayWithReturn(meterCost: number, chargePerDay: number | null, ratePerYear: number, methodology = MARKETPLACE_REFERENCE): number | null {
  if (ratePerYear <= 0) return monthsToRepay(meterCost, chargePerDay, methodology);
  if (chargePerDay === null || chargePerDay <= 0) return null;
  const perMonth = chargePerDay * methodology.parameters.daysPerMonth;
  const rate = ratePerYear / 12;
  const owedShare = (meterCost * rate) / perMonth;
  return owedShare >= 1 ? null : -Math.log(1 - owedShare) / Math.log(1 + rate);
}

/** A band whose charge repays only part of the meter: what the customer repays over the period, and the top-up that covers the rest. */
export function blendedShare(meterCost: number, chargePerDay: number, repaymentMonths: number, methodology = MARKETPLACE_REFERENCE): { customerRepays: number; topUp: number } {
  const customerRepays = Math.min(meterCost, chargePerDay * methodology.parameters.daysPerMonth * repaymentMonths);
  return { customerRepays, topUp: meterCost - customerRepays };
}

/** At a recharge: what goes into escrow (what is owed, at most half the recharge) and what is carried to the next one. */
export function takeAtRecharge(owed: number, recharge: number, methodology = MARKETPLACE_REFERENCE): { toEscrow: number; carried: number } {
  const toEscrow = Math.max(0, Math.min(owed, recharge * methodology.parameters.maxShareOfRecharge));
  return { toEscrow, carried: owed - toEscrow };
}

/** Month by month: the charge a month into escrow until the meter's cost, with the funder's return on the balance, is repaid; the last month pays only what is left. */
export function repaymentSchedule(meterCost: number, chargePerDay: number, ratePerYear = 0, methodology = MARKETPLACE_REFERENCE): { month: number; paid: number; balance: number }[] {
  const perMonth = chargePerDay * methodology.parameters.daysPerMonth;
  if (perMonth <= 0 || meterCost <= 0 || meterCost * (ratePerYear / 12) >= perMonth) return [];
  const rows: { month: number; paid: number; balance: number }[] = [];
  let balance = meterCost;
  for (let month = 1; balance > 1e-6; month++) {
    balance *= 1 + ratePerYear / 12;
    const paid = Math.min(perMonth, balance);
    balance -= paid;
    rows.push({ month, paid, balance: balance < 1e-6 ? 0 : balance });
  }
  return rows;
}

export interface BandTerms {
  band: MarketplaceBand;
  /** Installed cost of the meter the band needs, in naira. */
  meterCost: number;
  /** Naira a day; null when exempt. */
  chargePerDay: number | null;
  /** Set for a band repaid partly by the customer and partly by a top-up: the months the customer's charge runs. */
  blendedMonths?: number;
}

export interface PledgeInput {
  id: string;
  kind: FunderKind;
  amountNaira: number;
  bands: readonly MarketplaceBand[];
  discos: readonly DiscoId[];
  returnPercent: number;
  tenorMonths: number | null;
}

export interface DemandInput {
  disco: DiscoId;
  band: MarketplaceBand;
  approved: number;
}

export interface Match {
  pledgeId: string;
  disco: DiscoId;
  band: MarketplaceBand;
  meters: number;
  naira: number;
}

export interface MatchResult {
  matches: Match[];
  /** By pledge id: money placed and money queued for the next allocation. */
  pledges: Record<string, { placed: number; queued: number; meters: number }>;
  /** Applications left with no funder, by DisCo and band. */
  waiting: DemandInput[];
}

/** Whether a pledge may fund a band: kind, the pledge's own bands, and months to repay within its tenor. */
export function canFund(pledge: PledgeInput, terms: BandTerms, methodology = MARKETPLACE_REFERENCE): boolean {
  if (!allowedBands(pledge.kind).includes(terms.band) || !pledge.bands.includes(terms.band)) return false;
  // An exempt band is never repaid, so only a grant (no tenor) can fund it.
  if (terms.chargePerDay === null) return pledge.tenorMonths === null;
  if (pledge.tenorMonths === null) return true;
  // A blended band runs for its fixed period; otherwise the months for the charge to repay the meter at the pledge's return.
  const months = terms.blendedMonths ?? monthsToRepayWithReturn(terms.meterCost, terms.chargePerDay, pledge.returnPercent / 100, methodology);
  return months !== null && months <= pledge.tenorMonths;
}

/** Matches pledges to approved applications. Deterministic: the same inputs give the same matches. */
export function matchPledges(pledges: readonly PledgeInput[], demand: readonly DemandInput[], terms: readonly BandTerms[], discoOrder: readonly DiscoId[], methodology = MARKETPLACE_REFERENCE): MatchResult {
  const left = new Map(demand.map((row) => [`${row.disco}:${row.band}`, row.approved]));
  const termsOf = new Map(terms.map((one) => [one.band, one]));
  const ordered = [...pledges].sort((a, b) => a.returnPercent - b.returnPercent || a.discos.length - b.discos.length || a.id.localeCompare(b.id));
  const matches: Match[] = [];
  const result: MatchResult["pledges"] = {};
  for (const pledge of ordered) {
    let money = pledge.amountNaira;
    let meters = 0;
    for (const band of BAND_ORDER) {
      const bandTerms = termsOf.get(band);
      if (bandTerms === undefined || bandTerms.meterCost <= 0 || !canFund(pledge, bandTerms, methodology)) continue;
      for (const disco of discoOrder) {
        if (!pledge.discos.includes(disco)) continue;
        const key = `${disco}:${band}`;
        const wanted = left.get(key) ?? 0;
        const affordable = Math.floor(money / bandTerms.meterCost + 1e-9);
        const taken = Math.min(wanted, affordable);
        if (taken <= 0) continue;
        left.set(key, wanted - taken);
        money -= taken * bandTerms.meterCost;
        meters += taken;
        matches.push({ pledgeId: pledge.id, disco, band, meters: taken, naira: taken * bandTerms.meterCost });
      }
    }
    result[pledge.id] = { placed: pledge.amountNaira - money, queued: money, meters };
  }
  const waiting = demand.map((row) => ({ disco: row.disco, band: row.band, approved: left.get(`${row.disco}:${row.band}`) ?? 0 })).filter((row) => row.approved > 0);
  return { matches, pledges: result, waiting };
}
