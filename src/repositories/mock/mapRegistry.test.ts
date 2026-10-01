import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LegacyData } from "./legacy.ts";
import { LEGACY_DATA } from "./legacy.ts";
import { mapRegistry } from "./mapRegistry.ts";
import { MOCK_INGESTED_AT, MOCK_ORGANIZATION_ID } from "./sources.ts";

const { registry, issues } = mapRegistry(LEGACY_DATA);

function withLegacy(overrides: Partial<LegacyData>): LegacyData {
  return { ...structuredClone(LEGACY_DATA), ...overrides };
}

describe("registry mapping: administrative records", () => {
  it("assigns every region to the demonstration organization (D1)", () => {
    assert.deepEqual(registry.organizations.map((org) => [org.id, org.kind]), [[MOCK_ORGANIZATION_ID, "distribution_utility"]]);
    assert.deepEqual(registry.regions.map((region) => region.id), ["adamawa", "borno", "yobe", "taraba"]);
    assert.ok(registry.regions.every((region) => region.organizationId === MOCK_ORGANIZATION_ID));
    assert.ok(issues.some((issue) => issue.code === "ASSUMED_VALUE" && issue.source.field === "organizationId"));
  });

  it("keeps region identity only; counts and KPIs are not stored on the region", () => {
    const adamawa = registry.regions[0];
    assert.deepEqual(Object.keys(adamawa).sort(), ["createdAt", "id", "name", "organizationId", "provenance", "updatedAt"]);
  });
});

describe("registry mapping: electrical records", () => {
  it("maps ADM-SS-001 without guessing its kind from the name", () => {
    assert.deepEqual(registry.substations, [
      {
        id: "ADM-SS-001",
        name: "Jimeta 132/33kV Injection Substation",
        kind: "unspecified",
        primaryVoltageKv: 132,
        secondaryVoltageKv: 33,
        declaredCapacityMva: 90,
        adminRegionId: "adamawa",
        location: { latitude: 9.3265, longitude: 12.4448 },
        lifecycle: "in_service",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-07-10T09:00:00Z",
        provenance: { sourceSystem: "mock-operations", sourceRecordId: "ADM-SS-001", ingestedAt: MOCK_INGESTED_AT },
      },
    ]);
  });

  it("maps ADM-FD-001 with its origin substation and a 33 kV nominal voltage (D13)", () => {
    const [feeder] = registry.feeders;
    assert.deepEqual(feeder.origin, { kind: "substation", substationId: "ADM-SS-001" });
    assert.equal(feeder.code, "JF-01");
    assert.equal(feeder.nominalVoltageKv, 33);
    assert.equal(feeder.nominalVoltageKv, registry.substations[0].secondaryVoltageKv);
    assert.equal(feeder.adminRegionId, "adamawa");
    assert.equal(feeder.ratedCurrentA, undefined);
  });

  it("maps the three distribution transformers onto the feeder, with no phases invented", () => {
    assert.deepEqual(
      registry.distributionTransformers.map((dt) => [dt.id, dt.feederId, dt.ratingKva, dt.secondaryVoltageKv, dt.phases]),
      [
        ["ADM-TR-001", "ADM-FD-001", 500, 0.415, undefined],
        ["ADM-TR-002", "ADM-FD-001", 300, 0.415, undefined],
        ["ADM-TR-003", "ADM-FD-001", 500, 0.415, undefined],
      ],
    );
  });

  it("has no power transformers and no customer accounts", () => {
    assert.deepEqual(registry.powerTransformers, []);
    assert.deepEqual(registry.customers, []);
  });

  it("marks every asset in_service provisionally (D4)", () => {
    const assets = [
      ...registry.substations,
      ...registry.feeders,
      ...registry.distributionTransformers,
      ...registry.servicePoints,
      ...registry.meters,
      ...registry.edgeDevices,
    ];
    assert.ok(assets.every((asset) => asset.lifecycle === "in_service"));
    const lifecycleIssues = issues.filter((issue) => issue.source.field === "lifecycle");
    assert.equal(lifecycleIssues.length, 1 + 1 + 3 + 3 + 3);
    assert.ok(lifecycleIssues.every((issue) => issue.code === "ASSUMED_VALUE" && issue.severity === "warning"));
  });

  it("turns date-only audit times into midnight UTC with an issue (D5)", () => {
    assert.equal(registry.feeders[0].createdAt, "2026-01-01T00:00:00Z");
    const auditIssues = issues.filter((issue) => issue.source.field === "createdAt" && issue.source.recordId === "ADM-FD-001");
    assert.deepEqual(auditIssues.map((issue) => [issue.code, issue.severity]), [["ASSUMED_VALUE", "warning"]]);
  });
});

