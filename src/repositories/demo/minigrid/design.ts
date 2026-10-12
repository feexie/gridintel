import type { DataSource, InterruptionCause } from "@/domain";

/* ==========================================================
   DEMO ADAPTER — MINI-GRID SITES: THE DESIGN

   Four INVENTED mini-grid sites operated by one invented operator,
   for September 2026. Every figure below is an assumption of the
   synthetic model, recorded in DATASET_ASSUMPTIONS.md. No site,
   developer, capacity, tariff or customer here is real, and the
   names are made up. Each site is placed in a climatic zone of
   Nigeria, not at a real community.

   Each site is designed to show one condition:
     MG-TAM  Tamarind Cross   a well-run solar-hybrid
     MG-DRY  Dry River        heavy dependence on its generator
     MG-PLM  Palm Landing     poor collection
     MG-GRN  Granite Hill     low demand

   Tariffs are assumptions, not current or published rates.
========================================================== */

export const MINIGRID_ORGANIZATION_ID = "demo-minigrid-operator";
export const MINIGRID_ORGANIZATION_NAME = "Demonstration Mini-grid Operator (synthetic)";
export const MINIGRID_CURRENCY = "NGN";

function source(id: string, name: string, description: string): DataSource {
  return { id, name, kind: "synthetic", organizationId: MINIGRID_ORGANIZATION_ID, description };
}

export const SITE_REGISTRY_SOURCE = source("synthetic-minigrid-registry", "Synthetic mini-grid site register", "Stands in for an operator's asset and customer register: sites, generation assets, meters, connections, accounts.");
export const SITE_METERING_SOURCE = source("synthetic-minigrid-metering", "Synthetic mini-grid meter data", "Stands in for a smart-meter platform: hourly energy of the powerhouse meters, daily energy of customer meters.");
export const SITE_MONITORING_SOURCE = source(
  "synthetic-minigrid-monitoring",
  "Synthetic mini-grid plant monitoring",
  "Stands in for a plant monitoring system: irradiance, battery state of charge, generator hour and fuel registers, the controller's curtailment estimate, and the interruption log.",
);
export const SITE_BILLING_SOURCE = source("synthetic-minigrid-billing", "Synthetic mini-grid vending and billing", "Stands in for a prepaid vending and billing platform: vends, bills and payments.");
export const SITE_REPORT_SOURCE = source("synthetic-minigrid-reports", "Synthetic mini-grid site reports", "Stands in for the operator's monthly site performance report to its funders.");

export const MINIGRID_DATA_SOURCES: readonly DataSource[] = [SITE_REGISTRY_SOURCE, SITE_METERING_SOURCE, SITE_MONITORING_SOURCE, SITE_BILLING_SOURCE, SITE_REPORT_SOURCE];

export type LoadShape = "residential" | "commercial" | "productive" | "public";

/** A group of like connections at a site. */
export interface ConnectionGroup {
  /** The operator's tariff tier, as it names it. */
  tier: string;
  category: "residential" | "commercial" | "public";
  productiveUse: boolean;
  shape: LoadShape;
  count: number;
  /** Mean daily demand of one connection, kWh. */
  dailyKwh: number;
  /** Assumed tariff, NGN per kWh. Not a current or published rate. */
  tariffNgnPerKwh: number;
  paymentMode: "prepaid" | "postpaid";
  /** Of these, how many accounts are disconnected: on the register, drawing nothing. */
  disconnected?: number;
}

export interface DesignedInterruption {
  day: number;
  hour: number;
  hours: number;
  cause: InterruptionCause;
  planned: boolean;
  /** Connections affected; all active connections when absent. */
  customers?: number;
  note: string;
}

