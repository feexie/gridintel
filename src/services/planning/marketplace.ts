import type { DiscoId, FunderKind, MarketplaceBand, MeterPledge } from "@/domain";
import type { MarketplaceRepository } from "../../repositories/ports/marketplace.ts";
import { BAND_ORDER, MARKETPLACE_REFERENCE, matchPledges, monthsToRepay, type BandTerms, type MatchResult } from "../../analytics/planning/marketplace.ts";
import { startingCostPerMeter } from "./allocation.ts";
import { DISCO_NAMES, formatCount, formatNaira } from "./metering.ts";
import type { MarketplaceView, ShownFigure } from "./views.ts";

/* ==========================================================
   SERVICES — PLANNING: THE METERING MARKETPLACE

   Funders' pledges matched to the meter applications DisCos have
   approved (docs/geh/DESIGN.md, section 6c). Pledges and
   applications are synthetic today, and the screen says so. The
   charges a day and the three-phase meter price are assumptions,
   labelled.
========================================================== */

export const MARKETPLACE_PATH = "/dashboard/planning/metering/marketplace";

/** Three-phase meter hardware, in dollars: an assumption (single-phase is the Metering Fund's $45). */
export const THREE_PHASE_HARDWARE_USD = 110;

/** The daily meter charge by band, in naira; null for Lifeline, which is exempt. Assumptions. */
export const DAILY_CHARGE: Record<MarketplaceBand, number | null> = { A1: 200, A3: 250, B: 150, C: 100, D: 75, E: 50, lifeline: null };

export const BAND_LABEL: Record<MarketplaceBand, string> = { A1: "A, single-phase", A3: "A, three-phase", B: "B", C: "C", D: "D", E: "E", lifeline: "Lifeline (R1)" };

/** Bands as shown, richest first. */
const SHOWN_ORDER: MarketplaceBand[] = ["A1", "A3", "B", "C", "D", "E", "lifeline"];

const KIND_LABEL: Record<FunderKind, string> = { private: "Private capital", dfi: "DFI", public: "Public programme" };

const FUNDED_BY: Record<MarketplaceBand, string> = {
  A1: "Private money",
  A3: "Private money",
  B: "Private money",
  C: "DFI and public money (blended)",
  D: "DFI and public money (blended)",
  E: "DFI and public money (blended)",
  lifeline: "Public grant: exempt, not repaid",
};

const DISCOS = Object.keys(DISCO_NAMES) as DiscoId[];

const months = (value: number | null) => (value === null ? "Not repaid: exempt" : `${value.toFixed(1)} months`);

function bandList(bands: readonly MarketplaceBand[]): string {
  return SHOWN_ORDER.filter((band) => bands.includes(band))
    .map((band) => BAND_LABEL[band])
    .join(", ");
}

function discoList(discos: readonly DiscoId[]): string {
  return discos.length === DISCOS.length || DISCOS.every((disco) => discos.includes(disco))
    ? "All 11 DisCos"
    : DISCOS.filter((disco) => discos.includes(disco))
        .map((disco) => DISCO_NAMES[disco])
        .join(", ");
}

/** The band terms: the installed cost of the meter each band needs and its daily charge. */
export function marketplaceTerms(): BandTerms[] {
  const singlePhase = startingCostPerMeter();
  const threePhase = startingCostPerMeter(THREE_PHASE_HARDWARE_USD);
  return SHOWN_ORDER.map((band) => ({ band, meterCost: band === "A3" ? threePhase : singlePhase, chargePerDay: DAILY_CHARGE[band] }));
}

/** The pledges, the applications and their match: the marketplace as it stands. */
export async function marketplaceMatch(repository: MarketplaceRepository): Promise<{ pledges: readonly MeterPledge[]; amountOf: (pledge: MeterPledge) => number; terms: BandTerms[]; result: MatchResult }> {
  const [pledges, applications] = await Promise.all([repository.pledges(), repository.applications()]);
  const terms = marketplaceTerms();
  const singlePhase = terms.find((one) => one.band === "A1")!.meterCost;
  /* A pledge of meters is valued at the single-phase installed cost: the meters it funds (Bands C to E, Lifeline) are single-phase. */
  const amountOf = (pledge: MeterPledge) => pledge.amountNaira ?? (pledge.meters ?? 0) * singlePhase;
  const result = matchPledges(
    pledges.map((pledge) => ({ id: pledge.id, kind: pledge.kind, amountNaira: amountOf(pledge), bands: pledge.bands, discos: pledge.discos, returnPercent: pledge.returnPercent, tenorMonths: pledge.tenorMonths })),
    applications,
    terms,
    DISCOS,
  );
  return { pledges, amountOf, terms, result };
}

