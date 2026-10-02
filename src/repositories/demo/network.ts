import type {
  Coordinates,
  Customer,
  DistributionTransformer,
  EdgeDevice,
  Feeder,
  Meter,
  Organization,
  PowerTransformer,
  Region,
  ServiceBand,
  ServicePoint,
  Substation,
} from "@/domain";
import type { NetworkRegistrySnapshot } from "../ports/index.ts";
import { DEMO_PERIOD } from "./clock.ts";
import { round, seeded } from "./rng.ts";
import { DEMO_ORGANIZATION_ID, REGISTRY_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — NETWORK DESIGN AND REGISTRY

   The design of the synthetic network. Every number here is an
   assumption, listed in DATASET_ASSUMPTIONS.md. Names are invented;
   the coordinates place the network near Yola only so that a map
   has somewhere to draw it. It represents no real asset.
========================================================== */

export const DEMO_REGION_ID = "demo-region-northfield";
export const DEMO_SUBSTATION_ID = "SS-RIV";
export const DEMO_CURRENCY = "NGN";

export type CustomerCategory = "residential" | "commercial" | "industrial";
export type Metering = "prepaid" | "postpaid" | "unmetered";

/** How likely an account is to pay a bill in full, or not at all; the rest pay part. */
export interface PaymentBehaviour {
  full: number;
  none: number;
}

export interface FeederPlan {
  id: string;
  name: string;
  band: ServiceBand;
  /** MV line loss as a fraction of the energy entering the feeder. */
  mvLoss: number;
  /** Tariff in NGN per kWh. An assumption, not a current published rate. */
  tariffNgnPerKwh: number;
  tariffCode: string;
  /** Share of metered accounts whose meter is bypassed. */
  bypassShare: number;
  /** Monthly energy billed to an unmetered account, by category (kWh). */
  estimatedKwh: Record<"residential" | "commercial", number>;
  payment: Record<"postpaid" | "unmetered", PaymentBehaviour>;
  ratedCurrentA: number;
}

interface CustomerGroup {
  category: "residential" | "commercial";
  count: number;
  /** Mean demand at the category's peak hour, kW. */
  meanPeakKw: number;
  prepaid: number;
  postpaid: number;
}

export interface TransformerPlan {
  key: string;
  id: string;
  name: string;
  feederId: string;
  ratingKva: number;
  location: Coordinates;
  /** LV network and transformer loss as a fraction of the energy entering the transformer. */
  lvLoss: number;
  powerFactor: number;
  groups: CustomerGroup[];
  /** Share of accounts disconnected for the whole month. */
  disconnectedShare: number;
}

/** The meter of a bypassed connection records this share of what is consumed. */
export const BYPASS_RECORDED_FRACTION = 0.45;
/** An unmetered connection uses this much more than a metered one of the same kind. */
export const UNMETERED_USE_FACTOR = 1.25;
/** Loss in the power transformer and busbars, as a fraction of the energy entering the substation. */
export const SUBSTATION_LOSS = 0.01;

export const FEEDERS: readonly FeederPlan[] = [
  {
    id: "FD-MKT",
    name: "Market Road 11 kV feeder",
    band: "A",
    mvLoss: 0.02,
    tariffNgnPerKwh: 209.5,
    tariffCode: "Band A",
    bypassShare: 0.05,
    estimatedKwh: { residential: 220, commercial: 600 },
    payment: { postpaid: { full: 0.7, none: 0.08 }, unmetered: { full: 0.4, none: 0.25 } },
    ratedCurrentA: 120,
  },
  {
    id: "FD-OLD",
    name: "Old Town 11 kV feeder",
    band: "C",
    mvLoss: 0.035,
    tariffNgnPerKwh: 50,
    tariffCode: "Band C",
    bypassShare: 0.08,
    estimatedKwh: { residential: 90, commercial: 250 },
    payment: { postpaid: { full: 0.4, none: 0.3 }, unmetered: { full: 0.15, none: 0.5 } },
    ratedCurrentA: 120,
  },
];

const SUBSTATION_LOCATION: Coordinates = { latitude: 9.23, longitude: 12.46 };

export const TRANSFORMERS: readonly TransformerPlan[] = [
  {
    key: "MKT1",
    id: "DT-MKT-1",
    name: "Market Square transformer",
    feederId: "FD-MKT",
    ratingKva: 300,
    location: { latitude: 9.233, longitude: 12.468 },
    lvLoss: 0.05,
    powerFactor: 0.9,
    disconnectedShare: 0,
    groups: [
      { category: "commercial", count: 45, meanPeakKw: 3.2, prepaid: 0.6, postpaid: 0.3 },
      { category: "residential", count: 15, meanPeakKw: 0.9, prepaid: 0.7, postpaid: 0.2 },
    ],
  },
  {
    key: "MKT2",
    id: "DT-MKT-2",
    name: "Garden Estate transformer",
    feederId: "FD-MKT",
    ratingKva: 100,
    location: { latitude: 9.2365, longitude: 12.4755 },
    lvLoss: 0.055,
    powerFactor: 0.9,
    disconnectedShare: 0,
    groups: [
      { category: "residential", count: 70, meanPeakKw: 0.9, prepaid: 0.65, postpaid: 0.2 },
      { category: "commercial", count: 6, meanPeakKw: 2.5, prepaid: 0.5, postpaid: 0.5 },
    ],
  },
  {
    key: "MKT3",
    id: "DT-MKT-3",
    name: "Hilltop Close transformer",
    feederId: "FD-MKT",
    ratingKva: 50,
    location: { latitude: 9.24, longitude: 12.483 },
    lvLoss: 0.045,
    powerFactor: 0.9,
    disconnectedShare: 0,
    // Fully metered: the one transformer whose downstream boundary is complete.
    groups: [{ category: "residential", count: 30, meanPeakKw: 0.9, prepaid: 0.7, postpaid: 0.3 }],
  },
  {
    key: "OLD1",
    id: "DT-OLD-1",
    name: "Old Town Central transformer",
    feederId: "FD-OLD",
    ratingKva: 100,
    location: { latitude: 9.2255, longitude: 12.453 },
    lvLoss: 0.08,
    powerFactor: 0.86,
    disconnectedShare: 0.03,
    groups: [
      { category: "residential", count: 80, meanPeakKw: 0.55, prepaid: 0.3, postpaid: 0.15 },
      { category: "commercial", count: 5, meanPeakKw: 2.5, prepaid: 0.4, postpaid: 0.2 },
    ],
  },
  {
    key: "OLD2",
    id: "DT-OLD-2",
    name: "Riverbank transformer",
    feederId: "FD-OLD",
    ratingKva: 100,
    location: { latitude: 9.2205, longitude: 12.4465 },
    lvLoss: 0.1,
    powerFactor: 0.86,
    disconnectedShare: 0.03,
    // Too many connections for its rating: the overloaded transformer.
    groups: [{ category: "residential", count: 135, meanPeakKw: 0.55, prepaid: 0.25, postpaid: 0.15 }],
  },
  {
    key: "OLD3",
    id: "DT-OLD-3",
    name: "South Gate transformer",
    feederId: "FD-OLD",
    ratingKva: 50,
    location: { latitude: 9.216, longitude: 12.44 },
    lvLoss: 0.075,
    powerFactor: 0.86,
    disconnectedShare: 0.03,
    groups: [{ category: "residential", count: 45, meanPeakKw: 0.55, prepaid: 0.35, postpaid: 0.2 }],
  },
];

/** The one customer supplied at 11 kV, directly from the Market Road feeder. */
export const MV_CUSTOMER = {
  key: "MKTMV",
  feederId: "FD-MKT",
  servicePointId: "SP-MKT-MV-001",
  customerId: "C-MKT-MV-001",
  meterId: "M-MKT-MV-001",
  peakKw: 120,
  powerFactor: 0.92,
  location: { latitude: 9.2345, longitude: 12.4715 } satisfies Coordinates,
  tariffCode: "Band A MD",
  /** Share of each bill this account pays. */
  paymentFraction: 0.93,
};

/** One connection in the design: what the generator knows, including what the utility does not. */
export interface ConnectionPlan {
  /** A transformer key, or the MV customer's key. */
  supplyKey: string;
  feederId: string;
  servicePointId: string;
  customerId: string;
  /** Absent for an unmetered connection. */
  meterId?: string;
  category: CustomerCategory;
  metering: Metering;
  /** Demand at the category's peak hour, kW. Known only to the generator. */
  peakKw: number;
  /** Share of consumption the meter records; 1 unless the meter is bypassed. */
  recordedFraction: number;
  disconnected: boolean;
}

export const BOUNDARY_METERS = {
  incomer: "M-SS-RIV-IN",
  feederHead: (feederId: string) => `M-${feederId}-HEAD`,
  totalizer: (transformerId: string) => `M-${transformerId}-TOT`,
};

const AUDIT = { createdAt: DEMO_PERIOD.start, updatedAt: DEMO_PERIOD.start };

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

function planConnections(): ConnectionPlan[] {
  const connections: ConnectionPlan[] = [];
  for (const dt of TRANSFORMERS) {
    const feeder = FEEDERS.find((f) => f.id === dt.feederId) as FeederPlan;
    const random = seeded(`connections:${dt.key}`);
    let n = 0;
    for (const group of dt.groups) {
      for (let i = 0; i < group.count; i++) {
        n += 1;
        const draw = random();
        const metering: Metering =
          draw < group.prepaid ? "prepaid" : draw < group.prepaid + group.postpaid ? "postpaid" : "unmetered";
        const size = 0.5 + random();
        const bypassed = random() < feeder.bypassShare;
        const disconnected = random() < dt.disconnectedShare;
        connections.push({
          supplyKey: dt.key,
          feederId: dt.feederId,
          servicePointId: `SP-${dt.key}-${pad(n)}`,
          customerId: `C-${dt.key}-${pad(n)}`,
          ...(metering === "unmetered" ? {} : { meterId: `M-${dt.key}-${pad(n)}` }),
          category: group.category,
          metering,
          peakKw: disconnected ? 0 : round(group.meanPeakKw * size * (metering === "unmetered" ? UNMETERED_USE_FACTOR : 1), 3),
          recordedFraction: metering !== "unmetered" && bypassed ? BYPASS_RECORDED_FRACTION : 1,
          disconnected,
        });
      }
    }
  }
  connections.push({
    supplyKey: MV_CUSTOMER.key,
    feederId: MV_CUSTOMER.feederId,
    servicePointId: MV_CUSTOMER.servicePointId,
    customerId: MV_CUSTOMER.customerId,
    meterId: MV_CUSTOMER.meterId,
    category: "industrial",
    metering: "postpaid",
    peakKw: MV_CUSTOMER.peakKw,
    recordedFraction: 1,
    disconnected: false,
  });
  return connections;
}

/** Every connection in the design, in a stable order. */
export const CONNECTIONS: readonly ConnectionPlan[] = planConnections();

/** Active accounts on a transformer (or on the MV connection). */
export function activeAccounts(supplyKey: string): number {
  return CONNECTIONS.filter((c) => c.supplyKey === supplyKey && !c.disconnected).length;
}

export function buildDemoRegistry(): NetworkRegistrySnapshot {
  const provenance = demoProvenance(REGISTRY_SOURCE);

  const organizations: Organization[] = [
    {
      ...AUDIT,
      id: DEMO_ORGANIZATION_ID,
      name: "Savanna Electricity Distribution (synthetic)",
      shortName: "Savanna Electric",
      kind: "distribution_utility",
      countryCode: "NG",
      timezone: "Africa/Lagos",
      currency: DEMO_CURRENCY,
      provenance,
    },
  ];
  const regions: Region[] = [
    { ...AUDIT, id: DEMO_REGION_ID, organizationId: DEMO_ORGANIZATION_ID, name: "Northfield Region", code: "NFD", provenance },
  ];
  const substations: Substation[] = [
    {
      ...AUDIT,
      id: DEMO_SUBSTATION_ID,
      code: "RIV",
      name: "Riverside 33/11 kV injection substation",
      kind: "injection",
      primaryVoltageKv: 33,
      secondaryVoltageKv: 11,
      adminRegionId: DEMO_REGION_ID,
      location: SUBSTATION_LOCATION,
      lifecycle: "in_service",
      provenance,
    },
  ];
  const powerTransformers: PowerTransformer[] = [
    {
      ...AUDIT,
      id: "PT-RIV-1",
      substationId: DEMO_SUBSTATION_ID,
      name: "Riverside T1",
      ratingMva: 2.5,
      primaryVoltageKv: 33,
      secondaryVoltageKv: 11,
      lifecycle: "in_service",
      provenance,
    },
  ];
  const feeders: Feeder[] = FEEDERS.map((plan) => ({
    ...AUDIT,
    id: plan.id,
    code: plan.id,
    name: plan.name,
    origin: { kind: "substation", substationId: DEMO_SUBSTATION_ID, powerTransformerId: "PT-RIV-1" },
    serviceBand: plan.band,
    route: [SUBSTATION_LOCATION, ...TRANSFORMERS.filter((dt) => dt.feederId === plan.id).map((dt) => dt.location)],
    nominalVoltageKv: 11,
    ratedCurrentA: plan.ratedCurrentA,
    ratedCapacityMva: round((Math.sqrt(3) * 11 * plan.ratedCurrentA) / 1000, 2),
    lifecycle: "in_service",
    provenance,
  }));
  const distributionTransformers: DistributionTransformer[] = TRANSFORMERS.map((plan) => ({
    ...AUDIT,
    id: plan.id,
    code: plan.id,
    name: plan.name,
    feederId: plan.feederId,
    ratingKva: plan.ratingKva,
    primaryVoltageKv: 11,
    secondaryVoltageKv: 0.415,
    phases: 3,
    location: plan.location,
    lifecycle: "in_service",
    provenance,
  }));

  const transformerByKey = new Map(TRANSFORMERS.map((dt) => [dt.key, dt]));
  const servicePoints: ServicePoint[] = [];
  const customers: Customer[] = [];
  const meters: Meter[] = [
    {
      ...AUDIT,
      id: BOUNDARY_METERS.incomer,
      serialNumber: "SYN-RIV-IN",
      meterType: "smart",
      phases: 3,
      installation: { role: "substation_incomer", substationId: DEMO_SUBSTATION_ID },
      lifecycle: "in_service",
      provenance,
    },
    ...FEEDERS.map((plan): Meter => ({
      ...AUDIT,
      id: BOUNDARY_METERS.feederHead(plan.id),
      serialNumber: `SYN-${plan.id}-HEAD`,
      meterType: "smart",
      phases: 3,
      installation: { role: "feeder_head", feederId: plan.id },
      lifecycle: "in_service",
      provenance,
    })),
    ...TRANSFORMERS.map((plan): Meter => ({
      ...AUDIT,
      id: BOUNDARY_METERS.totalizer(plan.id),
      serialNumber: `SYN-${plan.id}-TOT`,
      meterType: "smart",
      phases: 3,
      installation: { role: "dt_totalizer", transformerId: plan.id },
      lifecycle: "in_service",
      provenance,
    })),
  ];

  const scatter = seeded("service-point-locations");
  for (const connection of CONNECTIONS) {
    const dt = transformerByKey.get(connection.supplyKey);
    const centre = dt?.location ?? MV_CUSTOMER.location;
    servicePoints.push({
      ...AUDIT,
      id: connection.servicePointId,
      supply: dt
        ? { kind: "distribution_transformer", transformerId: dt.id }
        : { kind: "feeder", feederId: connection.feederId },
      location: dt
        ? {
            latitude: round(centre.latitude + (scatter() - 0.5) * 0.005, 6),
            longitude: round(centre.longitude + (scatter() - 0.5) * 0.005, 6),
          }
        : centre,
      lifecycle: "in_service",
      provenance,
    });
    customers.push({
      ...AUDIT,
      id: connection.customerId,
      operatorOrganizationId: DEMO_ORGANIZATION_ID,
      accountNumber: `SYN-${connection.customerId}`,
      servicePointId: connection.servicePointId,
      category: connection.category,
      paymentMode: connection.metering === "prepaid" ? "prepaid" : "postpaid",
      demandClass: connection.category === "industrial" ? "md" : "non_md",
      accountStatus: connection.disconnected ? "disconnected" : "active",
      provenance,
    });
    if (connection.meterId !== undefined) {
      meters.push({
        ...AUDIT,
        id: connection.meterId,
        serialNumber: `SYN-${connection.meterId}`,
        meterType: "smart",
        phases: connection.category === "residential" ? 1 : 3,
        installation: { role: "service_point", servicePointId: connection.servicePointId },
        lifecycle: "in_service",
        provenance,
      });
    }
  }

  const edgeDevices: EdgeDevice[] = [
    {
      ...AUDIT,
      id: "ED-SS-RIV",
      serialNumber: "SYN-RTU-RIV",
      attachedTo: { kind: "substation", id: DEMO_SUBSTATION_ID },
      protocol: "synthetic",
      lifecycle: "in_service",
      provenance,
    },
    ...TRANSFORMERS.map((plan): EdgeDevice => ({
      ...AUDIT,
      id: `ED-${plan.id}`,
      serialNumber: `SYN-DTM-${plan.key}`,
      attachedTo: { kind: "distribution_transformer", id: plan.id },
      protocol: "synthetic",
      lifecycle: "in_service",
      provenance,
    })),
  ];

  return {
    organizations,
    regions,
    substations,
    powerTransformers,
    feeders,
    distributionTransformers,
    servicePoints,
    meters,
    customers,
    edgeDevices,
  };
}
