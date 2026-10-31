import { POSITIONING_LINE, STEPS } from "../../constants/planning.ts";
import type { AllocationView, CitationView, FigureOrigin, MeteringFundView, MonitoringView, ShownFigure } from "./views.ts";

/* ==========================================================
   SERVICES — THE METERING PLAN REPORT

   The Metering planner on paper: the gap, then Plan · Access,
   Fund · Affordability and Monitor · Availability, the shocks, and
   the assumptions and sources. It is built from the three views the
   screens show (the Metering Fund, the DisCo allocation and
   Monitoring) and calculates nothing of its own: every figure and
   sentence is one a screen already shows, with its origin. Printed,
   or saved as PDF from the browser, through the report layout of the
   report system (ADR 0019).
========================================================== */

/** A row of a report table: its name, and one formatted cell per column. */
export interface PlanReportRow {
  id: string;
  label: string;
  cells: Record<string, string>;
}

export type PlanReportBlock =
  | { kind: "figures"; title: string | null; figures: ShownFigure[] }
  | { kind: "table"; title: string; caption: string | null; columns: { key: string; label: string }[]; rows: PlanReportRow[]; notes: string[] }
  /** Words read with the figures: a finding, a note, or a caveat such as "synthetic". */
  | { kind: "statement"; tone: "finding" | "note" | "caveat"; text: string };

export interface PlanReportSection {
  id: string;
  number: number;
  title: string;
  /** The step and its A, when the section is one: "Plan · Access". */
  step: string | null;
  /** What the section answers, in one sentence. */
  purpose: string;
  blocks: PlanReportBlock[];
}

export interface MeteringPlanReportView {
  title: string;
  eyebrow: string;
  positioning: string;
  /** Whose figures and which case: "Nigeria, all 11 DisCos". */
  scope: string;
  /** What the data on the report is, for the band printed at the top of each page. */
  dataLabel: string;
  dataStatement: string;
  /** The figures a reader needs first. */
  brief: ShownFigure[];
  sections: PlanReportSection[];
  methods: { id: string; version: string; disclaimer: string }[];
  citations: CitationView[];
  /** What each origin label means. */
  originKey: { origin: FigureOrigin; label: string; meaning: string }[];
  /** What the browser names the PDF. */
  fileTitle: string;
}

export const ORIGIN_LABELS: Record<FigureOrigin, string> = {
  reported: "Reported",
  calculated: "Calculated",
  assumption: "Assumption",
  placeholder: "Placeholder",
  test_scenario: "Test scenario",
  synthetic: "Synthetic",
};

const ORIGIN_MEANINGS: Record<FigureOrigin, string> = {
  reported: "A figure published by someone else (NERC, a tariff order, the press), shown as published and cited.",
  calculated: "Produced by GridIntel's named, versioned method from the figures and assumptions shown.",
  assumption: "An input chosen for the model, with its basis; it can be changed on the screen.",
  placeholder: "An input with no sourced value yet, shown as a placeholder until one is found.",
  test_scenario: "From GEH Brief 15's test scenario.",
  synthetic: "From designed demonstration records: not records of a real organization.",
};

