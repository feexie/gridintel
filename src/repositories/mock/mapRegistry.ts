import type {
  AssetKind,
  DistributionTransformer,
  EdgeDevice,
  Feeder,
  Meter,
  Organization,
  Region,
  ServicePoint,
  ServicePointSupply,
  Substation,
} from "@/domain";
import type { NetworkRegistrySnapshot } from "../ports/index.ts";
import type { LegacyData, LegacyEdgeDevice, LegacyMeter } from "./legacy.ts";
import type { MappingIssue, MappingIssueCode } from "./issues.ts";
import { LEGACY_DATASETS } from "./legacy.ts";
import { mappingIssue } from "./issues.ts";
import { servicePointIdForMeter } from "./ids.ts";
import {
  MOCK_INGESTED_AT,
  MOCK_ORGANIZATION_ID,
  OPERATIONS_SOURCE,
  auditTimestamp,
  mockProvenance,
} from "./sources.ts";

/* ==========================================================
   MOCK ADAPTER — REGISTRY MAPPING

   Legacy regions, assets, meters and edge devices → domain
   registry records. Legacy counts and KPIs become ReportedKpi
   (mapReported.ts); timestamped readings become observations
   (mapObservations.ts). Nothing is corrected.

   Applied Phase 4 decisions, each recorded as ASSUMED_VALUE:
   D1 demonstration organization, D4 lifecycle "in_service",
   D5 date-only audit times, D12 meter type "smart",
   D13 feeder nominal voltage from the legacy voltageKv.
   D2 (one service point per meter) is recorded in provenance.
========================================================== */

export interface RegistryMapping {
  registry: NetworkRegistrySnapshot;
  issues: MappingIssue[];
}

const PROVISIONAL_LIFECYCLE =
  'Lifecycle "in_service" is provisional: the legacy status is operating state, not lifecycle.';

/** Legacy live values with no observation time (D3). */
const UNDATED_LIVE_VALUE = "Live value with no observation time; not mapped to telemetry.";

function noteFields(
  issues: MappingIssue[],
  code: MappingIssueCode,
  dataset: string,
  recordId: string,
  fields: readonly string[],
  message: string,
): void {
  for (const field of fields) issues.push(mappingIssue(code, message, { dataset, recordId, field }));
}

function audit(
  record: { createdAt: string; updatedAt: string },
  dataset: string,
  recordId: string,
  issues: MappingIssue[],
): { createdAt: string; updatedAt: string } {
  return {
    createdAt: auditTimestamp(record.createdAt, { dataset, recordId, field: "createdAt" }, issues),
    updatedAt: auditTimestamp(record.updatedAt, { dataset, recordId, field: "updatedAt" }, issues),
  };
}

function checkReference(
  ids: ReadonlySet<string>,
  id: string,
  target: string,
  source: MappingIssue["source"],
  issues: MappingIssue[],
): void {
  if (!ids.has(id)) {
    issues.push(mappingIssue("DANGLING_REFERENCE", `No ${target} "${id}" exists; the id is kept as written.`, source));
  }
}

/** "132/33kV" → primary 132, secondary 33. Parses the voltageLevel field only, never the name. */
function parseVoltageLevel(value: string): { primaryVoltageKv: number; secondaryVoltageKv: number } | null {
  const match = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*kV\s*$/i.exec(value);
  return match ? { primaryVoltageKv: Number(match[1]), secondaryVoltageKv: Number(match[2]) } : null;
}

function meterSupply(meter: LegacyMeter): ServicePointSupply | null {
  switch (meter.parentAssetType) {
    case "transformer":
      return { kind: "distribution_transformer", transformerId: meter.parentAssetId };
    case "feeder":
      return { kind: "feeder", feederId: meter.parentAssetId };
    default:
      return null;
  }
}

const EDGE_ASSET_KIND: Record<LegacyEdgeDevice["assetType"], AssetKind> = {
  substation: "substation",
  feeder: "feeder",
  transformer: "distribution_transformer",
  meter: "meter",
};

