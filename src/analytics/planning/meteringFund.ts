import type { MethodologyRef } from "@/domain";
import type { Methodology } from "../core/methodology.ts";
import { methodologyRef, REFERENCE_DISCLAIMER } from "../core/methodology.ts";

/* ==========================================================
   ANALYTICS — THE METERING FUND (pay-as-you-meter)

   A fund buys and installs meters with no upfront payment from the
   customer, and recovers each meter from a fixed monthly charge taken
   on the customer's token purchases, plus a share of the collection
   gain the DisCo makes once the customer is metered
   (docs/geh/DESIGN.md, section 3).

   The calculation is deterministic and runs month by month:
   - the rollout lasts 60 months and reaches every customer, growth
     included; meters paid by public money (PMI) are installed on their
     own schedule and the fund installs the rest, the same number each
     month;
   - the model runs 120 months (a meter's life), so the repayment of
     the last meters is seen;
   - the charge is the same for every customer, and is sized so that
     every meter the fund installs is repaid, with the cost of capital,
     within 60 months of its own installation;
   - charges on publicly funded meters do not repay the fund: they go
     to a public pool that keeps those meters and covers exempt
     customers' charges;
   - customers metered before month 1 pay nothing.

   Every input is passed in. Nothing here reads the clock, a file or
   a random number.
========================================================== */

export interface MeteringFundParameters {
  rolloutMonths: number;
  horizonMonths: number;
  repaymentMonths: number;
}

export const METERING_FUND_REFERENCE: Methodology<MeteringFundParameters> = {
  id: "gridintel.planning.metering-fund",
  version: "0.1.0",
  name: "GridIntel reference metering fund (pay-as-you-meter)",
  description:
    "A month-by-month cash model of a fund that meters every customer in 60 months with no upfront payment, recovering each meter within 60 months of its installation from a fixed charge on token purchases and a share of the DisCo's collection gain.",
  authority: "gridintel_reference",
  status: "draft",
  disclaimer: REFERENCE_DISCLAIMER,
  parameters: { rolloutMonths: 60, horizonMonths: 120, repaymentMonths: 60 },
};

export interface MeteringFundInputs {
  /** Customers at the start (month 0). */
  customers: number;
  /** The share already metered at the start, 0 to 1. */
  meteredShare: number;
  /** Growth in customers per year, as a fraction. */
  growthPerYear: number;
  /** Meters paid by public money in each rollout month (index 0 is month 1). Missing months are 0. */
  publicMeters: number[];
  /** Public grants paid into the fund in each year of the rollout, in naira (DISREP, MAF). Missing years are 0. */
  grantsPerYear: number[];
  hardwareUsd: number;
  /** The share of the hardware bought in dollars and imported; the rest is assembled locally and priced in naira. */
  importedShare: number;
  dutyRate: number;
  installNaira: number;
  fxNairaPerUsd: number;
  /** Set aside for maintenance and replacement while a meter is being repaid, per year, as a share of its cost. */
  reserveRatePerYear: number;
  /** Meters failing per year, as a share of those installed; replaced from the reserve. */
  failureRatePerYear: number;
  capital: { currency: "usd" | "ngn"; ratePerYear: number };
  /** Customers who stop buying tokens or fall behind, as a share. Their charge is not collected. */
  nonPayingShare: number;
  /** Customers exempt from the charge (lifeline, vulnerable). The public pool pays their charge to the fund. */
  exemptShare: number;
  /** The DisCo's collection gain from a metered customer, as a share of the customer's bill. */
  collectionGainShare: number;
  /** The share of that gain paid to the fund. */
  gainToFundShare: number;
  /** The average monthly bill of a customer, in naira; null when it cannot be set, and then no collection gain is counted. */
  averageBillNaira: number | null;
  /** The share of inflation passed into tariffs, 0 to 1. */
  tariffPassThrough: number;
  /** The charge rises with the tariff. */
  chargeIndexed: boolean;
  /** Size the charge as if import duty were this rate (a duty-shock reserve). */
  sizingDutyRate?: number;
}

/** A shock to prices from a month on. */
export interface PriceShock {
  fromMonth: number;
  dutyRate?: number;
  /** The naira's loss of value against the dollar, as a fraction: 0.3 means N1,000 becomes N1,428.57. */
  devaluation?: number;
  inflationPerYear?: number;
}

export const NO_SHOCK: PriceShock = { fromMonth: 1 };

