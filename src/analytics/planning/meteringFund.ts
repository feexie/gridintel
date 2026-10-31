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
  // 0.2.0: a public top-up per meter; a cohort's shortfall is sized at the duty-shock rate when the reserve is on; investors' outcome.
  // 0.3.0: investors commit a fixed capital; a shortfall is split into the buffers, investors' loss (never more than their
  // capital and its accrued return) and what lies beyond them, uncovered.
  version: "0.3.0",
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
  /** Public money paid into the fund for each meter it installs, by installation month (index 0 is month 1). */
  topUpPerMeter?: number[];
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
  /** Public top-up paid in for the meters installed in the year. */
  topUp: number;
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
  /** Investors' money put in each month, months 0 to 120. */
  drawnByMonth: number[];
  /** Investors' money paid back each month, months 0 to 120. */
  repaidByMonth: number[];
  /** How much a naira owed grows over each month (the cost of capital, and the naira's fall on dollar capital), months 0 to 120; 1 at month 0. */
  growthByMonth: number[];
  /** All public top-up paid in. */
  totalTopUp: number;
  /** The fund's own net cash each month (inflows less new meters and the reserve), months 0 to 120. */
  netCashByMonth: number[];
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

/** The installed cost of one meter in month 1, with no shock, in naira. */
export function installedCostAtStart(inputs: MeteringFundInputs): number {
  return costPerMeter(inputs, pricePath(inputs, NO_SHOCK, 1), 1);
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

export interface CapShortfall {
  /** The charge the cap allows, in naira a month. */
  charge: number;
  /** The most any meter the fund installs is left short at its installation, in naira of that month. */
  perMeter: number;
  /** All the fund's meters together, each in naira of its installation month: the public money that would keep the charge at the cap. */
  total: number;
  /** Each meter's shortfall by installation month (index 0 is month 1). */
  perCohort: number[];
}

/**
 * What a charge held at the cap leaves unpaid: for each meter the fund installs, its installed cost
 * less the value at installation of what it recovers in its 60 months at that charge. Null when the
 * fund installs no meter.
 */
export function shortfallAtCharge(inputs: MeteringFundInputs, charge: number, shock: PriceShock = NO_SHOCK, methodology = METERING_FUND_REFERENCE): CapShortfall | null {
  const { rolloutMonths, horizonMonths, repaymentMonths } = methodology.parameters;
  const path = pricePath(inputs, shock, horizonMonths);
  const { perMonth } = fundMetersPerMonth(inputs, rolloutMonths);
  if (perMonth <= 0) return null;
  let perMeter = 0;
  let total = 0;
  const perCohort: number[] = [];
  for (let installed = 1; installed <= rolloutMonths; installed++) {
    const cost = costPerMeter(inputs, path, installed, Math.max(path.duty[installed], inputs.sizingDutyRate ?? 0));
    let owed = 1;
    let recovered = 0;
    for (let k = 1; k <= repaymentMonths; k++) {
      const month = installed + k;
      owed *= growth(inputs, path, month);
      const chargeNow = charge * (inputs.chargeIndexed ? path.tariff[month] : 1) * payingShare(inputs);
      recovered += (chargeNow + gainPerCustomer(inputs, path, month) - (cost * inputs.reserveRatePerYear) / 12) / owed;
    }
    const short = Math.max(0, cost - recovered);
    perCohort.push(short);
    perMeter = Math.max(perMeter, short);
    total += short * perMonth;
  }
  return { charge, perMeter, total, perCohort };
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
  const drawnByMonth = [0];
  const netCashByMonth = [0];
  const repaidByMonth = [0];
  const growthByMonth = [1];
  let totalTopUp = 0;
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
    const grants =
      (month <= rolloutMonths && (month - 1) % 12 === 0 ? (inputs.grantsPerYear[(month - 1) / 12] ?? 0) : 0) +
      fundInstalled[month] * (inputs.topUpPerMeter?.[month - 1] ?? 0);
    const topUp = fundInstalled[month] * (inputs.topUpPerMeter?.[month - 1] ?? 0);

    const need = capex + reserve;
    const inflow = charges + gain + exemptCover + grants;
    const recycled = Math.min(need, charges + gain + exemptCover);
    const fromGrants = Math.min(need - recycled, grants);
    const drawn = need - recycled - fromGrants;
    const monthGrowth = growth(inputs, path, month);
    const grown = owed * monthGrowth;
    const repaid = Math.max(0, Math.min(inflow - need, grown));
    owed = grown + need - inflow;
    drawnByMonth.push(drawn);
    netCashByMonth.push(inflow - need);
    repaidByMonth.push(repaid);
    growthByMonth.push(monthGrowth);
    totalTopUp += topUp;

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
    year.grants += grants - topUp;
    year.topUp += topUp;
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
  // Owed within a naira counts as repaid: what is left is rounding.
  const repaidMonth = owedByMonth.findIndex((value, month) => month > 0 && month >= lastInstalled && value <= 1);
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
    drawnByMonth,
    repaidByMonth,
    growthByMonth,
    totalTopUp,
    netCashByMonth,
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
    topUp: 0,
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

/* ==========================================================
   WHAT INVESTORS GET BACK

   Investors commit a fixed capital (by default, all the run draws).
   When a run needs more than that, the rest is not investors' money:
   it is drawn from outside them and owed alongside them. Both balances
   grow at the fund's cost of capital, and each month's repayment is
   shared between them in proportion to what each is owed.

   What the fund still owes at month 120 is its shortfall. The
   first-loss layer takes it first, then the reserve account; both
   protect investors, so they pay investors' balance first. Investors
   lose what is left of their balance: never more than their capital
   and its accrued return. Whatever lies beyond investors' balance is
   uncovered: nobody in the structure carries it.
========================================================== */

export interface InvestorBuffers {
  /** The first-loss layer, as a share of the capital investors put in. */
  firstLossShare: number;
  /** The reserve account, in naira, held from the start. */
  reserveAccount: number;
}

export interface InvestorOutcome {
  /** The capital investors put in: what they committed, or what the run drew if that is less. */
  capital: number;
  firstLoss: number;
  /** The fund's shortfall: what it still owes at month 120, cost of capital included; 0 when it has repaid. */
  loss: number;
  absorbedByFirstLoss: number;
  absorbedByReserve: number;
  /** What investors lose after both buffers: what is left of their capital and its accrued return. */
  investorLoss: number;
  /** The part of investors' capital they never got back in cash; the rest of their loss is return they were due. */
  capitalLost: number;
  /** The shortfall beyond investors' balance, after the buffers: carried by nobody in the structure. */
  uncovered: number;
  /** Investors are owed nothing at month 120. */
  repaidInFull: boolean;
  /** The buffers cover the whole shortfall: investors repaid, nothing uncovered. */
  covered: boolean;
  /** Investors' annual rate of return on their naira cash flows: -100% when they get nothing back; null when it cannot be found. */
  irr: number | null;
  /** The month investors have their money back; null if not by month 120. */
  paybackMonth: number | null;
  /** Investors' own cash each month, months 0 to 120: what they are paid back less what they put in; the buffers' payment in month 120. */
  flowsByMonth: number[];
}

export function investorOutcome(run: FundRun, buffers: InvestorBuffers, committedCapital?: number): InvestorOutcome {
  const drawnInAll = run.drawnByMonth.reduce((total, value) => total + value, 0);
  const commitment = committedCapital ?? drawnInAll;
  let investors = 0;
  let beyond = 0;
  let put = 0;
  const flows = [0];
  for (let month = 1; month < run.drawnByMonth.length; month++) {
    investors *= run.growthByMonth[month];
    beyond *= run.growthByMonth[month];
    const fromInvestors = Math.min(run.drawnByMonth[month], Math.max(0, commitment - put));
    put += fromInvestors;
    investors += fromInvestors;
    beyond += run.drawnByMonth[month] - fromInvestors;
    const owed = investors + beyond;
    const toInvestors = owed > 0 ? Math.min(investors, (run.repaidByMonth[month] * investors) / owed) : 0;
    investors -= toInvestors;
    beyond = Math.max(0, beyond - (run.repaidByMonth[month] - toInvestors));
    flows.push(toInvestors - fromInvestors);
  }
  const capital = put;
  const firstLoss = buffers.firstLossShare * capital;
  const loss = Math.max(0, run.owedAtEnd);
  const absorbedByFirstLoss = Math.min(loss, firstLoss);
  const absorbedByReserve = Math.min(loss - absorbedByFirstLoss, buffers.reserveAccount);
  // Investors' balance is part of the shortfall, never more than it.
  const investorsOwed = Math.min(investors, loss);
  const buffersToInvestors = Math.min(investorsOwed, absorbedByFirstLoss + absorbedByReserve);
  const investorLoss = investorsOwed - buffersToInvestors;
  const uncovered = Math.max(0, loss - absorbedByFirstLoss - absorbedByReserve - investorLoss);
  flows[flows.length - 1] += buffersToInvestors;
  // Cash investors got back, in all.
  const received = flows.reduce((total, flow) => total + flow, 0) + capital;
  let cumulative = 0;
  let paybackMonth: number | null = null;
  flows.forEach((flow, month) => {
    cumulative += flow;
    if (paybackMonth === null && month > 0 && cumulative >= 0 && capital > 0) paybackMonth = month;
  });
  return {
    capital,
    firstLoss,
    loss,
    absorbedByFirstLoss,
    absorbedByReserve,
    investorLoss,
    capitalLost: Math.max(0, capital - received),
    uncovered,
    repaidInFull: investorLoss <= 1,
    covered: investorLoss + uncovered <= 1,
    irr: capital > 0 && received <= 1 ? -1 : annualIrr(flows),
    paybackMonth,
    flowsByMonth: flows,
  };
}

/** The annual rate at which monthly flows are worth nothing today, found by bisection between -100% and +200% a year; null outside it. */
function annualIrr(flows: number[]): number | null {
  const value = (annual: number) => {
    const monthly = Math.pow(1 + annual, 1 / 12);
    return flows.reduce((total, flow, month) => total + flow / Math.pow(monthly, month), 0);
  };
  let low = -0.999999;
  let high = 2;
  if (value(low) * value(high) > 0) return null;
  for (let step = 0; step < 200; step++) {
    const middle = (low + high) / 2;
    if (value(low) * value(middle) <= 0) high = middle;
    else low = middle;
  }
  return (low + high) / 2;
}

/* ==========================================================
   INITIAL INVESTMENT AGAINST BREAK-EVEN

   From investors' side: what they have in at most, and when; the
   month the fund's own monthly cash turns positive for good
   (break-even); the month it has repaid them with the cost of capital
   (fully repaid); and the month their cash back first equals their
   cash in (payback).
========================================================== */

export interface InvestmentProfile {
  /** The most investors have in at once, in naira. */
  peakInvestment: number;
  peakMonth: number;
  /** The first month from which the fund's own net cash is never negative again; null if not by month 120. */
  breakEvenMonth: number | null;
  /** The month the fund owes investors nothing, cost of capital included; null if not by month 120. */
  fullyRepaidMonth: number | null;
  paybackMonth: number | null;
  irr: number | null;
  /** Investors' cash back less cash in, added up month by month, months 0 to 120. */
  cumulativeByMonth: number[];
}

export function investmentProfile(run: FundRun, outcome: InvestorOutcome): InvestmentProfile {
  let cumulative = 0;
  const cumulativeByMonth = outcome.flowsByMonth.map((flow) => (cumulative += flow));
  const last = cumulativeByMonth.length - 1;
  const lowest = Math.min(...cumulativeByMonth);
  let breakEvenMonth: number | null = null;
  for (let month = run.netCashByMonth.length - 1; month >= 1; month--) {
    if (run.netCashByMonth[month] < 0) break;
    breakEvenMonth = month;
  }
  return {
    peakInvestment: -lowest,
    peakMonth: cumulativeByMonth.indexOf(lowest),
    breakEvenMonth: breakEvenMonth === null || breakEvenMonth > last ? null : breakEvenMonth,
    fullyRepaidMonth: run.repaidMonth,
    paybackMonth: outcome.paybackMonth,
    irr: outcome.irr,
    cumulativeByMonth,
  };
}
