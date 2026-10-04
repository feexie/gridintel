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

   Two substations of different character:
   - Riverside: Market Road (Band A, commercial, well metered) and
     Old Town (Band C, mostly unmetered, poor collection);
   - Hillcrest: Government Avenue (Band B, well metered, with
     collection lost to government accounts) and Farm Road (Band D,
     rural, with a chronically unreliable upstream supply).

   Six transformers are designed by hand and keep fixed figures. The
   rest are generated from each feeder's profile, so that a feeder
   carries a realistic number of transformers and its loading means
   something.
========================================================== */

export const DEMO_REGION_ID = "demo-region-northfield";
/** The first substation; kept as the default for callers that want one. */
export const DEMO_SUBSTATION_ID = "SS-RIV";
export const DEMO_CURRENCY = "NGN";

export type CustomerCategory = "residential" | "commercial" | "industrial" | "government";
export type Metering = "prepaid" | "postpaid" | "unmetered";

/** How likely an account is to pay a bill in full, or not at all; the rest pay part. */
export interface PaymentBehaviour {
  full: number;
  none: number;
}

export interface SubstationPlan {
  id: string;
  code: string;
  name: string;
  location: Coordinates;
  powerTransformer: { id: string; name: string; ratingMva: number };
}

/** How the transformers a feeder's profile generates are sized and populated. */
interface FeederProfile {
  /** Ratings of the generated transformers, kVA, in order along the feeder. */
  ratingsKva: readonly number[];
  /** Evening peak loading the customer count is sized for, as [low, high] fractions of rating. */
  targetLoading: readonly [number, number];
  lvLoss: readonly [number, number];
  powerFactor: number;
  residentialPeakKw: number;
  commercialPeakKw: number;
  /** Commercial connections per residential connection. */
  commercialPerResidential: number;
  prepaid: number;
  postpaid: number;
  disconnectedShare: number;
  /** Direction the feeder runs from its substation, as degrees of latitude and longitude per transformer. */
  heading: readonly [number, number];
}

export interface FeederPlan {
  id: string;
  /** Short prefix of the feeder's transformer keys and ids, e.g. "MKT". */
  prefix: string;
  name: string;
  substationId: string;
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
  payment: Record<"postpaid" | "unmetered" | "government", PaymentBehaviour>;
  ratedCurrentA: number;
  /** Share of this feeder's accounts whose demand class the registry does not record. */
  unknownDemandClassShare: number;
  /** Government (MDA) accounts per kVA of each generated transformer's rating; 0 for none. */
  governmentPerKva: number;
  profile: FeederProfile;
}