export interface FundYear {
  year: number;
  fundMeters: number;
  publicMeters: number;
  /** Customers metered at the end of the year, as a share of all customers. */
  meteredShare: number;
  /** Estimated bills issued in the year to customers not yet metered. */
  estimatedBills: number;
  /** Estimated bills the year would have issued had no meter been installed after month 0. */
  estimatedBillsWithoutPlan: number;
  capex: number;
  /** The value of the meters paid by public money, at the year's cost per meter. */
  publicMetersValue: number;
  capitalDrawn: number;
  grants: number;
  /** Recoveries spent on new meters and the reserve in the same month: the fund revolving. */
  recycled: number;
  charges: number;
  collectionGain: number;
  exemptCover: number;
  reserve: number;
  /** Inflows less capex and the reserve. */
  netCash: number;
  /** What the fund owes its investors at the end of the year, in naira; negative once it holds a surplus. */
  owed: number;
  costPerMeter: number;
}

export interface FundRun {
  methodology: MethodologyRef;
  /** The monthly charge per customer at the start, in naira. Null when the fund installs no meter. */
  charge: number | null;
  /** The charge was sized so every meter is repaid in 60 months; it is that figure. */
  chargeSizedForDutyRate: number;
  years: FundYear[];
  /** What the fund owes at the end of each month, months 0 to 120. */
  owedByMonth: number[];
  /** The first year whose net cash is not negative, 1 to 10; null if none. */
  cashPositiveYear: number | null;
  /** The month the fund has repaid its investors; null if it has not by month 120. */
  repaidMonth: number | null;
  /** The most the fund owes at any month end. */
  peakOwed: number;
  /** What the fund still owes at month 120; 0 or less means it is solvent. */
  owedAtEnd: number;
  /** The month the last meters the fund installed finish repaying. */
  lastRepaymentMonth: number | null;
  totalFundMeters: number;
  totalPublicMeters: number;
  /** The public pool: charges on publicly funded meters in, exempt customers' charges and those meters' reserve out. */
  pool: { inflow: number; outflow: number };
  /** The reserve for maintenance and replacement at month 120, after failed meters are replaced. */
  reserveAtEnd: number;
}

interface Path {
  fx: number[];
  duty: number[];
  /** The price index for naira costs, 1 at the start. */
  prices: number[];
  /** The tariff index, 1 at the start. */
  tariff: number[];
}

function pricePath(inputs: MeteringFundInputs, shock: PriceShock, months: number): Path {
  const fx: number[] = [];
  const duty: number[] = [];
  const prices: number[] = [];
  const tariff: number[] = [];
  for (let month = 0; month <= months; month++) {
    const shocked = month >= shock.fromMonth;
    const monthsShocked = shocked ? month - shock.fromMonth + 1 : 0;
    const inflation = shock.inflationPerYear ?? 0;
    fx.push(shocked && shock.devaluation !== undefined ? inputs.fxNairaPerUsd / (1 - shock.devaluation) : inputs.fxNairaPerUsd);
    duty.push(shocked && shock.dutyRate !== undefined ? shock.dutyRate : inputs.dutyRate);
    prices.push(Math.pow(1 + inflation, monthsShocked / 12));
    tariff.push(Math.pow(1 + inflation * inputs.tariffPassThrough, monthsShocked / 12));
  }
  return { fx, duty, prices, tariff };
}

/** The installed cost of one meter in a month, in naira. */
function costPerMeter(inputs: MeteringFundInputs, path: Path, month: number, dutyRate = path.duty[month]): number {
  const imported = inputs.hardwareUsd * inputs.importedShare * path.fx[month] * (1 + dutyRate);
  const local = inputs.hardwareUsd * (1 - inputs.importedShare) * inputs.fxNairaPerUsd * path.prices[month];
  return imported + local + inputs.installNaira * path.prices[month];
}

/** How much a naira owed grows over a month: the cost of capital, and the naira's fall when the capital is in dollars. */
function growth(inputs: MeteringFundInputs, path: Path, month: number): number {
  const rate = Math.pow(1 + inputs.capital.ratePerYear, 1 / 12);
  return inputs.capital.currency === "usd" ? (rate * path.fx[month]) / path.fx[month - 1] : rate;
}

const payingShare = (inputs: MeteringFundInputs) => (1 - inputs.exemptShare) * (1 - inputs.nonPayingShare) + inputs.exemptShare;

function gainPerCustomer(inputs: MeteringFundInputs, path: Path, month: number): number {
  if (inputs.averageBillNaira === null) return 0;
  return inputs.collectionGainShare * inputs.averageBillNaira * path.tariff[month] * inputs.gainToFundShare * (1 - inputs.nonPayingShare);
}