describe("registry mapping: meters and service points", () => {
  it("derives one service point per meter, supplied by the meter's transformer (D2)", () => {
    assert.deepEqual(
      registry.servicePoints.map((sp) => [sp.id, sp.supply]),
      [
        ["SP:ADM-MTR-001", { kind: "distribution_transformer", transformerId: "ADM-TR-001" }],
        ["SP:ADM-MTR-002", { kind: "distribution_transformer", transformerId: "ADM-TR-001" }],
        ["SP:ADM-MTR-003", { kind: "distribution_transformer", transformerId: "ADM-TR-002" }],
      ],
    );
    assert.ok(registry.servicePoints.every((sp) => sp.provenance.method?.startsWith("derived:")));
  });

  it("installs each meter at its service point as a smart meter (D12)", () => {
    const [meter] = registry.meters;
    assert.deepEqual(meter.installation, { role: "service_point", servicePointId: "SP:ADM-MTR-001" });
    assert.equal(meter.meterType, "smart");
    assert.equal(meter.serialNumber, "SN-10021");
  });

  it("drops customer names as PII", () => {
    assert.equal(JSON.stringify(registry).includes("Aisha Musa"), false);
    const pii = issues.filter((issue) => issue.code === "PII_DROPPED");
    assert.equal(pii.length, 3);
    assert.ok(pii.every((issue) => issue.severity === "info" && issue.source.field === "customerName"));
  });
});

describe("registry mapping: edge devices", () => {
  it("attaches devices to their assets and does not store online state", () => {
    const edge = registry.edgeDevices.find((device) => device.id === "EDGE-003");
    assert.deepEqual(edge?.attachedTo, { kind: "distribution_transformer", id: "ADM-TR-001" });
    assert.equal(edge?.firmwareVersion, "1.2.6");
    assert.equal(edge !== undefined && "online" in edge, false);
    assert.ok(issues.some((issue) =>
      issue.code === "DERIVED_STATE_NOT_STORED" && issue.source.recordId === "EDGE-003" && issue.source.field === "online"));
  });
});

describe("registry mapping: undated live values (D3)", () => {
  it("notes asset-level live values as unmapped instead of turning them into telemetry", () => {
    const unmapped = issues
      .filter((issue) => issue.code === "UNMAPPED_FIELD" && issue.source.recordId === "ADM-SS-001")
      .map((issue) => issue.source.field);
    assert.deepEqual(unmapped, ["currentLoadMw", "voltageKv", "currentAmp", "frequencyHz", "powerFactor"]);
  });
});

describe("registry mapping: broken input", () => {
  it("keeps a record with a dangling reference and reports it as an error", () => {
    const legacy = withLegacy({});
    const broken = { ...legacy, feeders: legacy.feeders.map((feeder) => ({ ...feeder, substationId: "NO-SUCH-SS" })) };
    const mapped = mapRegistry(broken);
    assert.equal(mapped.registry.feeders[0].origin.substationId, "NO-SUCH-SS");
    const dangling = mapped.issues.filter((issue) => issue.code === "DANGLING_REFERENCE");
    assert.deepEqual(dangling.map((issue) => [issue.severity, issue.source.recordId, issue.source.field]), [
      ["error", "ADM-FD-001", "substationId"],
    ]);
  });

  it("leaves out a meter that cannot be given a service point, with an error", () => {
    const legacy = withLegacy({});
    const broken = {
      ...legacy,
      meters: legacy.meters.map((meter, i) => (i === 0 ? { ...meter, parentAssetType: "substation" as const } : meter)),
    };
    const mapped = mapRegistry(broken);
    assert.deepEqual(mapped.registry.meters.map((meter) => meter.id), ["ADM-MTR-002", "ADM-MTR-003"]);
    assert.ok(mapped.issues.some((issue) => issue.severity === "error" && issue.source.recordId === "ADM-MTR-001"));
  });

  it("does not modify its input", () => {
    const legacy = withLegacy({});
    const before = JSON.stringify(legacy);
    mapRegistry(legacy);
    assert.equal(JSON.stringify(legacy), before);
  });
});