export interface SiteDesign {
  id: string;
  code: string;
  name: string;
  /** The climatic zone the site is placed in. Illustrative: not a real community. */
  zone: string;
  latitude: number;
  longitude: number;
  commissioned: string;
  pvKwp: number;
  batteryKwh: number;
  batteryKw: number;
  /** What the battery can hold today as a share of nameplate. The registry does not know this. */
  batteryHealth: number;
  /** Lowest state of charge the controller allows, as a share of what the battery can hold. */
  minimumSoc: number;
  generator: { kva: number; kw: number; policy: "backup" | "evening_and_backup"; outOfService?: { fromDay: number; toDay: number } } | null;
  /** Mean daily in-plane irradiation for the month, kWh/m², and how far a day may fall below or rise above it. */
  irradiation: { meanDaily: number; low: number; high: number };
  /** PV output as a share of rated power × irradiation, before any curtailment. */
  pvSystemEfficiency: number;
  /** Share of the energy sent out that does not reach a customer meter. */
  distributionLoss: number;
  /** The powerhouse's own draw, kW. */
  stationKw: number;
  groups: readonly ConnectionGroup[];
  /** How postpaid accounts pay: the shares that pay in full and not at all; the rest pay part. */
  postpaid: { full: number; none: number };
  interruptions: readonly DesignedInterruption[];
  /** Customer meters that reported nothing on some days: a gap, not a zero. */
  meterGaps?: { meters: number; fromDay: number; days: number };
}

const TIER_1 = "Tier 1 (basic household)";
const TIER_2 = "Tier 2 (household)";
const TIER_3 = "Tier 3 (commercial)";
const TIER_4 = "Tier 4 (productive use)";
const PUBLIC = "Public institution";

function groups(counts: { t1: [number, number]; t2: [number, number]; t3: [number, number]; t4: [number, number]; pub: [number, number] }, tariff: number, mode: "prepaid" | "postpaid", disconnected = 0): ConnectionGroup[] {
  return [
    { tier: TIER_1, category: "residential", productiveUse: false, shape: "residential", count: counts.t1[0], dailyKwh: counts.t1[1], tariffNgnPerKwh: tariff, paymentMode: mode, disconnected },
    { tier: TIER_2, category: "residential", productiveUse: false, shape: "residential", count: counts.t2[0], dailyKwh: counts.t2[1], tariffNgnPerKwh: tariff, paymentMode: mode },
    { tier: TIER_3, category: "commercial", productiveUse: false, shape: "commercial", count: counts.t3[0], dailyKwh: counts.t3[1], tariffNgnPerKwh: tariff + 20, paymentMode: mode },
    { tier: TIER_4, category: "commercial", productiveUse: true, shape: "productive", count: counts.t4[0], dailyKwh: counts.t4[1], tariffNgnPerKwh: tariff - 30, paymentMode: mode },
    // Clinics, schools and the like are billed after the month everywhere, and pay late.
    { tier: PUBLIC, category: "public", productiveUse: false, shape: "public", count: counts.pub[0], dailyKwh: counts.pub[1], tariffNgnPerKwh: tariff, paymentMode: "postpaid" },
  ];
}