export function mapRegistry(legacy: LegacyData): RegistryMapping {
  const issues: MappingIssue[] = [];
  const lifecycleIssue = (dataset: string, recordId: string) =>
    issues.push(mappingIssue("ASSUMED_VALUE", PROVISIONAL_LIFECYCLE, { dataset, recordId, field: "lifecycle" }));

  const regionIds = new Set(legacy.regions.map((region) => region.id));
  const substationIds = new Set(legacy.substations.map((substation) => substation.id));
  const feederIds = new Set(legacy.feeders.map((feeder) => feeder.id));
  const transformerIds = new Set(legacy.transformers.map((transformer) => transformer.id));
  const meterIds = new Set(legacy.meters.map((meter) => meter.id));

  /* ---------- organization (D1) ---------- */

  const organizations: Organization[] = [
    {
      id: MOCK_ORGANIZATION_ID,
      name: "Demonstration utility (mock)",
      kind: "distribution_utility",
      createdAt: MOCK_INGESTED_AT,
      updatedAt: MOCK_INGESTED_AT,
      provenance: mockProvenance(OPERATIONS_SOURCE, undefined, "placeholder organization for the mock regions"),
    },
  ];
  issues.push(
    mappingIssue(
      "ASSUMED_VALUE",
      "The legacy data names no organization; the mock regions are assigned to a demonstration organization.",
      { dataset: LEGACY_DATASETS.regions, field: "organizationId" },
    ),
  );

  /* ---------- regions ---------- */

  const regions: Region[] = legacy.regions.map((region) => {
    const dataset = LEGACY_DATASETS.regions;
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, region.id, ["status", "lastSeen"],
      "Operating state is derived from observations, not stored.");
    return {
      id: region.id,
      organizationId: MOCK_ORGANIZATION_ID,
      name: region.name,
      ...audit(region, dataset, region.id, issues),
      provenance: mockProvenance(OPERATIONS_SOURCE, region.id),
    };
  });

  /* ---------- substations ---------- */

  const substations: Substation[] = legacy.substations.map((substation) => {
    const dataset = LEGACY_DATASETS.substations;
    const id = substation.id;
    checkReference(regionIds, substation.regionId, "region", { dataset, recordId: id, field: "regionId" }, issues);
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, id,
      ["status", "communicationStatus", "edgeDeviceOnline", "lastSeen"],
      "Operating state is derived from observations, not stored.");
    noteFields(issues, "UNMAPPED_FIELD", dataset, id,
      ["currentLoadMw", "voltageKv", "currentAmp", "frequencyHz", "powerFactor"], UNDATED_LIVE_VALUE);
    lifecycleIssue(dataset, id);

    const voltages = parseVoltageLevel(substation.voltageLevel);
    if (voltages === null) {
      issues.push(mappingIssue("UNMAPPED_FIELD", `voltageLevel "${substation.voltageLevel}" could not be read.`,
        { dataset, recordId: id, field: "voltageLevel" }));
    }
    return {
      id,
      name: substation.name,
      // Never guessed from the name; the name ("Injection") and the voltages (132/33 kV) disagree.
      kind: "unspecified",
      ...(voltages ?? {}),
      declaredCapacityMva: substation.installedCapacityMva,
      adminRegionId: substation.regionId,
      location: { latitude: substation.location.latitude, longitude: substation.location.longitude },
      lifecycle: "in_service",
      ...audit(substation, dataset, id, issues),
      provenance: mockProvenance(OPERATIONS_SOURCE, id),
    };
  });

  /* ---------- feeders ---------- */

  const feeders: Feeder[] = legacy.feeders.map((feeder) => {
    const dataset = LEGACY_DATASETS.feeders;
    const id = feeder.id;
    checkReference(substationIds, feeder.substationId, "substation", { dataset, recordId: id, field: "substationId" }, issues);
    checkReference(regionIds, feeder.regionId, "region", { dataset, recordId: id, field: "regionId" }, issues);
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, id, ["status", "communicationStatus", "lastSeen"],
      "Operating state is derived from observations, not stored.");
    noteFields(issues, "UNMAPPED_FIELD", dataset, id, ["currentLoadMw", "currentAmp", "powerFactor"], UNDATED_LIVE_VALUE);
    issues.push(mappingIssue("ASSUMED_VALUE", "The legacy voltageKv is taken as the feeder's nominal voltage.",
      { dataset, recordId: id, field: "voltageKv" }));
    lifecycleIssue(dataset, id);
    return {
      id,
      code: feeder.feederCode,
      name: feeder.name,
      origin: { kind: "substation", substationId: feeder.substationId },
      adminRegionId: feeder.regionId,
      nominalVoltageKv: feeder.voltageKv,
      lifecycle: "in_service",
      ...audit(feeder, dataset, id, issues),
      provenance: mockProvenance(OPERATIONS_SOURCE, id),
    };
  });

  /* ---------- distribution transformers ---------- */

  const distributionTransformers: DistributionTransformer[] = legacy.transformers.map((transformer) => {
    const dataset = LEGACY_DATASETS.transformers;
    const id = transformer.id;
    checkReference(feederIds, transformer.feederId, "feeder", { dataset, recordId: id, field: "feederId" }, issues);
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, id,
      ["status", "communicationStatus", "edgeDeviceOnline", "lastSeen"],
      "Operating state is derived from observations, not stored.");
    noteFields(issues, "UNMAPPED_FIELD", dataset, id, ["currentAmp", "temperature"], UNDATED_LIVE_VALUE);
    noteFields(issues, "UNMAPPED_FIELD", dataset, id, ["lastMaintenance"],
      "A date with no time zone and no record of what was done; not mapped to a maintenance record.");
    issues.push(mappingIssue("ASSUMED_VALUE", "The legacy voltageKv is taken as the transformer's nominal secondary voltage.",
      { dataset, recordId: id, field: "voltageKv" }));
    lifecycleIssue(dataset, id);
    return {
      id,
      name: transformer.name,
      feederId: transformer.feederId,
      ratingKva: transformer.ratingKva,
      secondaryVoltageKv: transformer.voltageKv,
      lifecycle: "in_service",
      ...audit(transformer, dataset, id, issues),
      provenance: mockProvenance(OPERATIONS_SOURCE, id),
    };
  });

  /* ---------- meters and derived service points (D2, D12) ---------- */

  const servicePoints: ServicePoint[] = [];
  const meters: Meter[] = [];
  for (const meter of legacy.meters) {
    const dataset = LEGACY_DATASETS.meters;
    const id = meter.id;
    const supply = meterSupply(meter);
    if (supply === null) {
      issues.push(mappingIssue("UNMAPPED_FIELD",
        `A meter under a "${meter.parentAssetType}" cannot be given a service point; the meter is left out.`,
        { dataset, recordId: id, field: "parentAssetType" }, "error"));
      continue;
    }
    checkReference(supply.kind === "feeder" ? feederIds : transformerIds, meter.parentAssetId,
      supply.kind === "feeder" ? "feeder" : "distribution transformer",
      { dataset, recordId: id, field: "parentAssetId" }, issues);
    issues.push(mappingIssue("PII_DROPPED", "The customer name is personal data and is not carried into the domain.",
      { dataset, recordId: id, field: "customerName" }));
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, id, ["status", "lastSeen"],
      "Operating state is derived from observations, not stored.");
    noteFields(issues, "UNMAPPED_FIELD", dataset, id, ["energyKwh"],
      "Not known whether this is a cumulative register or energy for a period; not mapped.");
    noteFields(issues, "UNMAPPED_FIELD", dataset, id, ["tamperDetected"],
      "A flag with no time or severity; not mapped to an alarm.");
    issues.push(mappingIssue("ASSUMED_VALUE", 'Meter type "smart", from the legacy SMART METER record type.',
      { dataset, recordId: id, field: "meterType" }));
    lifecycleIssue(dataset, id);

    const recordAudit = audit(meter, dataset, id, issues);
    const servicePointId = servicePointIdForMeter(id);
    servicePoints.push({
      id: servicePointId,
      supply,
      lifecycle: "in_service",
      ...recordAudit,
      provenance: mockProvenance(OPERATIONS_SOURCE, id,
        "derived: one service point per legacy meter, supplied by the meter's parent asset"),
    });
    meters.push({
      id,
      serialNumber: meter.serialNumber,
      meterType: "smart",
      installation: { role: "service_point", servicePointId },
      lifecycle: "in_service",
      ...recordAudit,
      provenance: mockProvenance(OPERATIONS_SOURCE, id),
    });
  }

  /* ---------- edge devices ---------- */

  const assetIds: Record<AssetKind, ReadonlySet<string>> = {
    substation: substationIds,
    power_transformer: new Set(),
    feeder: feederIds,
    distribution_transformer: transformerIds,
    service_point: new Set(servicePoints.map((sp) => sp.id)),
    meter: meterIds,
    edge_device: new Set(legacy.edgeDevices.map((device) => device.id)),
  };
  const edgeDevices: EdgeDevice[] = legacy.edgeDevices.map((device) => {
    const dataset = LEGACY_DATASETS.edgeDevices;
    const id = device.id;
    const kind = EDGE_ASSET_KIND[device.assetType];
    checkReference(assetIds[kind], device.assetId, kind.replace(/_/g, " "), { dataset, recordId: id, field: "assetId" }, issues);
    noteFields(issues, "DERIVED_STATE_NOT_STORED", dataset, id, ["online"],
      "Operating state is derived from heartbeats, not stored.");
    issues.push(mappingIssue("ASSUMED_VALUE", "The legacy record has no audit times; the mock ingest time is used.",
      { dataset, recordId: id, field: "createdAt" }));
    lifecycleIssue(dataset, id);
    return {
      id,
      ...(device.serialNumber === undefined ? {} : { serialNumber: device.serialNumber }),
      ...(device.manufacturer === undefined ? {} : { manufacturer: device.manufacturer }),
      firmwareVersion: device.firmwareVersion,
      attachedTo: { kind, id: device.assetId },
      lifecycle: "in_service",
      createdAt: MOCK_INGESTED_AT,
      updatedAt: MOCK_INGESTED_AT,
      provenance: mockProvenance(OPERATIONS_SOURCE, id),
    };
  });

  return {
    registry: {
      organizations,
      regions,
      substations,
      powerTransformers: [],
      feeders,
      distributionTransformers,
      servicePoints,
      meters,
      customers: [],
      edgeDevices,
    },
    issues,
  };
}
