import type { DataSource, DiscoId, MarketplaceBand, MeterApplication, MeterJourneyRecord, MeterPledge, PendingApplicationStep, PendingMeterApplications } from "@/domain";
import type { MarketplaceRepository } from "../ports/marketplace.ts";
import { seeded } from "./rng.ts";
import { DEMO_ORGANIZATION_ID } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — SYNTHETIC METERING MARKETPLACE

   Five designed pledges and designed approved meter applications,
   one record per DisCo per band. The funders are styled on kinds of
   real funder (a Mission 300-style programme, a DISREP-style
   programme, a DFI, private funds); none is a real pledge, and no
   application is a real customer's.
========================================================== */

export const SYNTHETIC_MARKETPLACE_SOURCE: DataSource = {
  id: "synthetic-metering-marketplace",
  name: "Synthetic metering marketplace (designed pledges and applications)",
  kind: "synthetic",
  description: "Five designed funders' pledges and designed approved meter applications by DisCo and band. No pledge or application is real.",
};

const ALL: DiscoId[] = ["abuja", "benin", "eko", "enugu", "ibadan", "ikeja", "jos", "kaduna", "kano", "port_harcourt", "yola"];
const source = SYNTHETIC_MARKETPLACE_SOURCE.id;

const PLEDGES: MeterPledge[] = [
  { id: "mission-300", funder: "Mission 300-style programme", kind: "public", amountNaira: null, meters: 1_000, bands: ["B", "C", "D", "E", "lifeline"], discos: ALL, returnPercent: 0, returnCurrency: "naira", tenorMonths: null, sourceId: source },
  { id: "private-1", funder: "Private capital fund", kind: "private", amountNaira: 150_000_000, meters: null, bands: ["A1", "A3"], discos: ["abuja", "eko", "ikeja"], returnPercent: 22, returnCurrency: "naira", tenorMonths: 36, sourceId: source },
  { id: "dfi", funder: "DFI (cheaper, longer money)", kind: "dfi", amountNaira: 400_000_000, meters: null, bands: ["B", "C", "D", "E"], discos: ALL, returnPercent: 8, returnCurrency: "usd", tenorMonths: 84, sourceId: source },
  { id: "disrep", funder: "DISREP-style programme", kind: "public", amountNaira: 120_000_000, meters: null, bands: ["B", "C", "D", "E", "lifeline"], discos: ["jos", "kaduna", "kano", "yola"], returnPercent: 0, returnCurrency: "naira", tenorMonths: null, sourceId: source },
  { id: "private-2", funder: "Second private fund", kind: "private", amountNaira: 80_000_000, meters: null, bands: ["A1", "A3"], discos: ["enugu", "ibadan", "port_harcourt"], returnPercent: 24, returnCurrency: "naira", tenorMonths: 24, sourceId: source },
];

/** One designed household in Ibadan, Band A single-phase, followed from application to repayment. Not a real customer. */
const JOURNEYS: MeterJourneyRecord[] = [
  { reference: "IB-A-00412", disco: "ibadan", band: "A1", feeder: "11 kV feeder IB-07", appliedOn: "2026-07-06", approvedOn: "2026-07-14", fundedOn: "2026-08-01", installedOn: "2026-08-19", confirmedOn: "2026-08-21", rechargeNaira: 5_000, rechargeEveryDays: 7, sourceId: source },
];

/** The range of approved applications a DisCo holds for a band. */
const RANGE: Record<MarketplaceBand, [number, number]> = { A1: [20, 150], A3: [5, 40], B: [40, 250], C: [60, 300], D: [40, 220], E: [20, 160], lifeline: [20, 120] };

/** The range of applications a DisCo holds waiting at each step before approval (Phase NAV-A: the count on the initiative card). */
const PENDING_RANGE: Record<PendingApplicationStep, [number, number]> = { submitted: [40, 260], under_review: [20, 140], verified: [10, 90], assigned: [5, 60] };

export function createSyntheticMarketplace(): MarketplaceRepository {
  const applications: MeterApplication[] = ALL.flatMap((disco) =>
    (Object.keys(RANGE) as MarketplaceBand[]).map((band) => {
      const random = seeded(`marketplace:${disco}:${band}`);
      const [low, high] = RANGE[band];
      return { disco, band, approved: Math.round(low + (high - low) * random()), sourceId: source };
    }),
  );
  // The eleven DisCos' queues, and the synthetic demonstration DisCo's own (its workspace counts that one only).
  const pending: PendingMeterApplications[] = [...ALL, DEMO_ORGANIZATION_ID].flatMap((disco) =>
    (Object.keys(PENDING_RANGE) as PendingApplicationStep[]).map((step) => {
      const random = seeded(`marketplace:pending:${disco}:${step}`);
      const [low, high] = PENDING_RANGE[step];
      return { disco, step, count: Math.round(low + (high - low) * random()), sourceId: source };
    }),
  );
  return {
    pledges: async () => PLEDGES,
    applications: async () => applications,
    pending: async () => pending,
    journeys: async () => JOURNEYS,
    sources: async () => [SYNTHETIC_MARKETPLACE_SOURCE],
  };
}
