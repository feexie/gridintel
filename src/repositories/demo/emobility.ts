import type { Citation, DataSource, Hub, HubOperator, HubPledge, HubSwapDay } from "@/domain";
import type { EmobilityRepository } from "../ports/emobility.ts";
import { DEMO_DAYS, PERIOD_START_MS } from "./clock.ts";
import { round, seeded } from "./rng.ts";
import { DEMO_ORGANIZATION_ID } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — SYNTHETIC E-MOBILITY HUBS

   Six designed swap hubs on transformers of the synthetic Savanna
   network, two invented operators, four designed pledges and a month
   of swaps at the one installed hub. No hub, operator, pledge or swap
   is real, and no real company is named.

   Each hub is placed to show one case (docs/design/EMOB-A-PLAN.md,
   section 6). The transformers were picked from their observed peaks
   in the demonstration month; no assumption was changed to make a
   case appear:
   - HUB-01, DT-MKT-8 (500 kVA): fits now and at 48 months;
   - HUB-02, DT-GOV-4 (300 kVA): the demonstration hub, 300 swaps a
     day; fits now, not at 24 months under base adoption;
   - HUB-03, DT-FRM-1 (Farm Road, Band D): too few hours of supply
     for its chargers to take the day's energy from the grid;
   - HUB-04, DT-OLD-2: the transformer is already over its rating;
   - HUB-05, DT-MKT-1: installed, with a month of swaps (Verify);
   - HUB-06, DT-OLD-10 (Old Town, Band C): tricycles.

   Hub costs are synthetic round figures, there only so pledge
   matching has something to match. They are not investment figures.

   The solar resource is reported: NASA POWER's climatology for the
   1° cell the whole network lies in, so every hub takes the same
   figure, each with its own record of it.
========================================================== */

export const SYNTHETIC_EMOBILITY_SOURCE: DataSource = {
  id: "synthetic-emobility",
  name: "Synthetic e-mobility hubs (designed hubs, operators, pledges and swaps)",
  kind: "synthetic",
  organizationId: DEMO_ORGANIZATION_ID,
  description:
    "Six designed swap hubs on the synthetic network's transformers, two invented operators, four designed pledges and a month of swaps at one hub. Hub costs are synthetic. No record is real.",
};

export const NASA_POWER_CITATION: Citation = {
  id: "nasa-power-climatology-9.25N-12.47E",
  title:
    "NASA POWER Climatology API v2.10.1, ALLSKY_SFC_SW_DWN (all-sky surface shortwave downward irradiance, kWh/m²/day), January 2001 to December 2025, at 9.25° N, 12.47° E; retrieved 16 November 2026",
  url: "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=12.47&latitude=9.25&format=JSON",
  published: null,
  standing: "primary",
  locator: "ANN 5.7269; AUG 4.7299 (the lowest month)",
};

const source = SYNTHETIC_EMOBILITY_SOURCE.id;
const solar = { annualPeakSunHours: 5.73, rainySeasonPeakSunHours: 4.73, rainySeasonMonth: "August", citationId: NASA_POWER_CITATION.id };

const OPERATORS: HubOperator[] = [
  { id: "OP-NORTH", name: "Northfield Swap Co-operative (synthetic)", sourceId: source },
  { id: "OP-RIVER", name: "Riverside Battery Exchange (synthetic)", sourceId: source },
];