interface CustomerGroup {
  category: "residential" | "commercial" | "government";
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
/** Mean peak demand of a government (MDA) account, kW. They are low-voltage maximum-demand accounts. */
const GOVERNMENT_PEAK_KW = 14;

export const SUBSTATIONS: readonly SubstationPlan[] = [
  {
    id: "SS-RIV",
    code: "RIV",
    name: "Riverside 33/11 kV injection substation",
    location: { latitude: 9.23, longitude: 12.46 },
    powerTransformer: { id: "PT-RIV-1", name: "Riverside T1", ratingMva: 5 },
  },
  {
    id: "SS-HIL",
    code: "HIL",
    name: "Hillcrest 33/11 kV injection substation",
    location: { latitude: 9.275, longitude: 12.505 },
    powerTransformer: { id: "PT-HIL-1", name: "Hillcrest T1", ratingMva: 5 },
  },
];

export const FEEDERS: readonly FeederPlan[] = [
  {
    id: "FD-MKT",
    prefix: "MKT",
    name: "Market Road 11 kV feeder",
    substationId: "SS-RIV",
    band: "A",
    mvLoss: 0.02,
    tariffNgnPerKwh: 209.5,
    tariffCode: "Band A",
    bypassShare: 0.05,
    estimatedKwh: { residential: 220, commercial: 600 },
    payment: { postpaid: { full: 0.7, none: 0.08 }, unmetered: { full: 0.4, none: 0.25 }, government: { full: 0.3, none: 0.4 } },
    ratedCurrentA: 120,
    unknownDemandClassShare: 0,
    governmentPerKva: 0,
    profile: {
      ratingsKva: [200, 300, 100, 200, 500, 100, 200, 300, 200],
      targetLoading: [0.5, 0.82],
      lvLoss: [0.045, 0.06],
      powerFactor: 0.9,
      residentialPeakKw: 0.9,
      commercialPeakKw: 3.0,
      commercialPerResidential: 0.12,
      prepaid: 0.65,
      postpaid: 0.22,
      disconnectedShare: 0,
      heading: [0.0032, 0.0072],
    },
  },
  {
    id: "FD-OLD",
    prefix: "OLD",
    name: "Old Town 11 kV feeder",
    substationId: "SS-RIV",
    band: "C",
    mvLoss: 0.035,
    tariffNgnPerKwh: 50,
    tariffCode: "Band C",
    bypassShare: 0.08,
    estimatedKwh: { residential: 90, commercial: 250 },
    payment: { postpaid: { full: 0.4, none: 0.3 }, unmetered: { full: 0.15, none: 0.5 }, government: { full: 0.2, none: 0.5 } },
    ratedCurrentA: 120,
    unknownDemandClassShare: 0,
    governmentPerKva: 0,
    profile: {
      ratingsKva: [200, 100, 300, 200, 100, 200, 300, 100, 200, 200, 100],
      targetLoading: [0.5, 0.88],
      lvLoss: [0.075, 0.1],
      powerFactor: 0.86,
      residentialPeakKw: 0.55,
      commercialPeakKw: 2.2,
      commercialPerResidential: 0.04,
      prepaid: 0.28,
      postpaid: 0.16,
      disconnectedShare: 0.03,
      heading: [-0.0046, -0.0066],
    },
  },
  {
    // Well metered and well run, but government accounts pay late or not at all.
    id: "FD-GOV",
    prefix: "GOV",
    name: "Government Avenue 11 kV feeder",
    substationId: "SS-HIL",
    band: "B",
    mvLoss: 0.022,
    tariffNgnPerKwh: 63,
    tariffCode: "Band B",
    bypassShare: 0.02,
    estimatedKwh: { residential: 180, commercial: 450 },
    payment: { postpaid: { full: 0.8, none: 0.05 }, unmetered: { full: 0.5, none: 0.2 }, government: { full: 0.08, none: 0.72 } },
    ratedCurrentA: 200,
    unknownDemandClassShare: 0,
    governmentPerKva: 0.03,
    profile: {
      ratingsKva: [300, 200, 300, 200, 500, 200, 300, 200, 300, 200, 100, 200],
      targetLoading: [0.5, 0.8],
      lvLoss: [0.045, 0.06],
      powerFactor: 0.9,
      residentialPeakKw: 1.0,
      commercialPeakKw: 2.8,
      commercialPerResidential: 0.08,
      prepaid: 0.55,
      postpaid: 0.41,
      disconnectedShare: 0,
      heading: [0.0038, -0.0068],
    },
  },
  {
    // Rural, mostly unmetered, and fed by an upstream supply that fails often.
    id: "FD-FRM",
    prefix: "FRM",
    name: "Farm Road 11 kV feeder",
    substationId: "SS-HIL",
    band: "D",
    mvLoss: 0.05,
    tariffNgnPerKwh: 43,
    tariffCode: "Band D",
    bypassShare: 0.1,
    estimatedKwh: { residential: 55, commercial: 160 },
    payment: { postpaid: { full: 0.35, none: 0.35 }, unmetered: { full: 0.12, none: 0.55 }, government: { full: 0.2, none: 0.5 } },
    ratedCurrentA: 60,
    unknownDemandClassShare: 0.02,
    governmentPerKva: 0,
    profile: {
      ratingsKva: [100, 50, 100, 200, 50, 100, 100, 50, 100, 100],
      targetLoading: [0.4, 0.75],
      lvLoss: [0.09, 0.13],
      powerFactor: 0.85,
      residentialPeakKw: 0.35,
      commercialPeakKw: 1.2,
      commercialPerResidential: 0.03,
      prepaid: 0.14,
      postpaid: 0.12,
      disconnectedShare: 0.04,
      heading: [0.0075, 0.0058],
    },
  },
];

/** The six transformers designed by hand. Their figures do not change when the network is widened. */
const DESIGNED: readonly TransformerPlan[] = [
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
    // Fully metered: a transformer whose downstream boundary is complete.
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
    // Too many connections for its rating: an overloaded transformer by design.
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

/** The transformers a feeder's profile adds after its hand-designed ones. */
function generate(feeder: FeederPlan): TransformerPlan[] {
  const substation = SUBSTATIONS.find((plan) => plan.id === feeder.substationId) as SubstationPlan;
  const designed = DESIGNED.filter((dt) => dt.feederId === feeder.id).length;
  const random = seeded(`transformers:${feeder.id}`);
  const profile = feeder.profile;
  return profile.ratingsKva.map((ratingKva, i) => {
    const n = designed + i + 1;
    const loading = profile.targetLoading[0] + random() * (profile.targetLoading[1] - profile.targetLoading[0]);
    const lvLoss = round(profile.lvLoss[0] + random() * (profile.lvLoss[1] - profile.lvLoss[0]), 3);
    const government = Math.round(ratingKva * feeder.governmentPerKva);
    // Sized for the evening peak, when residential demand is at its highest and commercial is low.
    const deliverableKw = ratingKva * loading * profile.powerFactor * (1 - lvLoss);
    const unmeteredShare = 1 - profile.prepaid - profile.postpaid;
    const perResidentialKw = profile.residentialPeakKw * (1 + unmeteredShare * (UNMETERED_USE_FACTOR - 1));
    const eveningCommercialKw = profile.commercialPeakKw * 0.25 * profile.commercialPerResidential;
    const residential = Math.max(8, Math.round(deliverableKw / (perResidentialKw + eveningCommercialKw)));
    const groups: CustomerGroup[] = [
      { category: "residential", count: residential, meanPeakKw: profile.residentialPeakKw, prepaid: profile.prepaid, postpaid: profile.postpaid },
      {
        category: "commercial",
        count: Math.round(residential * profile.commercialPerResidential),
        meanPeakKw: profile.commercialPeakKw,
        prepaid: profile.prepaid,
        postpaid: Math.min(1 - profile.prepaid, profile.postpaid + 0.1),
      },
      // Government accounts are always metered and billed on a meter reading.
      { category: "government", count: government, meanPeakKw: GOVERNMENT_PEAK_KW, prepaid: 0, postpaid: 1 },
    ];
    return {
      key: `${feeder.prefix}${n}`,
      id: `DT-${feeder.prefix}-${n}`,
      name: `${feeder.name.replace(" 11 kV feeder", "")} transformer ${n}`,
      feederId: feeder.id,
      ratingKva,
      location: {
        latitude: round(substation.location.latitude + profile.heading[0] * (n + 0.5) + (random() - 0.5) * 0.002, 6),
        longitude: round(substation.location.longitude + profile.heading[1] * (n + 0.5) + (random() - 0.5) * 0.002, 6),
      },
      lvLoss,
      powerFactor: profile.powerFactor,
      disconnectedShare: profile.disconnectedShare,
      groups: groups.filter((group) => group.count > 0),
    };
  });
}

/** Every transformer, feeder by feeder: the designed ones first, then the generated ones. */
export const TRANSFORMERS: readonly TransformerPlan[] = FEEDERS.flatMap((feeder) => [
  ...DESIGNED.filter((dt) => dt.feederId === feeder.id),
  ...generate(feeder),
]);

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
  /** What the registry records; undefined when it records nothing. */
  demandClass: "md" | "non_md" | undefined;
}

export const BOUNDARY_METERS = {
  incomer: (substationId: string) => `M-${substationId}-IN`,
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
    // A stream of its own, so that recording fewer demand classes changes nothing else.
    const classRandom = seeded(`demand-class:${dt.key}`);
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
        const classKnown = classRandom() >= feeder.unknownDemandClassShare;
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
          demandClass: !classKnown ? undefined : group.category === "government" ? "md" : "non_md",
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
    demandClass: "md",
  });
  return connections;
}