export async function marketplaceView(repository: MarketplaceRepository): Promise<MarketplaceView> {
  const [{ pledges, amountOf, terms, result }, applications, sources] = await Promise.all([marketplaceMatch(repository), repository.applications(), repository.sources()]);
  const termsOf = (band: MarketplaceBand) => terms.find((one) => one.band === band)!;
  const singlePhase = termsOf("A1").meterCost;
  const daysPerMonth = MARKETPLACE_REFERENCE.parameters.daysPerMonth;
  const halfCap = MARKETPLACE_REFERENCE.parameters.maxShareOfRecharge;

  const pledged = pledges.reduce((sum, pledge) => sum + amountOf(pledge), 0);
  const matched = result.matches.reduce((sum, one) => sum + one.meters, 0);
  const queued = Object.values(result.pledges).reduce((sum, one) => sum + one.queued, 0);
  const approved = applications.reduce((sum, one) => sum + one.approved, 0);
  const waiting = result.waiting.reduce((sum, one) => sum + one.approved, 0);

  const headline = `${pledges.length} funders have pledged ${formatNaira(pledged)}; ${formatCount(matched)} approved meters are matched; ${formatNaira(queued)} is queued for the next allocation.`;

  const funders: MarketplaceView["funders"] = pledges.map((pledge) => {
    const outcome = result.pledges[pledge.id];
    return {
      id: pledge.id,
      funder: pledge.funder,
      kind: KIND_LABEL[pledge.kind],
      pledged: pledge.meters !== null ? `${formatCount(pledge.meters)} meters (${formatNaira(amountOf(pledge))})` : formatNaira(amountOf(pledge)),
      bands: bandList(pledge.bands),
      discos: discoList(pledge.discos),
      returnAsked: pledge.returnPercent === 0 ? "None: grant" : `${pledge.returnPercent}% a year in ${pledge.returnCurrency === "usd" ? "dollars" : "naira"}`,
      tenor: pledge.tenorMonths === null ? "Not repaid" : `${pledge.tenorMonths} months`,
      matchedMeters: formatCount(outcome.meters),
      placed: formatNaira(outcome.placed),
      queued: outcome.queued >= 1 ? `Queued for the next allocation: ${formatNaira(outcome.queued)}` : "Nothing queued",
      hasQueued: outcome.queued >= 1,
    };
  });

  const bands: MarketplaceView["bands"] = SHOWN_ORDER.map((band) => {
    const one = termsOf(band);
    const perMonth = one.chargePerDay === null ? null : one.chargePerDay * daysPerMonth;
    return {
      band: BAND_LABEL[band],
      meter: band === "A3" ? `Three-phase ($${THREE_PHASE_HARDWARE_USD})` : "Single-phase ($45)",
      meterCost: formatNaira(one.meterCost),
      perDay: one.chargePerDay === null ? "Exempt" : formatNaira(one.chargePerDay),
      perMonth: perMonth === null ? "Exempt" : formatNaira(perMonth),
      minRecharge: perMonth === null ? "Exempt" : formatNaira(perMonth / halfCap),
      monthsToRepay: months(monthsToRepay(one.meterCost, one.chargePerDay)),
      fundedBy: FUNDED_BY[band],
    };
  });

  const approvedOf = (disco: DiscoId, band: MarketplaceBand) => applications.filter((one) => one.disco === disco && one.band === band).reduce((sum, one) => sum + one.approved, 0);
  const demand: MarketplaceView["demand"] = DISCOS.map((disco) => ({
    disco,
    name: DISCO_NAMES[disco],
    approved: SHOWN_ORDER.map((band) => formatCount(approvedOf(disco, band))),
    matched: formatCount(result.matches.filter((one) => one.disco === disco).reduce((sum, one) => sum + one.meters, 0)),
    waiting: formatCount(result.waiting.filter((one) => one.disco === disco).reduce((sum, one) => sum + one.approved, 0)),
  }));

  const matching: MarketplaceView["matching"] = pledges.flatMap((pledge) =>
    BAND_ORDER.flatMap((band) => {
      const rows = result.matches.filter((one) => one.pledgeId === pledge.id && one.band === band);
      if (rows.length === 0) return [];
      return [
        {
          funder: pledge.funder,
          band: BAND_LABEL[band],
          discos: discoList(rows.map((one) => one.disco)),
          meters: formatCount(rows.reduce((sum, one) => sum + one.meters, 0)),
          money: formatNaira(rows.reduce((sum, one) => sum + one.naira, 0)),
        },
      ];
    }),
  );

  const totals: ShownFigure[] = [
    { key: "pledged", label: "Pledged", value: formatNaira(pledged), origin: "synthetic", basis: `${pledges.length} funders' pledges, synthetic; a pledge of meters valued at ${formatNaira(singlePhase)} a meter` },
    { key: "matched", label: "Approved meters matched", value: formatCount(matched), origin: "synthetic", basis: `Of ${formatCount(approved)} approved applications, synthetic` },
    { key: "queued", label: "Queued for the next allocation", value: formatNaira(queued), origin: "synthetic", basis: "Pledged money no approved application in its bands, DisCos and tenor could take" },
    { key: "waiting", label: "Approved applications waiting for a funder", value: formatCount(waiting), origin: "synthetic", basis: "Approved, with no pledge left that may fund them" },
  ];

  return {
    headline,
    headlineHow:
      "How this is calculated: pledges are taken cheapest money first (lowest return). Each is matched to approved applications in its own DisCos and bands, poorest band first: private money to Bands A and B, DFI and public money to Bands C to E, public grants alone to Lifeline, and only where the months to repay fit the pledge's tenor. A meter is matched when the pledge has its full installed cost left; what a pledge cannot place is queued for the next allocation.",
    platformLine:
      "Households, DisCos, programme managers (PMI, DISREP), the World Bank and DFIs, private investors, meter makers and NERC in one place. Money for metering exists; private money holds back because no model reliably pays it back. Here each pledge is matched to approved meters that repay it.",
    totals,
    funders,
    bands,
    bandsHow: `How this is calculated: a daily meter charge is owed every day and taken at each recharge, never more than ${halfCap * 100}% of the recharge, into escrow; anything above that carries to the next recharge. A month = the charge a day × ${daysPerMonth} days. Smallest recharge a month for the full charge = the charge a month ÷ ${halfCap}. Months to repay = installed meter cost ÷ the charge a month. Installed cost = hardware × ₦1,334/$ + 10% duty + ₦25,000 installation (the Metering Fund's defaults).`,
    demandBands: SHOWN_ORDER.map((band) => BAND_LABEL[band]),
    demand,
    demandHow: "Approved meter applications by DisCo and band (synthetic). Matched = approved applications a pledge funds; waiting = approved, with no funder yet.",
    matching,
    matchingHow: "Each row: one funder's meters in one band, the DisCos they go to, and the money placed (meters × installed cost).",
    assumptions: [
      { label: "Daily meter charge", value: "A single-phase ₦200, A three-phase ₦250, B ₦150, C ₦100, D ₦75, E ₦50; Lifeline exempt", basis: "Assumption (Founder, 31 October 2026, for A and B; C to E lower, with blended money; C to E values set by GridIntel)." },
      { label: "Three-phase meter hardware", value: `$${THREE_PHASE_HARDWARE_USD}`, basis: "Assumption. Single-phase is the Metering Fund's $45." },
      { label: "Most of a recharge taken for the meter", value: `${halfCap * 100}%`, basis: "Assumption (Founder, 31 October 2026)." },
      { label: "Pledges and approved applications", value: "Synthetic", basis: "Designed records. No pledge or application is real." },
    ],
    methodology: { id: MARKETPLACE_REFERENCE.id, version: MARKETPLACE_REFERENCE.version, disclaimer: MARKETPLACE_REFERENCE.disclaimer },
    sourcing: { synthetic: sources.some((one) => one.kind === "synthetic"), sources: sources.map((one) => ({ id: one.id, name: one.name, kind: one.kind })) },
  };
}