export const SITES: readonly SiteDesign[] = [
  {
    id: "MG-TAM",
    code: "TAM",
    name: "Tamarind Cross",
    zone: "Sudan savanna, north-west",
    latitude: 12.45,
    longitude: 5.6,
    commissioned: "2023-03-01",
    pvKwp: 100,
    batteryKwh: 240,
    batteryKw: 80,
    batteryHealth: 0.95,
    minimumSoc: 0.15,
    generator: { kva: 50, kw: 40, policy: "backup" },
    irradiation: { meanDaily: 5.6, low: 0.72, high: 1.12 },
    pvSystemEfficiency: 0.79,
    distributionLoss: 0.07,
    stationKw: 0.3,
    groups: groups({ t1: [330, 0.28], t2: [60, 0.9], t3: [55, 1.6], t4: [14, 9], pub: [6, 3] }, 260, "prepaid"),
    postpaid: { full: 0.5, none: 0.17 },
    interruptions: [
      { day: 9, hour: 10, hours: 2, cause: "planned_maintenance", planned: true, note: "Planned inverter service." },
      { day: 21, hour: 19, hours: 1, cause: "fault", planned: false, customers: 120, note: "Fault on one low-voltage branch." },
    ],
  },
  {
    id: "MG-DRY",
    code: "DRY",
    name: "Dry River",
    zone: "Guinea savanna, middle belt",
    latitude: 9.6,
    longitude: 7.9,
    commissioned: "2019-11-01",
    pvKwp: 45,
    batteryKwh: 90,
    batteryKw: 40,
    batteryHealth: 0.7,
    minimumSoc: 0.2,
    generator: { kva: 60, kw: 48, policy: "evening_and_backup", outOfService: { fromDay: 17, toDay: 19 } },
    irradiation: { meanDaily: 4.7, low: 0.6, high: 1.2 },
    pvSystemEfficiency: 0.76,
    distributionLoss: 0.1,
    stationKw: 0.3,
    groups: groups({ t1: [230, 0.3], t2: [30, 1.0], t3: [28, 2.0], t4: [9, 12], pub: [3, 3] }, 290, "prepaid"),
    postpaid: { full: 0.34, none: 0.33 },
    interruptions: [{ day: 5, hour: 14, hours: 3, cause: "fault", planned: false, note: "Fault at the powerhouse busbar." }],
    meterGaps: { meters: 6, fromDay: 12, days: 4 },
  },
  {
    id: "MG-PLM",
    code: "PLM",
    name: "Palm Landing",
    zone: "Rainforest, south",
    latitude: 5.35,
    longitude: 6.15,
    commissioned: "2021-06-01",
    pvKwp: 80,
    batteryKwh: 200,
    batteryKw: 60,
    batteryHealth: 0.9,
    minimumSoc: 0.15,
    generator: { kva: 40, kw: 32, policy: "backup" },
    irradiation: { meanDaily: 3.7, low: 0.5, high: 1.3 },
    pvSystemEfficiency: 0.77,
    distributionLoss: 0.14,
    stationKw: 0.3,
    // Palm Landing sells on credit: every account is billed after the month.
    groups: groups({ t1: [324, 0.3], t2: [40, 0.9], t3: [40, 1.5], t4: [8, 8], pub: [5, 3] }, 270, "postpaid", 24),
    postpaid: { full: 0.46, none: 0.24 },
    interruptions: [
      { day: 12, hour: 16, hours: 6, cause: "weather", planned: false, note: "Storm damage to the distribution network." },
      { day: 24, hour: 9, hours: 3, cause: "planned_maintenance", planned: true, note: "Planned line work." },
    ],
  },
  {
    id: "MG-GRN",
    code: "GRN",
    name: "Granite Hill",
    zone: "Sudan savanna, north-east",
    latitude: 10.5,
    longitude: 10.7,
    commissioned: "2024-09-01",
    pvKwp: 60,
    batteryKwh: 150,
    batteryKw: 40,
    batteryHealth: 0.98,
    minimumSoc: 0.15,
    generator: null,
    irradiation: { meanDaily: 5.3, low: 0.75, high: 1.12 },
    pvSystemEfficiency: 0.79,
    distributionLoss: 0.05,
    stationKw: 0.25,
    groups: groups({ t1: [110, 0.22], t2: [8, 0.7], t3: [9, 1.2], t4: [1, 6], pub: [2, 2.5] }, 260, "prepaid"),
    postpaid: { full: 0.5, none: 0 },
    interruptions: [{ day: 15, hour: 8, hours: 2, cause: "fault", planned: false, note: "Inverter trip." }],
  },
];

/** One connection of a site, in the order the registry lists them. */
export interface SiteConnection {
  siteId: string;
  number: number;
  servicePointId: string;
  meterId: string;
  customerId: string;
  group: ConnectionGroup;
  active: boolean;
}

export function connectionsOfSite(site: SiteDesign): SiteConnection[] {
  const connections: SiteConnection[] = [];
  let number = 0;
  for (const group of site.groups) {
    for (let i = 0; i < group.count; i++) {
      number += 1;
      const serial = String(number).padStart(3, "0");
      connections.push({
        siteId: site.id,
        number,
        servicePointId: `SP-${site.code}-${serial}`,
        meterId: `M-${site.code}-${serial}`,
        customerId: `C-${site.code}-${serial}`,
        group,
        // The last accounts of a group are the disconnected ones.
        active: i < group.count - (group.disconnected ?? 0),
      });
    }
  }
  return connections;
}

export const PV_ASSET = (site: SiteDesign) => `${site.id}-PV1`;
export const BATTERY_ASSET = (site: SiteDesign) => `${site.id}-BAT1`;
export const GENERATOR_ASSET = (site: SiteDesign) => `${site.id}-GEN1`;
export const meterOf = (assetOrSiteId: string) => `M-${assetOrSiteId}`;
export const OUTPUT_METER = (site: SiteDesign) => `M-${site.id}-OUT`;