const HUBS: Hub[] = [
  { id: "HUB-01", name: "Market Road hub (synthetic)", kind: "swap", operatorId: "OP-RIVER", transformerId: "DT-MKT-8", location: { latitude: 9.2395, longitude: 12.4905 }, status: "candidate", plannedSwapsPerDay: { motorcycle: 150 }, chargerKw: 80, solar, costNaira: 45_000_000, installedOn: null, sourceId: source },
  { id: "HUB-02", name: "Government Avenue hub (synthetic)", kind: "swap", operatorId: "OP-NORTH", transformerId: "DT-GOV-4", location: { latitude: 9.2805, longitude: 12.5125 }, status: "planned", plannedSwapsPerDay: { motorcycle: 300 }, chargerKw: 120, solar, costNaira: 90_000_000, installedOn: null, sourceId: source },
  { id: "HUB-03", name: "Farm Road hub (synthetic)", kind: "swap", operatorId: "OP-NORTH", transformerId: "DT-FRM-1", location: { latitude: 9.2705, longitude: 12.4955 }, status: "candidate", plannedSwapsPerDay: { motorcycle: 120 }, chargerKw: 30, solar, costNaira: 36_000_000, installedOn: null, sourceId: source },
  { id: "HUB-04", name: "Old Town hub (synthetic)", kind: "swap", operatorId: "OP-RIVER", transformerId: "DT-OLD-2", location: { latitude: 9.2272, longitude: 12.4632 }, status: "candidate", plannedSwapsPerDay: { motorcycle: 100 }, chargerKw: 40, solar, costNaira: 30_000_000, installedOn: null, sourceId: source },
  { id: "HUB-05", name: "Market Road North hub (synthetic)", kind: "swap", operatorId: "OP-RIVER", transformerId: "DT-MKT-1", location: { latitude: 9.2334, longitude: 12.4686 }, status: "installed", plannedSwapsPerDay: { motorcycle: 160, tricycle: 40 }, chargerKw: 80, solar, costNaira: 60_000_000, installedOn: "2026-08-03", sourceId: source },
  { id: "HUB-06", name: "Old Town tricycle hub (synthetic)", kind: "swap", operatorId: "OP-NORTH", transformerId: "DT-OLD-10", location: { latitude: 9.2215, longitude: 12.4562 }, status: "candidate", plannedSwapsPerDay: { tricycle: 150 }, chargerKw: 60, solar, costNaira: 45_000_000, installedOn: null, sourceId: source },
];

const PLEDGES: HubPledge[] = [
  { id: "PL-GRANT", funder: "Public clean-transport grant (synthetic)", kind: "public", amountNaira: 40_000_000, returnPercent: 0, tenorMonths: null, feeders: ["FD-FRM", "FD-OLD"], sourceId: source },
  { id: "PL-DFI", funder: "Development finance institution (synthetic)", kind: "dfi", amountNaira: 150_000_000, returnPercent: 9, tenorMonths: 36, feeders: ["FD-MKT", "FD-GOV", "FD-OLD", "FD-FRM"], sourceId: source },
  { id: "PL-PRIVATE", funder: "Private asset fund (synthetic)", kind: "private", amountNaira: 100_000_000, returnPercent: 20, tenorMonths: 18, feeders: ["FD-OLD", "FD-GOV"], sourceId: source },
  // Asks to be repaid within three months: no hub repays that fast, so its money is queued.
  { id: "PL-SHORT", funder: "Short-term lender (synthetic)", kind: "private", amountNaira: 50_000_000, returnPercent: 24, tenorMonths: 3, feeders: ["FD-MKT"], sourceId: source },
];

const DAY_MS = 86_400_000;

/** A month of swaps at the installed hub: swaps around its plan, a metered kWh a swap, and a few days of reduced availability. */
function swapMonth(hub: Hub): HubSwapDay[] {
  const random = seeded(`emobility:${hub.id}`);
  const planned = Object.values(hub.plannedSwapsPerDay).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const days: HubSwapDay[] = [];
  for (let day = 0; day < DEMO_DAYS; day++) {
    const reduced = random() < 0.15;
    const minutesAvailable = reduced ? 600 + Math.round(random() * 360) : 1_440;
    const swaps = Math.round(planned * (0.8 + random() * 0.3) * (minutesAvailable / 1_440));
    days.push({ hubId: hub.id, day: new Date(PERIOD_START_MS + day * DAY_MS + 3_600_000).toISOString().slice(0, 10), swaps, kwhCharged: round(swaps * (2.7 + random() * 0.4), 1), minutesAvailable, sourceId: source });
  }
  return days;
}

export function createSyntheticEmobility(): EmobilityRepository {
  const swapDays = HUBS.filter((hub) => hub.status === "installed").flatMap(swapMonth);
  return {
    hubs: async () => HUBS,
    operators: async () => OPERATORS,
    pledges: async () => PLEDGES,
    swapDays: async () => swapDays,
    citations: async () => [NASA_POWER_CITATION],
    sources: async () => [SYNTHETIC_EMOBILITY_SOURCE],
  };
}
