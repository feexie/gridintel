import type { Citation, DiscoId } from "@/domain";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import { allocateTranche, ALLOCATION_REFERENCE, scoreDiscos, type DiscoFacts, type Weights } from "../../analytics/planning/allocation.ts";
import { installedCostAtStart } from "../../analytics/planning/meteringFund.ts";
import { readAssumptions } from "./assumptions.ts";
import { DISCO_NAMES, formatCount, formatNaira } from "./metering.ts";
import type { AllocationView, CitationView, ShownFigure } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: DISCO ALLOCATION (M3)

   Where public meters and private capital should go first, DisCo by
   DisCo, from NERC's published figures (docs/geh/DESIGN.md, section
   4). The method is analytics/planning/allocation; this service reads
   the figures, takes the weights and the tranche from the page
   address, and says where each figure came from.
========================================================== */

export const ALLOCATION_PATH = "/dashboard/planning/metering/allocation";

const DISCOS = Object.keys(DISCO_NAMES) as DiscoId[];

type Query = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The allocation's own inputs, with their defaults and basis. */
export const ALLOCATION_INPUTS = [
  { key: "wGap", label: "Need: weight on share of the national gap", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%", basis: "How much a DisCo's share of Nigeria's unmetered customers counts in its need score." },
  { key: "wRate", label: "Need: weight on a low metering rate", defaultValue: 30, min: 0, max: 100, step: 5, unit: "%", basis: "How much the distance of its metering rate from 100% counts." },
  { key: "wLow", label: "Need: weight on low-band or residential share", defaultValue: 20, min: 0, max: 100, step: 5, unit: "%", basis: "NERC publishes no split by band or class per DisCo, so this is left out until a figure is found." },
  { key: "wCollection", label: "Repayment risk: weight on uncollected billing", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%", basis: "1 − collection efficiency, NERC Q2 2026, Table 7." },
  { key: "wAtcc", label: "Repayment risk: weight on ATC&C loss", defaultValue: 50, min: 0, max: 100, step: 5, unit: "%", basis: "ATC&C loss, NERC Q2 2026, Table 8." },
  { key: "publicTranche", label: "Public meters in the first million", defaultValue: 750_000, min: 0, max: 1_000_000, step: 10_000, unit: "meters", basis: "PMI's 750,000 meters in 2027, as reported (S1, S2)." },
  { key: "privateTranche", label: "Meters on private capital in the first million", defaultValue: 250_000, min: 0, max: 1_000_000, step: 10_000, unit: "meters", basis: "The rest of the first million. Assumption." },
  { key: "riskEmphasis", label: "How much repayment risk counts for private capital", defaultValue: 100, min: 0, max: 100, step: 10, unit: "%", basis: "100% at first; lower it as DisCos build a repayment record. At 0% private capital follows pro-rata." },
  { key: "pilotMeters", label: "Pilot meters", defaultValue: 20_000, min: 1_000, max: 200_000, step: 1_000, unit: "meters", basis: "Two feeders. Proposal." },
  { key: "pilotMonths", label: "Pilot months", defaultValue: 12, min: 1, max: 36, step: 1, unit: "months", basis: "Proposal." },
] as const;

function readInputs(query: Query): Record<string, number> {
  const values: Record<string, number> = {};
  for (const spec of ALLOCATION_INPUTS) {
    const raw = first(query[spec.key]);
    const parsed = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
    values[spec.key] = Number.isFinite(parsed) && parsed >= spec.min && parsed <= spec.max ? parsed : spec.defaultValue;
  }
  return values;
}

const percent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;

function citationView(citation: Citation): CitationView {
  return { id: citation.id, title: citation.title, url: citation.url, published: citation.published, standing: citation.standing, locator: citation.locator ?? null };
}

/** The installed cost of one meter at the start, on the Metering Fund's default assumptions (single-phase hardware unless another price is given). */
export function startingCostPerMeter(hardwareUsd?: number): number {
  const fund = readAssumptions({});
  return installedCostAtStart({
    customers: 1,
    meteredShare: 0,
    growthPerYear: 0,
    publicMeters: [],
    grantsPerYear: [],
    hardwareUsd: hardwareUsd ?? fund.values.hardware,
    importedShare: 1,
    dutyRate: fund.values.duty / 100,
    installNaira: fund.values.install,
    fxNairaPerUsd: fund.values.fx,
    reserveRatePerYear: 0,
    failureRatePerYear: 0,
    capital: { currency: "usd", ratePerYear: 0 },
    nonPayingShare: 0,
    exemptShare: 0,
    collectionGainShare: 0,
    gainToFundShare: 0,
    averageBillNaira: null,
    tariffPassThrough: 0,
    chargeIndexed: false,
  });
}

/** The published figures, the scores and the split of the first million, for the inputs given. */
async function allocate(repository: PublishedFiguresRepository, values: Record<string, number>) {
  const [metering, installations, performance, citations] = await Promise.all([repository.metering(), repository.installations(), repository.performance(), repository.citations()]);
  const facts: DiscoFacts[] = DISCOS.map((disco) => {
    const june = metering.find((row) => row.disco === disco && row.asOf === "2026-06-30")!;
    const march = metering.find((row) => row.disco === disco && row.asOf === "2026-03-31")!;
    const installed = installations.filter((row) => row.disco === disco).reduce((sum, row) => sum + row.meters, 0);
    const q2 = performance.find((row) => row.disco === disco && row.quarter === "2026-Q2");
    return {
      id: disco,
      activeCustomers: june.activeCustomers,
      meteredCustomers: june.meteredCustomers,
      installsPerMonth: installed / 6,
      growthPerMonth: (june.activeCustomers - march.activeCustomers) / 3,
      collectionEfficiency: q2?.collectionEfficiencyPercent === null || q2 === undefined ? null : q2.collectionEfficiencyPercent / 100,
      atccLoss: q2?.atccLossPercent === null || q2 === undefined ? null : q2.atccLossPercent / 100,
      lowBandShare: null,
    };
  });
  const weights: Weights = {
    need: { gapShare: values.wGap / 100, meteringShortfall: values.wRate / 100, lowBandShare: values.wLow / 100 },
    risk: { collectionShortfall: values.wCollection / 100, atccLoss: values.wAtcc / 100 },
  };
  const scored = scoreDiscos(facts, weights);
  const result = allocateTranche(scored, values.publicTranche, values.privateTranche, values.riskEmphasis / 100);
  return { metering, installations, performance, citations, facts, scored, result };
}

/** Each DisCo's recommended meters in the first million, on the default weights and tranche, in whole meters. */
export async function recommendedSplit(repository: PublishedFiguresRepository): Promise<{ disco: DiscoId; recommended: number }[]> {
  const { result } = await allocate(repository, readInputs({}));
  return result.allocation.map((row) => ({ disco: row.id as DiscoId, recommended: Math.round(row.recommended) }));
}

export async function allocationView(repository: PublishedFiguresRepository, query: Query): Promise<AllocationView> {
  const values = readInputs(query);
  const { metering, installations, performance, citations, facts, scored, result } = await allocate(repository, values);
  const byId = (id: string) => result.allocation.find((row) => row.id === id)!;
  const name = (id: string) => DISCO_NAMES[id as DiscoId];

  /* The headline: the DisCo with the largest share of the gap. */
  const largest = [...scored].sort((a, b) => b.unmetered - a.unmetered)[0];
  const headline = `${name(largest.id)} holds ${percent(largest.gapShare)} of Nigeria's unmetered customers; ${
    largest.monthsTo100 === null ? "at the current pace it never reaches 100%: customers are added faster than meters." : `at the current pace it reaches 100% in ${Math.round(largest.monthsTo100)} months.`
  }`;

  /* The first million, in a sentence. */
  const topPublic = [...result.allocation].sort((a, b) => b.publicMeters - a.publicMeters).slice(0, 3);
  const topPrivate = [...result.allocation].sort((a, b) => b.privateMeters - a.privateMeters).slice(0, 3);
  // The DisCos private capital holds back from: the fewest private meters for each unmetered customer.
  const heldBack = [...result.allocation]
    .filter((row) => scored.find((one) => one.id === row.id)!.unmetered > 0)
    .sort((a, b) => a.privateMeters / scored.find((one) => one.id === a.id)!.unmetered - b.privateMeters / scored.find((one) => one.id === b.id)!.unmetered)
    .slice(0, 3);
  const tranche = values.publicTranche + values.privateTranche;
  const firstMillion = `The first ${tranche === 1_000_000 ? "million" : formatCount(tranche)} meters: ${formatCount(values.publicTranche)} public meters go where the need is greatest, most to ${topPublic.map((row) => name(row.id)).join(", ")}. ${formatCount(values.privateTranche)} on private capital are weighted away from repayment risk: ${heldBack.map((row) => name(row.id)).join(", ")} get the fewest until they build a repayment record, and the most go to ${topPrivate.map((row) => name(row.id)).join(", ")}.`;

  /* The pilot. */
  const pilotDisco = (DISCOS as string[]).includes(first(query.pilotDisco) ?? "") ? (first(query.pilotDisco) as DiscoId) : (topPrivate[0].id as DiscoId);
  const costPerMeter = startingCostPerMeter();
  const pilotScored = scored.find((one) => one.id === pilotDisco)!;
  const pilotFigures: ShownFigure[] = [
    { key: "meters", label: "Meters", value: `${formatCount(values.pilotMeters)} over ${values.pilotMonths} months`, origin: "assumption", basis: "Proposal" },
    { key: "perMonth", label: "Installed a month", value: formatCount(values.pilotMeters / values.pilotMonths), origin: "calculated", basis: "Meters ÷ months" },
    { key: "capex", label: "CAPEX", value: formatNaira(values.pilotMeters * costPerMeter), origin: "calculated", basis: `At ${formatNaira(costPerMeter)} a meter installed, the Metering Fund's default cost` },
    { key: "share", label: `Share of ${name(pilotDisco)}'s unmetered customers`, value: percent(values.pilotMeters / pilotScored.unmetered, 2), origin: "calculated", basis: "From NERC's 30 June 2026 figures" },
    { key: "bills", label: "Estimated bills removed a year, once installed", value: formatCount(values.pilotMeters * 12), origin: "calculated", basis: "Assumption: each unmetered customer gets an estimated bill every month" },
  ];

  const q1 = installations.filter((row) => row.quarter === "2026-Q1");
  const q2 = installations.filter((row) => row.quarter === "2026-Q2");
  const rows = [...scored]
    .sort((a, b) => b.unmetered - a.unmetered)
    .map((one) => {
      const disco = facts.find((row) => row.id === one.id)!;
      const june = metering.find((row) => row.disco === one.id && row.asOf === "2026-06-30")!;
      const perf = performance.find((row) => row.disco === one.id && row.quarter === "2026-Q2");
      const allocation = byId(one.id);
      return {
        id: one.id,
        name: name(one.id),
        customers: formatCount(disco.activeCustomers),
        metered: formatCount(disco.meteredCustomers),
        unmetered: formatCount(one.unmetered),
        gapShare: percent(one.gapShare),
        meteringRate: `${percent(one.meteringRate, 2)} (NERC: ${june.meteringRatePercent}%)`,
        installsQ1: formatCount(q1.find((row) => row.disco === one.id)?.meters ?? 0),
        installsQ2: formatCount(q2.find((row) => row.disco === one.id)?.meters ?? 0),
        monthsTo100: one.monthsTo100 === null ? "Never at this pace" : `${Math.round(one.monthsTo100)} months`,
        collection: perf?.collectionEfficiencyPercent === null || perf === undefined ? "Not published" : `${perf.collectionEfficiencyPercent}%`,
        atcc: perf?.atccLossPercent === null || perf === undefined ? "Not published" : `${perf.atccLossPercent}% (target ${perf.atccTargetPercent}%)`,
        need: one.need.toFixed(2),
        needMissing: one.needMissing,
        risk: one.risk === null ? "Not available" : one.risk.toFixed(2),
        riskMissing: one.riskMissing,
        proRata: formatCount(allocation.proRata),
        publicMeters: formatCount(allocation.publicMeters),
        privateMeters: formatCount(allocation.privateMeters),
        recommended: formatCount(allocation.recommended),
        change: `${allocation.recommended - allocation.proRata >= 0 ? "+" : "−"}${formatCount(Math.abs(allocation.recommended - allocation.proRata))}`,
        pilot: one.id === pilotDisco,
      };
    });

  return {
    headline,
    headlineHow: "How this is calculated: unmetered customers = active − metered (NERC, 30 June 2026). Months to 100% = unmetered ÷ (meters installed a month − customers added a month), from the 2026 Q1 and Q2 installations and the change in active customers from 31 March to 30 June 2026.",
    firstMillion,
    scoresHow:
      "How this is calculated: each part is scaled 0 to 1 across the 11 DisCos (the highest is 1) and weighted. Need: share of the gap, how far the metering rate is from 100%, and the low-band or residential share. Repayment risk: uncollected billing (1 − collection efficiency) and ATC&C loss. A part with no published figure is left out and named; it is never counted as 0.",
    splitHow:
      "How this is calculated: public meters go in proportion to unmetered customers × need. Private capital goes in proportion to unmetered customers × (1 − repayment risk), to the power set below: 100% at first, widening to pro-rata as track records build. No DisCo gets more meters than it has unmetered customers. Pro-rata: in proportion to unmetered customers alone.",
    rows,
    pilot: {
      disco: name(pilotDisco),
      sentence: `Pilot: ${name(pilotDisco)} DisCo, two feeders, ${formatCount(values.pilotMeters)} meters over ${values.pilotMonths} months, installed by NEMSA-certified local installers.`,
      figures: pilotFigures,
      note: "A proposal. The two feeders are to be chosen with the DisCo, on its own feeder records.",
    },
    rule: "Poor residential customers are never last in the queue: public meters follow need, so the DisCos with the lowest metering rates are not left for later, and Lifeline customers (up to 50 kWh a month) pay no meter charge.",
    inputs: ALLOCATION_INPUTS.map((spec) => ({ key: spec.key, label: spec.label, value: values[spec.key], defaultValue: spec.defaultValue, min: spec.min, max: spec.max, step: spec.step, unit: spec.unit, basis: spec.basis })),
    discos: DISCOS.map((disco) => ({ id: disco, label: name(disco), current: disco === pilotDisco })),
    citations: citations.filter((citation) => citation.id.startsWith("nerc-q") || citation.id.startsWith("s1") || citation.id.startsWith("s2")).map(citationView),
    methodology: { id: result.methodology.id, version: result.methodology.version, disclaimer: ALLOCATION_REFERENCE.disclaimer },
  };
}
