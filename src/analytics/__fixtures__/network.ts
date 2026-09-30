import type {
  Customer,
  DistributionTransformer,
  Feeder,
  IntervalEnergy,
  Meter,
  MeterInstallation,
  Period,
  Provenance,
  Region,
  ServicePoint,
  ServicePointSupply,
  Substation,
} from "@/domain";
import type { Registry } from "../topology/registry.ts";

/* ==========================================================
   TEST FIXTURES — a small synthetic network, not the mock data.

   SS-1 (substation, region R-1)                 incomer  M-IN   520 kWh
   ├─ FD-1                                       head     M-FH1  400 kWh
   │  ├─ DT-1 (500 kVA, 3-phase)                 totalizer M-DT1 200 kWh
   │  │  ├─ SP-1 → C-1 (and closed account C-5)  M-SP1   90 kWh
   │  │  └─ SP-2 → C-2                           M-SP2   80 kWh
   │  ├─ DT-2 (300 kVA)                          totalizer M-DT2 120 kWh
   │  │  └─ SP-3 → C-3                           M-SP3  100 kWh
   │  └─ SP-4 (MV, direct on feeder) → C-4       M-SP4   60 kWh
   └─ FD-2 (no DTs)                              head     M-FH2  100 kWh

   All energy is over PERIOD (one hour, two 30-minute intervals),
   with no reverse flow unless a test adds it.
========================================================== */

export const PERIOD: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-01T01:00:00Z" };
export const CONTEXT = { computedAt: "2026-02-01T00:00:00Z" };

export const PROVENANCE: Provenance = {
  sourceSystem: "test-fixture",
  ingestedAt: "2026-01-02T00:00:00Z",
};

const AUDIT = { createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };

function substation(id: string, extra: Partial<Substation> = {}): Substation {
  return { ...AUDIT, id, name: id, kind: "injection", lifecycle: "in_service", provenance: PROVENANCE, ...extra };
}

function feeder(id: string, substationId: string, extra: Partial<Feeder> = {}): Feeder {
  return {
    ...AUDIT,
    id,
    name: id,
    origin: { kind: "substation", substationId },
    nominalVoltageKv: 11,
    lifecycle: "in_service",
    provenance: PROVENANCE,
    ...extra,
  };
}

function transformer(
  id: string,
  feederId: string,
  ratingKva: number,
  extra: Partial<DistributionTransformer> = {},
): DistributionTransformer {
  return { ...AUDIT, id, name: id, feederId, ratingKva, lifecycle: "in_service", provenance: PROVENANCE, ...extra };
}

function servicePoint(id: string, supply: ServicePointSupply): ServicePoint {
  return { ...AUDIT, id, supply, lifecycle: "in_service", provenance: PROVENANCE };
}

export function meter(id: string, installation: MeterInstallation, extra: Partial<Meter> = {}): Meter {
  return {
    ...AUDIT,
    id,
    serialNumber: `SN-${id}`,
    meterType: "smart",
    installation,
    lifecycle: "in_service",
    provenance: PROVENANCE,
    ...extra,
  };
}

function customer(id: string, servicePointId: string, accountStatus: Customer["accountStatus"] = "active"): Customer {
  return { ...AUDIT, id, operatorOrganizationId: "ORG-1", servicePointId, accountStatus, provenance: PROVENANCE };
}

export function buildRegistry(): Registry {
  const regions: Region[] = [{ ...AUDIT, id: "R-1", organizationId: "ORG-1", name: "Region 1", provenance: PROVENANCE }];
  return {
    regions,
    substations: [substation("SS-1", { adminRegionId: "R-1" })],
    feeders: [feeder("FD-1", "SS-1", { ratedCurrentA: 400 }), feeder("FD-2", "SS-1")],
    distributionTransformers: [
      transformer("DT-1", "FD-1", 500, { phases: 3, secondaryVoltageKv: 0.415 }),
      transformer("DT-2", "FD-1", 300),
    ],
    servicePoints: [
      servicePoint("SP-1", { kind: "distribution_transformer", transformerId: "DT-1" }),
      servicePoint("SP-2", { kind: "distribution_transformer", transformerId: "DT-1" }),
      servicePoint("SP-3", { kind: "distribution_transformer", transformerId: "DT-2" }),
      servicePoint("SP-4", { kind: "feeder", feederId: "FD-1" }),
    ],
    meters: [
      meter("M-IN", { role: "substation_incomer", substationId: "SS-1" }),
      meter("M-FH1", { role: "feeder_head", feederId: "FD-1" }),
      meter("M-FH2", { role: "feeder_head", feederId: "FD-2" }),
      meter("M-DT1", { role: "dt_totalizer", transformerId: "DT-1" }),
      meter("M-DT2", { role: "dt_totalizer", transformerId: "DT-2" }),
      meter("M-SP1", { role: "service_point", servicePointId: "SP-1" }),
      meter("M-SP2", { role: "service_point", servicePointId: "SP-2" }),
      meter("M-SP3", { role: "service_point", servicePointId: "SP-3" }),
      meter("M-SP4", { role: "service_point", servicePointId: "SP-4" }),
    ],
    customers: [
      customer("C-1", "SP-1"),
      customer("C-2", "SP-2"),
      customer("C-3", "SP-3"),
      customer("C-4", "SP-4"),
      customer("C-5", "SP-1", "closed"),
    ],
  };
}

/** Two 30-minute intervals over PERIOD for one meter: [import, export] per interval. */
export function halfHourly(meterId: string, values: [number | null, number | null][]): IntervalEnergy[] {
  return values.map(([importKwh, exportKwh], i) => ({
    meterId,
    intervalStart: new Date(Date.parse(PERIOD.start) + i * 30 * 60_000).toISOString(),
    intervalMinutes: 30,
    importKwh,
    exportKwh,
    quality: "measured",
    provenance: PROVENANCE,
  }));
}

export function buildIntervals(): IntervalEnergy[] {
  return [
    ...halfHourly("M-IN", [[260, 0], [260, 0]]),
    ...halfHourly("M-FH1", [[200, 0], [200, 0]]),
    ...halfHourly("M-FH2", [[50, 0], [50, 0]]),
    ...halfHourly("M-DT1", [[100, 0], [100, 0]]),
    ...halfHourly("M-DT2", [[60, 0], [60, 0]]),
    ...halfHourly("M-SP1", [[45, 0], [45, 0]]),
    ...halfHourly("M-SP2", [[40, 0], [40, 0]]),
    ...halfHourly("M-SP3", [[50, 0], [50, 0]]),
    ...halfHourly("M-SP4", [[30, 0], [30, 0]]),
  ];
}

/** Asserts two numbers are equal within floating-point tolerance. */
export function approx(actual: number | null, expected: number, epsilon = 1e-9): boolean {
  return actual !== null && Math.abs(actual - expected) <= epsilon;
}