function fundMetersPerMonth(inputs: MeteringFundInputs, rollout: number): { perMonth: number; publicMeters: number[]; customersAtEnd: number } {
  const customersAtEnd = inputs.customers * Math.pow(1 + inputs.growthPerYear, rollout / 12);
  const publicMeters = Array.from({ length: rollout }, (_, index) => inputs.publicMeters[index] ?? 0);
  const needed = customersAtEnd - inputs.customers * inputs.meteredShare;
  const publicTotal = publicMeters.reduce((sum, meters) => sum + meters, 0);
  return { perMonth: Math.max(0, (needed - publicTotal) / rollout), publicMeters, customersAtEnd };
}

/**
 * The monthly charge, the same for every customer, that repays every meter the fund installs within
 * the repayment period of its own installation. Null when the fund installs no meter.
 */
export function sizeCharge(inputs: MeteringFundInputs, shock: PriceShock = NO_SHOCK, methodology = METERING_FUND_REFERENCE): number | null {
  const { rolloutMonths, horizonMonths, repaymentMonths } = methodology.parameters;
  const path = pricePath(inputs, shock, horizonMonths);
  if (fundMetersPerMonth(inputs, rolloutMonths).perMonth <= 0) return null;
  const sizingDuty = Math.max(inputs.sizingDutyRate ?? 0, 0);
  let charge = 0;
  for (let installed = 1; installed <= rolloutMonths; installed++) {
    const cost = costPerMeter(inputs, path, installed, Math.max(path.duty[installed], sizingDuty));
    let owed = 1;
    let perNaira = 0;
    let other = 0;
    for (let k = 1; k <= repaymentMonths; k++) {
      const month = installed + k;
      owed *= growth(inputs, path, month);
      perNaira += (inputs.chargeIndexed ? path.tariff[month] : 1) / owed;
      other += (gainPerCustomer(inputs, path, month) - (cost * inputs.reserveRatePerYear) / 12) / owed;
    }
    charge = Math.max(charge, (cost - other) / (payingShare(inputs) * perNaira));
  }
  return Math.max(0, charge);
}