export function meteringPlanReportView(fund: MeteringFundView, allocation: AllocationView, monitoring: MonitoringView): MeteringPlanReportView {
  const structure = fund.structure;
  let number = 0;
  const section = (id: string, title: string, step: string | null, purpose: string, blocks: PlanReportBlock[]): PlanReportSection => ({ id, number: ++number, title, step, purpose, blocks });

  /* a) The gap */
  const gap = section("gap", "The gap", null, "How many customers are unmetered, how fast meters are going in, and what finishing in five years needs.", [
    { kind: "statement", tone: "finding", text: fund.gap.sentence },
    { kind: "figures", title: "Starting point", figures: fund.startingPoint },
    { kind: "figures", title: "The pace", figures: fund.gap.figures },
    { kind: "statement", tone: "note", text: fund.gap.how },
    ...(fund.references.length === 0 ? [] : [{ kind: "figures" as const, title: "Other published figures, shown beside and not used", figures: fund.references }]),
  ]);

  /* b) Access (Plan) */
  const access = section("access", "Where the meters go first", STEPS.plan, "Which DisCos the first million meters go to, public meters by need and private capital by repayment risk, and the pilot.", [
    { kind: "statement", tone: "finding", text: allocation.headline },
    {
      kind: "table",
      title: "The 11 DisCos",
      caption: "Reported by NERC (30 June 2026, Q1 and Q2 2026); months to 100% and the two scores calculated. Ordered by share of the national gap.",
      columns: [
        { key: "customers", label: "Customers" },
        { key: "unmetered", label: "Unmetered" },
        { key: "gapShare", label: "Share of gap" },
        { key: "meteringRate", label: "Metering rate" },
        { key: "monthsTo100", label: "To 100% at this pace" },
        { key: "collection", label: "Collection efficiency" },
        { key: "atcc", label: "ATC&C (target)" },
        { key: "need", label: "Need" },
        { key: "risk", label: "Repayment risk" },
      ],
      rows: allocation.rows.map((row) => ({ id: row.id, label: row.name, cells: { customers: row.customers, unmetered: row.unmetered, gapShare: row.gapShare, meteringRate: row.meteringRate, monthsTo100: row.monthsTo100, collection: row.collection, atcc: row.atcc, need: row.need, risk: row.risk } })),
      notes: [allocation.headlineHow, allocation.scoresHow],
    },
    { kind: "statement", tone: "finding", text: allocation.firstMillion },
    { kind: "statement", tone: "note", text: allocation.rule },
    {
      kind: "table",
      title: "The first million: recommended against pro-rata",
      caption: "Calculated: public meters to need, private capital to low repayment risk, against today's pro-rata split.",
      columns: [
        { key: "proRata", label: "Pro-rata" },
        { key: "publicMeters", label: "Public meters (to need)" },
        { key: "privateMeters", label: "Private capital (to low risk)" },
        { key: "recommended", label: "Recommended" },
        { key: "change", label: "Change" },
      ],
      rows: allocation.rows.map((row) => ({ id: row.id, label: row.name, cells: { proRata: row.proRata, publicMeters: row.publicMeters, privateMeters: row.privateMeters, recommended: row.recommended, change: row.change } })),
      notes: [allocation.splitHow],
    },
    { kind: "statement", tone: "finding", text: allocation.pilot.sentence },
    { kind: "figures", title: "Pilot card (a proposal)", figures: allocation.pilot.figures },
    { kind: "statement", tone: "note", text: allocation.pilot.note },
  ]);

  /* c) Affordability (Fund) */
  const bandCharge = new Map((structure?.bandCharges ?? []).map((one) => [one.band, one.charge]));
  const affordability = section("affordability", "What the customer pays, and who tops up", STEPS.fund, "The charge with no upfront payment, the fund alone against the GridIntel structure, the charge in each band, the public money, and investment against break-even.", [
    { kind: "statement", tone: "finding", text: fund.headline.sentence },
    { kind: "statement", tone: "note", text: fund.headline.how },
    ...(fund.atCap ? [{ kind: "statement" as const, tone: "note" as const, text: fund.atCap.sentence }] : []),
    ...(structure === null
      ? []
      : [
          { kind: "statement" as const, tone: "finding" as const, text: structure.fundAlone },
          { kind: "statement" as const, tone: "finding" as const, text: structure.structure },
          ...(structure.failures ? [{ kind: "statement" as const, tone: "caveat" as const, text: structure.failures }] : []),
          ...(structure.publicPerMeter ? [{ kind: "statement" as const, tone: "finding" as const, text: structure.publicPerMeter.line }] : []),
        ]),
    {
      kind: "table",
      title: "The charge in each band",
      caption: "Tariffs reported by NERC (September 2026 orders); consumption and the band split are assumptions or placeholders; the rest calculated.",
      columns: [
        { key: "tariff", label: "Tariff (₦/kWh)" },
        { key: "consumption", label: "Consumption a month" },
        { key: "bill", label: "Bill a month" },
        { key: "customers", label: "Customers" },
        { key: "fundAlone", label: "Fund alone: charge as share of bill" },
        { key: "structure", label: "GridIntel structure: charge a month" },
      ],
      rows: [
        ...fund.bands.map((band) => ({
          id: band.band,
          label: `Band ${band.band}${band.typical ? " (typical)" : ""}`,
          cells: { tariff: band.tariff, consumption: band.consumption, bill: band.bill, customers: band.customerShare, fundAlone: band.chargeShareOfBill, structure: bandCharge.get(`Band ${band.band}`) ?? bandCharge.get(band.band) ?? "Not available" },
        })),
        ...(structure === null ? [] : [{ id: "lifeline", label: "Lifeline (R1)", cells: { tariff: "Up to 50 kWh a month (NERC order)", consumption: "", bill: "", customers: "", fundAlone: "Exempt", structure: bandCharge.get("Lifeline (R1)") ?? "₦0, exempt" } }]),
      ],
      notes: [fund.bandsNote],
    },
    ...(structure === null
      ? []
      : [
          { kind: "figures" as const, title: "The GridIntel structure and public money", figures: [...structure.figures, ...(structure.publicPerMeter?.figures ?? [])] },
          { kind: "statement" as const, tone: "note" as const, text: structure.how },
        ]),
    { kind: "figures", title: `Investment against break-even: ${fund.investment.fundAlone.label}`, figures: fund.investment.fundAlone.figures },
    ...(fund.investment.structure ? [{ kind: "figures" as const, title: `Investment against break-even: ${fund.investment.structure.label}`, figures: fund.investment.structure.figures }] : []),
    { kind: "statement", tone: "note", text: fund.investment.how },
  ]);

  /* d) Availability (Monitor) */
  const availability = section("availability", "Meters in place, and the estimated bills they remove", STEPS.monitor, "The five-year rollout, the estimated bills it removes, and whether installs are verified against the plan.", [
    { kind: "figures", title: "The five-year rollout (modelled)", figures: [
      { key: "metered", label: fund.impact.metered.label, value: fund.impact.metered.value, origin: "calculated", basis: "Modelled from the plan" },
      { key: "bills", label: fund.impact.bills.label, value: fund.impact.bills.value, origin: "calculated", basis: "Modelled: each unmetered customer gets one estimated bill a month" },
    ] },
    {
      kind: "table",
      title: "Year by year",
      caption: "Calculated (modelled), from NERC's figures at 30 June 2026.",
      columns: [
        { key: "meteredShare", label: "Metered at year end" },
        { key: "billsRemoved", label: "Estimated bills removed" },
      ],
      rows: fund.impact.byYear.map((year) => ({ id: year.year, label: year.year, cells: { meteredShare: year.meteredShare, billsRemoved: year.billsRemoved } })),
      notes: [fund.impact.how],
    },
    { kind: "statement", tone: "caveat", text: `Synthetic: the monitoring figures below are designed demonstration records, not a real programme's (${monitoring.sourcing.sources.map((source) => source.name).join("; ")}).` },
    { kind: "statement", tone: "finding", text: monitoring.headline },
    { kind: "statement", tone: "note", text: monitoring.trancheLine },
    ...(monitoring.totals.length === 0 ? [] : [{ kind: "figures" as const, title: `Monitoring, ${monitoring.quarter} (synthetic)`, figures: monitoring.totals }]),
    { kind: "statement", tone: "note", text: monitoring.headlineHow },
  ]);

  /* e) Shocks and the inflation line */
  const shocks = section("shocks", "Shocks and the inflation line", null, "Whether the fund and the structure survive import duty, devaluation and inflation, and who carries a shortfall.", [
    {
      kind: "table",
      title: "The fund alone under each shock",
      caption: "Calculated. Each against the launch charge; a shortfall is split between investors (never more than their capital and its return) and what is uncovered beyond them.",
      columns: [
        { key: "shock", label: "Shock" },
        { key: "solvent", label: "Is the fund solvent?" },
        { key: "needed", label: "Charge needed" },
        { key: "underCap", label: "Under the cap?" },
      ],
      rows: fund.stress.map((row) => ({ id: row.key, label: row.label, cells: { shock: row.shock, solvent: row.solvent ? "Yes" : `No: short ${row.owedAtEnd}.${row.split ? ` ${row.split}` : ""}`, needed: row.chargeNeeded, underCap: row.underCap ? "Yes" : "No" } })),
      notes: [fund.stressHow],
    },
    ...(structure === null
      ? []
      : [
          {
            kind: "table" as const,
            title: "The GridIntel structure under each shock",
            caption: `Calculated. Survives ${structure.survived} shocks.`,
            columns: [
              { key: "survives", label: "Survives?" },
              { key: "outcome", label: "Outcome" },
            ],
            rows: structure.shocks.map((one) => ({ id: one.key, label: one.label, cells: { survives: one.survives ? "Yes" : "No", outcome: one.outcome } })),
            notes: [],
          },
          {
            kind: "table" as const,
            title: "Investors: base case and all three shocks",
            caption: "Calculated (modelled).",
            columns: [
              { key: "base", label: structure.investor.base.label },
              { key: "stressed", label: structure.investor.stressed.label },
            ],
            rows: (
              [
                ["Repaid in full", (one: typeof structure.investor.base) => (one.repaid ? "Yes" : "No")],
                ["Investors' capital", (one: typeof structure.investor.base) => one.capital],
                ["Fund shortfall at month 120", (one: typeof structure.investor.base) => one.loss],
                ["Taken by the first-loss layer", (one: typeof structure.investor.base) => one.absorbedByFirstLoss],
                ["Taken by the reserve account", (one: typeof structure.investor.base) => one.absorbedByReserve],
                ["Capital investors lose", (one: typeof structure.investor.base) => one.investorLoss],
                ["Return due, unpaid", (one: typeof structure.investor.base) => one.returnUnpaid],
                ["Uncovered beyond investors", (one: typeof structure.investor.base) => one.uncovered],
                ["Investors' return (IRR), modelled", (one: typeof structure.investor.base) => one.irr],
                ["Payback, modelled", (one: typeof structure.investor.base) => one.payback],
              ] as const
            ).map(([label, of]) => ({ id: label, label, cells: { base: of(structure.investor.base), stressed: of(structure.investor.stressed) } })),
            notes: [],
          },
          { kind: "statement" as const, tone: "finding" as const, text: structure.inflationLine },
        ]),
  ]);

  /* f) Assumptions and sources */
  const assumptions = section("assumptions", "Assumptions and sources", null, "Every input the figures rest on, with its origin and basis; then every source cited, the methods, and what each origin label means.", [
    {
      kind: "table",
      title: "Mitigations",
      caption: "On or off in the figures above.",
      columns: [
        { key: "on", label: "In these figures" },
        { key: "effect", label: "What it does" },
      ],
      rows: fund.mitigations.map((one) => ({ id: one.key, label: one.label, cells: { on: one.on ? "On" : "Off", effect: one.effect } })),
      notes: [],
    },
    {
      kind: "table",
      title: "Metering Fund assumptions",
      caption: "Each labelled with its origin and basis; changed on the Metering Fund screen.",
      columns: [
        { key: "value", label: "Value" },
        { key: "origin", label: "Origin" },
        { key: "basis", label: "Basis" },
      ],
      rows: fund.assumptions.map((one) => ({ id: one.key, label: one.label, cells: { value: `${one.value}${one.unitLabel ? ` ${one.unitLabel}` : ""}`, origin: ORIGIN_LABELS[one.origin], basis: one.basis } })),
      notes: [],
    },
    {
      kind: "table",
      title: "DisCo allocation weights and the tranche",
      caption: "Assumptions or proposals, each with its basis; changed on the DisCo allocation screen.",
      columns: [
        { key: "value", label: "Value" },
        { key: "basis", label: "Basis" },
      ],
      rows: allocation.inputs.map((one) => ({ id: one.key, label: one.label, cells: { value: `${one.value.toLocaleString("en-GB")}${one.unit ? ` ${one.unit}` : ""}`, basis: one.basis } })),
      notes: [],
    },
  ]);

  const citations = [...new Map([...fund.citations, ...allocation.citations].map((citation) => [citation.id, citation])).values()];
  const brief: ShownFigure[] = [
    { key: "charge", label: fund.headline.figureLabel, value: fund.headline.figure, origin: "calculated", basis: "Fund alone" },
    { key: "metered", label: fund.impact.metered.label, value: fund.impact.metered.value, origin: "calculated", basis: "Modelled" },
    { key: "bills", label: fund.impact.bills.label, value: fund.impact.bills.value, origin: "calculated", basis: "Modelled" },
    ...(structure?.figures.filter((one) => one.key === "publicTotal" || one.key === "typicalCharge") ?? []),
    ...(structure?.publicPerMeter?.figures ?? []),
  ];

  return {
    title: "Metering Plan",
    eyebrow: `GridIntel · Planning · ${fund.scope}`,
    positioning: POSITIONING_LINE,
    scope: fund.scope,
    dataLabel: "PUBLISHED FIGURES AND ASSUMPTIONS; MONITORING SYNTHETIC",
    dataStatement:
      "NERC's published figures are cited where they are shown. Every other input is an assumption or a placeholder, labelled. The monitoring records in the Availability section are synthetic: designed demonstration records, not a real programme's. Every figure is from GridIntel's deterministic, versioned methods, not a regulatory figure.",
    brief,
    sections: [gap, access, affordability, availability, shocks, assumptions],
    methods: [fund.methodology, allocation.methodology, monitoring.methodology],
    citations,
    originKey: (Object.keys(ORIGIN_LABELS) as FigureOrigin[]).map((origin) => ({ origin, label: ORIGIN_LABELS[origin], meaning: ORIGIN_MEANINGS[origin] })),
    fileTitle: `GridIntel Metering Plan, ${fund.scope}`,
  };
}
