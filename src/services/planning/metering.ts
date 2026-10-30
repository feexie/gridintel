import type { BandTariff, Citation, DiscoId, PublishedInstallations } from "@/domain";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import { METERING_FUND_REFERENCE, meteringPace, runMeteringFund, shortfallAtCharge, sizeCharge, type FundRun, type MeteringFundInputs, type PriceShock } from "../../analytics/planning/meteringFund.ts";
import { ASSUMPTIONS, BANDS, MITIGATIONS, readAssumptions, type Assumptions, type AssumptionUnit, type CaseId } from "./assumptions.ts";
import type { BandView, CitationView, FigureOrigin, MeteringFundView, ShownFigure, StressRowView, YearRowView } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: THE METERING FUND

   Builds the Metering Fund screen for a case (the GEH Brief 15 test
   scenario, or Nigeria from NERC's published figures) and the
   assumptions in the page address. The method is
   analytics/planning/meteringFund; this service chooses its inputs,
   runs the base case and the shocks, and says where each figure came
   from.
========================================================== */

export const METERING_FUND_PATH = "/dashboard/planning/metering";

export const DISCO_NAMES: Record<DiscoId, string> = {
  abuja: "Abuja",
  benin: "Benin",
  eko: "Eko",
  enugu: "Enugu",
  ibadan: "Ibadan",
  ikeja: "Ikeja",
  jos: "Jos",
  kaduna: "Kaduna",
  kano: "Kano",
  port_harcourt: "Port Harcourt",
  yola: "Yola",
};
const DISCOS = Object.keys(DISCO_NAMES) as DiscoId[];

const BRIEF_CUSTOMERS = 15_000_000;
const BRIEF_METERED = 0.45;
const ROLLOUT = METERING_FUND_REFERENCE.parameters.rolloutMonths;

/* ---------- formatting ---------- */

const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const twoDigits = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export function formatNaira(value: number): string {
  const sign = value < 0 ? "−" : "";
  const size = Math.abs(value);
  if (size >= 1e12) return `${sign}₦${twoDigits.format(size / 1e12)} trillion`;
  if (size >= 1e9) return `${sign}₦${(size / 1e9).toFixed(1)} billion`;
  if (size >= 1e6) return `${sign}₦${(size / 1e6).toFixed(1)} million`;
  return `${sign}₦${whole.format(Math.round(size))}`;
}

export function formatCount(value: number): string {
  if (Math.abs(value) >= 1e6) return `${twoDigits.format(value / 1e6)} million`;
  return whole.format(Math.round(value));
}

const formatShare = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;

const UNIT_LABEL: Record<AssumptionUnit, string> = {
  naira: "₦",
  usd: "$",
  percent: "%",
  naira_per_usd: "₦ per $",
  kwh_month: "kWh a month",
  meters: "meters",
  customers: "customers",
  month: "month",
};

const citationLabel = (citation: Citation | undefined) =>
  citation === undefined ? "Source not found" : `${citation.title}${citation.published ? `, ${formatDate(citation.published)}` : ""}${citation.locator ? ` (${citation.locator})` : ""}`;

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* ---------- the case ---------- */

interface CaseFacts {
  scope: string;
  shortScope: string;
  customers: number;
  meteredShare: number;
  growthPerYear: number;
  /** Customers added a month at the start. */
  growthPerMonth: number;
  /** Meters installed a month, from the published installations; null when the case has none. */
  installsPerMonth: number | null;
  /** Meters paid by public money in each rollout month. */
  publicMeters: number[];
  tariffs: Map<string, { value: number | null; basis: string; origin: FigureOrigin }>;
  startingPoint: ShownFigure[];
  references: ShownFigure[];
  yearsNote: string;
  /** The first month of year 1, or null for the test scenario. */
  startMonth: { year: number; month: number } | null;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

async function caseFacts(repository: PublishedFiguresRepository, assumptions: Assumptions, citations: Map<string, Citation>): Promise<CaseFacts> {
  const [metering, installations, national, tariffs] = await Promise.all([repository.metering(), repository.installations(), repository.nationalReports(), repository.residentialTariffs()]);
  const values = assumptions.values;
  const reportedNational: ShownFigure[] = national.map((report) => ({
    key: `national-${report.period}`,
    label: `Nigeria, ${report.period}`,
    value: [
      report.meteringRatePercent === null ? null : `${report.meteringRatePercent}% metered`,
      report.meteredCustomers === null ? null : `${formatCount(report.meteredCustomers)} metered`,
      report.activeCustomers === null ? null : `of ${formatCount(report.activeCustomers)} customers`,
      report.unmeteredCustomers === null ? null : `${formatCount(report.unmeteredCustomers)} unmetered`,
    ]
      .filter((part) => part !== null)
      .join(", "),
    origin: "reported",
    basis: `As reported: ${citationLabel(citations.get(report.citationId))}`,
  }));

  if (assumptions.caseId === "brief") {
    const growthPerYear = values.growth / 100;
    const yearlyPublic = values.publicMeters;
    return {
      scope: "the GEH Brief 15 test scenario: 15 million customers, 45% metered",
      shortScope: "The brief's DisCo",
      customers: BRIEF_CUSTOMERS,
      meteredShare: BRIEF_METERED,
      growthPerYear,
      growthPerMonth: BRIEF_CUSTOMERS * (Math.pow(1 + growthPerYear, 1 / 12) - 1),
      installsPerMonth: null,
      publicMeters: Array.from({ length: ROLLOUT }, () => yearlyPublic / 12),
      tariffs: averageTariffs(tariffs, "the brief's test scenario"),
      startingPoint: [
        { key: "customers", label: "Customers", value: formatCount(BRIEF_CUSTOMERS), origin: "test_scenario", basis: "GEH Brief 15 test scenario" },
        { key: "metered", label: "Metered at the start", value: `${formatCount(BRIEF_CUSTOMERS * BRIEF_METERED)} (45%)`, origin: "test_scenario", basis: "GEH Brief 15 test scenario" },
        { key: "unmetered", label: "Unmetered at the start", value: formatCount(BRIEF_CUSTOMERS * (1 - BRIEF_METERED)), origin: "calculated", basis: "Customers less metered customers" },
      ],
      references: reportedNational,
      yearsNote: "Years 1 to 5 of the test scenario. It has no calendar dates.",
      startMonth: null,
    };
  }

  const discos = assumptions.disco === "national" ? DISCOS : DISCOS.filter((disco) => disco === assumptions.disco);
  const at = (asOf: string) => metering.filter((row) => row.asOf === asOf && discos.includes(row.disco));
  const june = at("2026-06-30");
  const march = at("2026-03-31");
  const active = sum(june.map((row) => row.activeCustomers));
  const metered = sum(june.map((row) => row.meteredCustomers));
  const activeMarch = sum(march.map((row) => row.activeCustomers));
  const growthPerMonth = (active - activeMarch) / 3;
  const growthPerYear = Math.pow(active / activeMarch, 4) - 1;
  const installed: PublishedInstallations[] = installations.filter((row) => discos.includes(row.disco));
  const installsPerMonth = sum(installed.map((row) => row.meters)) / 6;
  const nationalUnmetered = sum(metering.filter((row) => row.asOf === "2026-06-30").map((row) => row.activeCustomers - row.meteredCustomers));
  const pmiShare = (active - metered) / nationalUnmetered;
  // Year 1 is July 2026 to June 2027: PMI's 2027 meters fall in months 7 to 18.
  const publicMeters = Array.from({ length: ROLLOUT }, (_, index) => {
    const month = index + 1;
    if (month >= 7 && month <= 18) return (values.pmi2027 / 12) * pmiShare;
    if (month > 18) return (values.pmiLater / 12) * pmiShare;
    return 0;
  });
  const single = discos.length === 1 ? discos[0] : null;
  const scope = single === null ? "Nigeria, all 11 DisCos" : `${DISCO_NAMES[single]} DisCo`;
  const q2 = citationLabel(citations.get("nerc-q2-2026"));
  const q1 = citationLabel(citations.get("nerc-q1-2026"));
  const reportedRate = single === null ? null : june[0].meteringRatePercent;
  return {
    scope,
    shortScope: single === null ? "Nigeria" : DISCO_NAMES[single],
    customers: active,
    meteredShare: metered / active,
    growthPerYear,
    growthPerMonth,
    installsPerMonth,
    publicMeters,
    tariffs: single === null ? averageTariffs(tariffs, "Nigeria") : discoTariffs(tariffs, single, citations),
    startingPoint: [
      { key: "customers", label: "Active customers, 30 June 2026", value: formatCount(active), origin: single === null ? "calculated" : "reported", basis: single === null ? `The 11 DisCos added up, from ${q2}` : q2 },
      { key: "metered", label: "Metered customers, 30 June 2026", value: formatCount(metered), origin: single === null ? "calculated" : "reported", basis: single === null ? `The 11 DisCos added up, from ${q2}` : q2 },
      { key: "unmetered", label: "Unmetered customers, 30 June 2026", value: formatCount(active - metered), origin: "calculated", basis: "Active customers less metered customers" },
      { key: "rate", label: "Metering rate, 30 June 2026", value: `${formatShare(metered / active, 2)} calculated${reportedRate === null ? "; NERC states 61.51% for all DisCos" : `; NERC states ${reportedRate}%`}`, origin: "calculated", basis: `Metered ÷ active customers. The rate NERC publishes is shown beside it, from ${q2}` },
      { key: "growth", label: "Customers added a month", value: formatCount(growthPerMonth), origin: "calculated", basis: `Active customers at 30 June 2026 less those at 31 March 2026, over 3 months. From ${q1} and ${q2}. "Active" means a customer who vended or was billed in the last 12 months, so the count also moves when customers fall out of it.` },
      { key: "pace", label: "Meters installed a month, first half of 2026", value: formatCount(installsPerMonth), origin: "calculated", basis: `Meters installed in 2026 Q1 and Q2, all schemes, over 6 months. From ${q2}, Appendix IX` },
    ],
    references: reportedNational,
    yearsNote: "Year 1 is July 2026 to June 2027, starting from NERC's figures at 30 June 2026. PMI's 2027 meters fall in months 7 to 18.",
    startMonth: { year: 2026, month: 7 },
  };
}

function averageTariffs(tariffs: BandTariff[], forWhat: string) {
  const result = new Map<string, { value: number | null; basis: string; origin: FigureOrigin }>();
  for (const band of BANDS) {
    const given = tariffs.filter((row) => row.band === band && row.nairaPerKwh !== null).map((row) => row.nairaPerKwh as number);
    result.set(band, {
      value: given.length === 0 ? null : sum(given) / given.length,
      origin: "calculated",
      basis: `The average of ${given.length} DisCos' allowed residential tariffs for Band ${band} in NERC's September 2026 orders (Table 3), used for ${forWhat}. Each DisCo counts once.`,
    });
  }
  return result;
}

function discoTariffs(tariffs: BandTariff[], disco: DiscoId, citations: Map<string, Citation>) {
  const result = new Map<string, { value: number | null; basis: string; origin: FigureOrigin }>();
  for (const band of BANDS) {
    const row = tariffs.find((one) => one.disco === disco && one.band === band);
    result.set(band, {
      value: row?.nairaPerKwh ?? null,
      origin: "reported",
      basis: row?.nairaPerKwh === null || row === undefined ? `The order lists no Band ${band} tariff: ${citationLabel(citations.get(row?.citationId ?? ""))}` : citationLabel(citations.get(row.citationId)),
    });
  }
  return result;
}

/* ---------- the view ---------- */

type Query = Record<string, string | string[] | undefined>;

export async function meteringFundView(repository: PublishedFiguresRepository, query: Query): Promise<MeteringFundView> {
  const assumptions = readAssumptions(query);
  const citationList = await repository.citations();
  const citations = new Map(citationList.map((citation) => [citation.id, citation]));
  const facts = await caseFacts(repository, assumptions, citations);
  const values = assumptions.values;
  const pct = (key: string) => values[key] / 100;

  /* Bands: the bill is the tariff times the assumed consumption. */
  const bandRows = BANDS.map((band) => {
    const tariff = facts.tariffs.get(band)!;
    const bill = tariff.value === null ? null : tariff.value * values[`use${band}`];
    return { band, tariff, bill, share: pct(`share${band}`) };
  });
  const billed = bandRows.filter((row) => row.bill !== null && row.share > 0);
  const shareTotal = sum(billed.map((row) => row.share));
  const averageBill = shareTotal > 0 ? sum(billed.map((row) => row.share * (row.bill as number))) / shareTotal : null;
  const typical = typicalBand(bandRows);

  const inputs: MeteringFundInputs = {
    customers: facts.customers,
    meteredShare: facts.meteredShare,
    growthPerYear: facts.growthPerYear,
    publicMeters: facts.publicMeters,
    grantsPerYear: Array.from({ length: 5 }, () => values.grants),
    hardwareUsd: values.hardware,
    importedShare: assumptions.mitigations.local ? 1 - pct("localShare") : 1,
    dutyRate: pct("duty"),
    installNaira: values.install,
    fxNairaPerUsd: values.fx,
    reserveRatePerYear: pct("reserve"),
    failureRatePerYear: pct("failure"),
    capital: assumptions.mitigations.naira ? { currency: "ngn", ratePerYear: pct("ngnRate") } : { currency: "usd", ratePerYear: pct("usdRate") },
    nonPayingShare: pct("nonPaying"),
    exemptShare: pct("exempt"),
    collectionGainShare: pct("gain"),
    gainToFundShare: pct("gainToFund"),
    averageBillNaira: averageBill,
    tariffPassThrough: pct("passThrough"),
    chargeIndexed: assumptions.mitigations.indexed,
    ...(assumptions.mitigations.dutyReserve ? { sizingDutyRate: pct("shockDuty") } : {}),
  };
  const charge = sizeCharge(inputs);
  const base = runMeteringFund(inputs, undefined, charge);
  const cap = pct("cap");
  const typicalBill = typical?.bill ?? null;
  const capFor = (bill: number | null) => (bill === null ? null : cap * bill);
  const typicalCap = capFor(typicalBill);

  /* The shocks, each with the launch charge. */
  const from = values.shockMonth;
  const shocks: { key: string; label: string; shock: PriceShock; words: string }[] = [
    { key: "duty", label: "Import duty", shock: { fromMonth: from, dutyRate: pct("shockDuty") }, words: `Duty rises from ${values.duty}% to ${values.shockDuty}% in month ${from}` },
    { key: "devaluation", label: "Naira devaluation", shock: { fromMonth: from, devaluation: pct("shockDevaluation") }, words: `The naira loses ${values.shockDevaluation}% of its value in month ${from}: ₦${whole.format(values.fx)} becomes ₦${whole.format(values.fx / (1 - pct("shockDevaluation")))} per $` },
    { key: "inflation", label: "Inflation", shock: { fromMonth: from, inflationPerYear: pct("shockInflation") }, words: `${values.shockInflation}% a year from month ${from}, on naira costs and, at ${values.passThrough}% pass-through, on tariffs` },
    { key: "combined", label: "All three together", shock: { fromMonth: from, dutyRate: pct("shockDuty"), devaluation: pct("shockDevaluation"), inflationPerYear: pct("shockInflation") }, words: "Duty, devaluation and inflation from the same month" },
  ];
  const stressRuns = shocks.map((one) => ({ ...one, run: runMeteringFund(inputs, one.shock, charge), needed: sizeCharge(inputs, one.shock) }));
  const stress: StressRowView[] = [
    stressRow("base", "Base case", "Prices as today", base, charge, typicalCap),
    ...stressRuns.map((one) => stressRow(one.key, one.label, one.words, one.run, one.needed, typicalCap)),
  ];
  const combined = stressRuns[stressRuns.length - 1].run;

  /* The headline, and what holding the charge at the cap would take. */
  const headline = headlineOf(charge, typical, typicalBill, typicalCap, cap, base);
  const short = charge !== null && typicalCap !== null && charge > typicalCap ? shortfallAtCharge(inputs, typicalCap) : null;
  const atCap =
    short === null || typical === null
      ? null
      : {
          sentence: `Held at the cap, ₦${whole.format(short.charge)} a month, each meter is up to ${formatNaira(short.perMeter)} short. Public money of ${formatNaira(short.total)} (PMI, DISREP, MAF) would close the gap for the fund's ${formatCount(base.totalFundMeters)} meters.`,
          how: `How this is calculated: for each meter, its installed cost less what ₦${whole.format(short.charge)} a month (${formatShare(cap, 0)} of a typical Band ${typical.band} bill) and the collection gain repay in its 60 months, at the fund's cost of capital. Added up over every meter the fund installs.`,
        };
  const lastMonth = base.lastRepaymentMonth;
  const repaymentLine =
    lastMonth === null
      ? "The fund installs no meter: there is nothing to repay."
      : base.owedAtEnd <= 1
        ? `Each meter is repaid within 5 years of installation; the last meters finish repaying in month ${lastMonth}${facts.startMonth ? ` (${monthName(facts.startMonth, lastMonth)})` : ""}.`
        : `The fund has not repaid its investors by month ${lastMonth}: ${formatNaira(base.owedAtEnd)} is still owed.`;
  const cashPositiveLine =
    base.cashPositiveYear === null
      ? "The fund's net cash does not turn positive within 10 years."
      : `The fund turns cash-positive in year ${base.cashPositiveYear}${facts.startMonth ? ` (${yearName(facts.startMonth, base.cashPositiveYear)})` : ""}${base.cashPositiveYear > 5 ? ", after the rollout ends" : ""}. It owes most, ${formatNaira(base.peakOwed)}, while it is installing.`;

  /* The metering gap. */
  const unmetered = facts.customers * (1 - facts.meteredShare);
  const required = meteringPace(unmetered, facts.installsPerMonth ?? 0, facts.growthPerMonth);
  const gapSentence =
    facts.installsPerMonth === null
      ? `${facts.shortScope} needs ${formatCount(required.requiredPerMonth)} meters a month to finish in five years.`
      : `${facts.shortScope} needs ${formatCount(required.requiredPerMonth)} meters a month to finish in five years. It installed ${formatCount(facts.installsPerMonth)} a month in the first half of 2026.`;
  const pace = facts.installsPerMonth === null ? null : meteringPace(unmetered, facts.installsPerMonth, facts.growthPerMonth);
  const gapFigures: ShownFigure[] = [
    { key: "required", label: "Meters a month to finish in five years", value: formatCount(required.requiredPerMonth), origin: "calculated", basis: "Unmetered customers ÷ 60, plus customers added a month" },
    ...(pace === null
      ? []
      : [
          {
            key: "atPace",
            label: "At the 2026 pace",
            value: pace.monthsToClose === null ? "At this pace the metering gap does not close" : `Every customer metered in ${(pace.monthsToClose / 12).toFixed(1)} years`,
            origin: "calculated" as const,
            basis: "Unmetered ÷ (meters installed a month − customers added a month). When installs do not exceed growth, the gap never closes.",
          },
          { key: "backlog", label: "Change in the backlog a month at that pace", value: `${pace.netBacklogChangePerMonth > 0 ? "+" : "−"}${formatCount(Math.abs(pace.netBacklogChangePerMonth))}`, origin: "calculated" as const, basis: "Customers added a month less meters installed a month" },
        ]),
    {
      key: "estimatedBills",
      label: "Estimated bills removed in year 5",
      value: formatCount(base.years[4].estimatedBillsWithoutPlan - base.years[4].estimatedBills),
      origin: "calculated",
      basis: "Assumption: every unmetered customer gets an estimated bill every month, so each meter in place removes 12 a year. Modelled, not a count of bills issued. Estimated bills to metered customers (missed readings) are not included.",
    },
  ];

  /* The cost of a meter, at the start. */
  const imported = inputs.importedShare;
  const hardwareNaira = values.hardware * values.fx;
  const parts: ShownFigure[] = [
    { key: "hardware", label: `Hardware, $${values.hardware} at ₦${whole.format(values.fx)} per $${imported < 1 ? `, ${formatShare(imported, 0)} imported` : ""}`, value: formatNaira(hardwareNaira), origin: "assumption", basis: "Meter price and exchange rate are assumptions" },
    { key: "duty", label: `Import duty, ${values.duty}% on the imported part`, value: formatNaira(hardwareNaira * imported * pct("duty")), origin: "assumption", basis: "Duty rate is an assumption" },
    { key: "install", label: "Installation and logistics", value: formatNaira(values.install), origin: "assumption", basis: "Assumption" },
  ];

  const years: YearRowView[] = base.years.map((year) => ({
    year: facts.startMonth ? `Year ${year.year} (${yearName(facts.startMonth, year.year)})` : `Year ${year.year}`,
    meteredShare: formatShare(year.meteredShare),
    fundMeters: formatCount(year.fundMeters),
    publicMeters: formatCount(year.publicMeters),
    capex: formatNaira(year.capex),
    capitalDrawn: formatNaira(year.capitalDrawn),
    recoveries: formatNaira(year.charges + year.collectionGain + year.exemptCover),
    netCash: formatNaira(year.netCash),
    owed: year.owed > 0 ? formatNaira(year.owed) : "Nothing",
    estimatedBills: formatCount(year.estimatedBills),
    estimatedBillsRemoved: formatCount(year.estimatedBillsWithoutPlan - year.estimatedBills),
  }));

  const bands: BandView[] = bandRows.map((row) => {
    const share = row.bill === null || charge === null ? null : charge / row.bill;
    return {
      band: row.band,
      tariff: row.tariff.value === null ? "Not available" : `₦${row.tariff.value.toFixed(2)}`,
      tariffOrigin: row.tariff.origin,
      tariffBasis: row.tariff.basis,
      consumption: `${whole.format(values[`use${row.band}`])} kWh`,
      bill: row.bill === null ? "Not available" : formatNaira(row.bill),
      customerShare: `${values[`share${row.band}`]}%`,
      chargeShareOfBill: share === null ? "Not available" : formatShare(share),
      underCap: share === null ? null : share <= cap,
      typical: typical?.band === row.band,
    };
  });

  const yearLabels = base.years.slice(0, 5).map((year) => `Year ${year.year}`);
  const billion = (value: number) => value / 1e9;
  const baseQuery = { case: assumptions.caseId, ...(assumptions.caseId === "nigeria" ? { disco: assumptions.disco } : {}) };

  return {
    caseId: assumptions.caseId,
    cases: (["brief", "nigeria"] as CaseId[]).map((id) => ({ id, label: id === "brief" ? "Brief scenario" : "Nigeria reference", href: `${METERING_FUND_PATH}?case=${id}`, current: id === assumptions.caseId })),
    discos: [{ id: "national", label: "All 11 DisCos", current: assumptions.disco === "national" }, ...DISCOS.map((disco) => ({ id: disco, label: DISCO_NAMES[disco], current: assumptions.disco === disco }))],
    scope: facts.scope,
    headline,
    atCap,
    repaymentLine,
    cashPositiveLine,
    gap: { sentence: gapSentence, figures: gapFigures, how: "How this is calculated: meters needed a month = unmetered customers ÷ 60 + customers added a month. Months to finish at a pace = unmetered ÷ (meters installed a month − customers added a month)." },
    startingPoint: facts.startingPoint,
    references: facts.references,
    costPerMeter: {
      figure: formatNaira(base.years[0].costPerMeter),
      how: "How this is calculated: hardware in dollars × the exchange rate, plus import duty on the imported part, plus installation and logistics.",
      parts,
    },
    stress,
    stressHow:
      "How this is calculated: each shock starts in the month shown and runs to month 120. The fund keeps the charge it launched with; it is solvent if it has repaid its investors by month 120. The charge needed is the one that would repay every meter in 60 months under that shock, checked against the cap for the typical band.",
    bands,
    bandsNote:
      "Bill = the band's allowed residential tariff × the assumed consumption. The tariffs are NERC's for the states it still regulates; a state with its own regulator sets its own. The split of customers by band is a placeholder until sourced figures replace it.",
    years,
    yearsNote: facts.yearsNote,
    charts: {
      balance: {
        title: "Fund balance over the 60-month rollout: base case and all three shocks",
        unit: "₦ billion",
        months: ROLLOUT,
        base: { label: "Base case", values: base.owedByMonth.slice(0, ROLLOUT + 1).map((owed) => billion(-owed)) },
        stressed: { label: "Duty, devaluation and inflation together", values: combined.owedByMonth.slice(0, ROLLOUT + 1).map((owed) => billion(-owed)) },
        how: "Below zero, the fund owes its investors. It borrows while it installs and repays from charges and the collection gain.",
      },
      meters: {
        title: "Meters installed each year",
        unit: "million meters",
        years: yearLabels,
        fund: { label: "Paid by the fund", values: base.years.slice(0, 5).map((year) => year.fundMeters / 1e6) },
        public: { label: "Paid by public money (PMI)", values: base.years.slice(0, 5).map((year) => year.publicMeters / 1e6) },
      },
      sources: {
        title: "Where each year's money for meters comes from",
        unit: "₦ billion",
        years: yearLabels,
        series: [
          { label: "Investor / DFI capital drawn", values: base.years.slice(0, 5).map((year) => billion(year.capitalDrawn)) },
          { label: "Recoveries spent again (revolving)", values: base.years.slice(0, 5).map((year) => billion(year.recycled)) },
          { label: "DISREP and MAF grants", values: base.years.slice(0, 5).map((year) => billion(year.grants)) },
          { label: "Public meters (PMI), at cost", values: base.years.slice(0, 5).map((year) => billion(year.publicMetersValue)) },
        ],
      },
    },
    pmiRule: "Charges collected on PMI meters do not repay investors: those meters were paid for with public money. They go to the maintenance and replacement reserve and to the pool that covers exempt and vulnerable customers.",
    fairnessRule: "Every customer metered under the scheme pays the same charge under the same cap, on a PMI meter or a fund meter. Customers metered before year 1 pay nothing.",
    modelOrigin:
      "Pay-as-you-meter applies the PAYGo model used for solar home systems and phone financing in Africa: the customer pays for the asset in small amounts as they buy energy, not upfront.",
    assumptions: ASSUMPTIONS.filter((spec) => spec.onlyFor === undefined || spec.onlyFor === assumptions.caseId).map((spec) => ({
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      unitLabel: UNIT_LABEL[spec.unit],
      value: values[spec.key],
      defaultValue: spec.defaultValue,
      min: spec.min,
      max: spec.max,
      step: spec.step,
      basis: spec.basis,
      origin: spec.origin,
      group: spec.group,
      changed: assumptions.changed.includes(spec.key),
    })),
    mitigations: MITIGATIONS.map((one) => ({ ...one, on: assumptions.mitigations[one.key] })),
    resetHref: `${METERING_FUND_PATH}?${new URLSearchParams(baseQuery)}`,
    citations: citationList.filter((citation) => usedBy(citation, assumptions)).map(citationView),
    methodology: { id: base.methodology.id, version: base.methodology.version, disclaimer: METERING_FUND_REFERENCE.disclaimer },
    sourcing: {
      synthetic: false,
      sources: citationList.filter((citation) => usedBy(citation, assumptions)).map((citation) => ({ id: citation.id, name: citation.title, kind: citation.standing === "primary" ? "regulator" : "reported", ...(citation.published ? { dated: citation.published } : {}) })),
    },
  };
}

function usedBy(citation: Citation, assumptions: Assumptions): boolean {
  if (!citation.id.startsWith("nerc-myto-")) return true;
  if (assumptions.caseId === "brief" || assumptions.disco === "national") return true;
  return citation.id.endsWith(DISCO_CODE[assumptions.disco as DiscoId] ?? "");
}

const DISCO_CODE: Record<DiscoId, string> = { abuja: "aedc", benin: "bedc", enugu: "eedc", eko: "ekedp", ibadan: "ibedc", ikeja: "ie", jos: "jed", kaduna: "kaedc", kano: "kedco", port_harcourt: "phed", yola: "yedc" };

function citationView(citation: Citation): CitationView {
  return { id: citation.id, title: citation.title, url: citation.url, published: citation.published ? formatDate(citation.published) : null, standing: citation.standing, locator: citation.locator ?? null };
}

/** The band of the middle customer, A to E, among bands with a bill. */
function typicalBand(rows: { band: string; bill: number | null; share: number }[]): { band: string; bill: number } | null {
  const billed = rows.filter((row) => row.bill !== null && row.share > 0);
  const total = sum(billed.map((row) => row.share));
  let cumulative = 0;
  for (const row of billed) {
    cumulative += row.share;
    if (cumulative >= total / 2) return { band: row.band, bill: row.bill as number };
  }
  return null;
}

function stressRow(key: string, label: string, shock: string, run: FundRun, needed: number | null, typicalCap: number | null): StressRowView {
  const solvent = run.owedAtEnd <= 1;
  const underCap = needed !== null && typicalCap !== null && needed <= typicalCap;
  const verdict = `${solvent ? "Solvent" : `Runs short by ${formatNaira(run.owedAtEnd)}`}. ${needed === null ? "" : underCap ? "The charge needed stays under the cap." : typicalCap === null ? "The cap cannot be checked: no bill for the typical band." : `The charge needed is ${formatNaira(needed - typicalCap)} a month above the cap.`}`.trim();
  return {
    key,
    label,
    shock,
    solvent,
    owedAtEnd: solvent ? "Nothing" : formatNaira(run.owedAtEnd),
    chargeNeeded: needed === null ? "Not available" : `${formatNaira(needed)} a month`,
    underCap,
    verdict,
  };
}

function headlineOf(charge: number | null, typical: { band: string } | null, bill: number | null, capAmount: number | null, cap: number, base: FundRun): MeteringFundView["headline"] {
  const how =
    "How this is calculated: the charge is the smallest monthly amount, the same for every customer, that repays each meter's installed cost, the fund's cost of capital and the reserve within 60 months of installation, after the DisCo's share of the collection gain. Customers who stop buying are left out; the public pool pays for exempt customers.";
  if (charge === null) return { sentence: "Every customer is already metered: the fund has nothing to install.", figure: "₦0", figureLabel: "Meter charge a month", tone: "ok", how };
  const share = bill === null ? null : charge / bill;
  const shareWords = share === null || typical === null ? "no typical bill can be set" : `${formatShare(share)} of a typical Band ${typical.band} bill`;
  const solvent = base.owedAtEnd <= 1;
  if (capAmount !== null && charge > capAmount) {
    return {
      sentence: `Metering every customer by year 5 with no upfront payment needs ₦${whole.format(charge)} a month: ${shareWords}, ${formatNaira(charge - capAmount)} above the ${formatShare(cap, 0)} cap.`,
      figure: `₦${whole.format(charge)}`,
      figureLabel: "Meter charge a month, on token purchases",
      tone: "warning",
      how,
    };
  }
  return {
    sentence: solvent
      ? `Every customer metered by year 5 with no upfront payment. Charge: ₦${whole.format(charge)} a month, ${shareWords}.`
      : `Every customer metered by year 5 with no upfront payment, but the fund runs short by ${formatNaira(base.owedAtEnd)}. Charge: ₦${whole.format(charge)} a month, ${shareWords}.`,
    figure: `₦${whole.format(charge)}`,
    figureLabel: "Meter charge a month, on token purchases",
    tone: solvent ? "ok" : "warning",
    how,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthName(start: { year: number; month: number }, month: number): string {
  const index = start.month - 1 + month - 1;
  return `${MONTHS[index % 12]} ${start.year + Math.floor(index / 12)}`;
}

function yearName(start: { year: number; month: number }, year: number): string {
  return `${monthName(start, (year - 1) * 12 + 1)} to ${monthName(start, year * 12)}`;
}