/** Runs the fund month by month with a given charge (by default, the one sized for these inputs and no shock). */
export function runMeteringFund(inputs: MeteringFundInputs, shock: PriceShock = NO_SHOCK, charge?: number | null, methodology = METERING_FUND_REFERENCE): FundRun {
  const { rolloutMonths, horizonMonths, repaymentMonths } = methodology.parameters;
  const path = pricePath(inputs, shock, horizonMonths);
  const { perMonth, publicMeters } = fundMetersPerMonth(inputs, rolloutMonths);
  const startCharge = charge === undefined ? sizeCharge(inputs, NO_SHOCK, methodology) : charge;
  const chargeAt = (month: number) => (startCharge ?? 0) * (inputs.chargeIndexed ? path.tariff[month] : 1);

  const fundInstalled: number[] = [0];
  const publicInstalled: number[] = [0];
  const installCost: number[] = [0];
  for (let month = 1; month <= horizonMonths; month++) {
    fundInstalled.push(month <= rolloutMonths ? perMonth : 0);
    publicInstalled.push(month <= rolloutMonths ? publicMeters[month - 1] : 0);
    installCost.push(costPerMeter(inputs, path, month));
  }
  /** Meters installed in the repayment window that ends this month: they pay the charge this month. */
  const repaying = (installed: number[], month: number) => {
    let count = 0;
    let cost = 0;
    for (let at = Math.max(1, month - repaymentMonths); at < month; at++) {
      count += installed[at];
      cost += installed[at] * installCost[at];
    }
    return { count, cost };
  };

  const metered0 = inputs.customers * inputs.meteredShare;
  let owed = 0;
  let reserveBalance = 0;
  let fundCumulative = 0;
  let publicCumulative = 0;
  const pool = { inflow: 0, outflow: 0 };
  const owedByMonth = [0];
  const years: FundYear[] = [];
  let year = blankYear(1);

  for (let month = 1; month <= horizonMonths; month++) {
    const customers = inputs.customers * Math.pow(1 + inputs.growthPerYear, Math.min(month, rolloutMonths) / 12);
    const fund = repaying(fundInstalled, month);
    const publicRepaying = repaying(publicInstalled, month);
    const chargeNow = chargeAt(month);
    const charges = fund.count * chargeNow * (1 - inputs.exemptShare) * (1 - inputs.nonPayingShare);
    const exemptCover = fund.count * chargeNow * inputs.exemptShare;
    const gain = fund.count * gainPerCustomer(inputs, path, month);
    const reserve = (fund.cost * inputs.reserveRatePerYear) / 12;
    const capex = fundInstalled[month] * installCost[month];
    const grants = month <= rolloutMonths && (month - 1) % 12 === 0 ? (inputs.grantsPerYear[(month - 1) / 12] ?? 0) : 0;

    const need = capex + reserve;
    const inflow = charges + gain + exemptCover + grants;
    const recycled = Math.min(need, charges + gain + exemptCover);
    const fromGrants = Math.min(need - recycled, grants);
    const drawn = need - recycled - fromGrants;
    owed = owed * growth(inputs, path, month) + need - inflow;

    fundCumulative += fundInstalled[month];
    publicCumulative += publicInstalled[month];
    reserveBalance += reserve - ((inputs.failureRatePerYear / 12) * fundCumulative * installCost[month]);
    pool.inflow += publicRepaying.count * chargeNow * (1 - inputs.exemptShare) * (1 - inputs.nonPayingShare);
    pool.outflow += exemptCover + (publicRepaying.cost * inputs.reserveRatePerYear) / 12;

    const metered = metered0 + fundCumulative + publicCumulative;
    year.fundMeters += fundInstalled[month];
    year.publicMeters += publicInstalled[month];
    year.estimatedBills += Math.max(0, customers - metered);
    year.estimatedBillsWithoutPlan += Math.max(0, customers - metered0);
    year.capex += capex;
    year.publicMetersValue += publicInstalled[month] * installCost[month];
    year.capitalDrawn += drawn;
    year.grants += grants;
    year.recycled += recycled;
    year.charges += charges;
    year.collectionGain += gain;
    year.exemptCover += exemptCover;
    year.reserve += reserve;
    year.netCash += inflow - need;
    owedByMonth.push(owed);

    if (month % 12 === 0) {
      year.meteredShare = Math.min(1, metered / customers);
      year.owed = owed;
      year.costPerMeter = installCost[month];
      years.push(year);
      year = blankYear(month / 12 + 1);
    }
  }

  const lastInstalled = fundInstalled.reduce((last, meters, month) => (meters > 0 ? month : last), 0);
  const peakOwed = Math.max(...owedByMonth);
  const repaidMonth = owedByMonth.findIndex((value, month) => month > 0 && month >= lastInstalled && value <= 0);
  return {
    methodology: methodologyRef(methodology),
    charge: startCharge,
    chargeSizedForDutyRate: Math.max(inputs.dutyRate, inputs.sizingDutyRate ?? 0),
    years,
    owedByMonth,
    cashPositiveYear: years.find((one) => one.netCash >= 0)?.year ?? null,
    repaidMonth: repaidMonth === -1 ? null : repaidMonth,
    peakOwed,
    owedAtEnd: owed,
    lastRepaymentMonth: lastInstalled > 0 ? lastInstalled + repaymentMonths : null,
    totalFundMeters: fundCumulative,
    totalPublicMeters: publicCumulative,
    pool,
    reserveAtEnd: reserveBalance,
  };
}

function blankYear(year: number): FundYear {
  return {
    year,
    fundMeters: 0,
    publicMeters: 0,
    meteredShare: 0,
    estimatedBills: 0,
    estimatedBillsWithoutPlan: 0,
    capex: 0,
    publicMetersValue: 0,
    capitalDrawn: 0,
    grants: 0,
    recycled: 0,
    charges: 0,
    collectionGain: 0,
    exemptCover: 0,
    reserve: 0,
    netCash: 0,
    owed: 0,
    costPerMeter: 0,
  };
}

/* ==========================================================
   THE METERING GAP AT A PACE (docs/geh/DESIGN.md, section 7)
========================================================== */

export interface MeteringPace {
  unmetered: number;
  /** Customers added per month, less meters installed per month: the backlog's change each month. */
  netBacklogChangePerMonth: number;
  /** Months to meter everyone at this pace; null when the gap does not close. */
  monthsToClose: number | null;
  /** Meters per month needed to meter everyone in the given number of months. */
  requiredPerMonth: number;
}

export function meteringPace(unmetered: number, installsPerMonth: number, growthPerMonth: number, withinMonths = 60): MeteringPace {
  const net = installsPerMonth - growthPerMonth;
  return {
    unmetered,
    netBacklogChangePerMonth: growthPerMonth - installsPerMonth,
    monthsToClose: net > 0 ? unmetered / net : null,
    requiredPerMonth: unmetered / withinMonths + growthPerMonth,
  };
}