/** Every connection in the design, in a stable order. */
export const CONNECTIONS: readonly ConnectionPlan[] = planConnections();

const ACTIVE = new Map<string, number>();
for (const connection of CONNECTIONS) {
  if (!connection.disconnected) ACTIVE.set(connection.supplyKey, (ACTIVE.get(connection.supplyKey) ?? 0) + 1);
}

/** Active accounts on a transformer (or on the MV connection). */
export function activeAccounts(supplyKey: string): number {
  return ACTIVE.get(supplyKey) ?? 0;
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
  const substations: Substation[] = SUBSTATIONS.map((plan) => ({
    ...AUDIT,
    id: plan.id,
    code: plan.code,
    name: plan.name,
    kind: "injection",
    primaryVoltageKv: 33,
    secondaryVoltageKv: 11,
    adminRegionId: DEMO_REGION_ID,
    location: plan.location,
    lifecycle: "in_service",
    provenance,
  }));
  const powerTransformers: PowerTransformer[] = SUBSTATIONS.map((plan) => ({
    ...AUDIT,
    id: plan.powerTransformer.id,
    substationId: plan.id,
    name: plan.powerTransformer.name,
    ratingMva: plan.powerTransformer.ratingMva,
    primaryVoltageKv: 33,
    secondaryVoltageKv: 11,
    lifecycle: "in_service",
    provenance,
  }));
  const feeders: Feeder[] = FEEDERS.map((plan) => {
    const substation = SUBSTATIONS.find((s) => s.id === plan.substationId) as SubstationPlan;
    return {
      ...AUDIT,
      id: plan.id,
      code: plan.id,
      name: plan.name,
      origin: { kind: "substation", substationId: plan.substationId, powerTransformerId: substation.powerTransformer.id },
      serviceBand: plan.band,
      route: [substation.location, ...TRANSFORMERS.filter((dt) => dt.feederId === plan.id).map((dt) => dt.location)],
      nominalVoltageKv: 11,
      ratedCurrentA: plan.ratedCurrentA,
      ratedCapacityMva: round((Math.sqrt(3) * 11 * plan.ratedCurrentA) / 1000, 2),
      lifecycle: "in_service",
      provenance,
    };
  });
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
    ...SUBSTATIONS.map((plan): Meter => ({
      ...AUDIT,
      id: BOUNDARY_METERS.incomer(plan.id),
      serialNumber: `SYN-${plan.code}-IN`,
      meterType: "smart",
      phases: 3,
      installation: { role: "substation_incomer", substationId: plan.id },
      lifecycle: "in_service",
      provenance,
    })),
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
      ...(connection.demandClass === undefined ? {} : { demandClass: connection.demandClass }),
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
    ...SUBSTATIONS.map((plan): EdgeDevice => ({
      ...AUDIT,
      id: `ED-${plan.id}`,
      serialNumber: `SYN-RTU-${plan.code}`,
      attachedTo: { kind: "substation", id: plan.id },
      protocol: "synthetic",
      lifecycle: "in_service",
      provenance,
    })),
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
