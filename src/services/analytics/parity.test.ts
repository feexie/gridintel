import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Outage, OutageExposure, Period, ScopeRef } from "@/domain";
import type { DomainDataset } from "../../repositories/memory/dataset.ts";
import type { GridIntelRepositories } from "../../repositories/ports/index.ts";
import {
  buildTopologyIndex,
  calculateReliability,
  computeEnergyAccount,
  customersServed,
  metersWithRole,
  sectionBoundary,
  servicePointsUnder,
} from "../../analytics/index.ts";
import { CONTEXT, PERIOD, PROVENANCE, buildIntervals, buildRegistry } from "../../analytics/__fixtures__/network.ts";
import { createInMemoryRepositories } from "../../repositories/memory/inMemoryRepositories.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   PARITY: the Phase 3 test network served through the repository
   ports gives exactly the results of calling analytics directly.
========================================================== */

const exposure = (customersAffected: number | null, interruptedAt?: string, restoredAt?: string): OutageExposure => ({
  affected: { kind: "distribution_transformer", id: "DT-1" },
  customersAffected,
  customerCountBasis: "recorded",
  interruptedAt,
  restoredAt,
  quality: "measured",
});

const outage = (id: string, exposures: OutageExposure[]): Outage => ({
  id,
  origin: { kind: "feeder", id: "FD-1" },
  planned: false,
  cause: "fault",
  responsibleParty: "distribution",
  exposures,
  provenance: PROVENANCE,
});

const DAY: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-02T00:00:00Z" };

// Every outage here overlaps DAY or has unknown times, so the repository returns them all.
const OUTAGES: Outage[] = [
  outage("O-1", [exposure(1, "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z"), exposure(1, "2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z")]),
  outage("O-2", [exposure(2, "2026-01-01T23:00:00Z", "2026-01-02T01:00:00Z")]),
  outage("O-3", [exposure(1, "2026-01-01T14:00:00Z", "2026-01-01T14:02:00Z")]),
  outage("O-4", [exposure(null, "2026-01-01T15:00:00Z", "2026-01-01T16:00:00Z")]),
  outage("O-5", [exposure(1)]),
];

function fixtureRepositories(): GridIntelRepositories {
  const registry = buildRegistry();
  const dataset: DomainDataset = {
    registry: { organizations: [], powerTransformers: [], edgeDevices: [], ...registry },
    registryCoverage: {
      organizations: "complete",
      regions: "complete",
      substations: "complete",
      powerTransformers: "complete",
      feeders: "complete",
      distributionTransformers: "complete",
      servicePoints: "complete",
      meters: "complete",
      customers: "complete",
      edgeDevices: "complete",
    },
    intervalEnergy: buildIntervals(),
    telemetry: [],
    heartbeats: [],
    outages: OUTAGES,
    reportedKpis: [],
    billingRecords: [],
    payments: [],
    dataSources: [{ id: "test-fixture", name: "Phase 3 test network", kind: "mock" }],
    completeness: {
      intervalEnergy: "complete",
      telemetry: "complete",
      heartbeats: "complete",
      outages: "complete",
      reportedKpis: "complete",
      billing: "not_available",
    },
  };
  return createInMemoryRepositories(dataset);
}

const SCOPES: ScopeRef[] = [
  { kind: "distribution_transformer", id: "DT-1" },
  { kind: "feeder", id: "FD-1" },
  { kind: "substation", id: "SS-1" },
];

describe("parity with direct analytics", () => {
  for (const scope of SCOPES) {
    it(`gives the same energy account for ${scope.kind} ${scope.id}`, async () => {
      const direct = computeEnergyAccount({
        index: buildTopologyIndex(buildRegistry()),
        scope,
        period: PERIOD,
        intervals: buildIntervals(),
        computedAt: CONTEXT.computedAt,
      });

      const repos = fixtureRepositories();
      const { index } = await loadTopology(repos.registry, PERIOD.end);
      // The account reads the boundary meters and the service-point meters under the scope.
      const boundary = sectionBoundary(index, scope);
      const servicePoints = servicePointsUnder(index, scope).value ?? [];
      const meterIds = [
        ...[...boundary.input, ...boundary.downstream].flatMap((requirement) => requirement.meterIds),
        ...servicePoints.flatMap((sp) => metersWithRole(index, "service_point", sp.id).map((meter) => meter.id)),
      ];
      const { records } = await repos.observations.listIntervalEnergy({ meterIds, period: PERIOD });
      const viaRepositories = computeEnergyAccount({
        index,
        scope,
        period: PERIOD,
        intervals: records,
        computedAt: CONTEXT.computedAt,
      });

      // No billing inputs are supplied, so the account as a whole is incomplete, but its
      // measured energy input is not: the comparison is between real figures.
      assert.equal(direct.energyInput.status, "ok");
      assert.deepEqual(viaRepositories, direct);
    });
  }

  it("gives the same reliability indices", async () => {
    const scope: ScopeRef = { kind: "feeder", id: "FD-1" };
    const directIndex = buildTopologyIndex(buildRegistry());
    const direct = calculateReliability({
      scope,
      period: DAY,
      outages: OUTAGES,
      customersServed: customersServed(directIndex, scope).input,
      context: CONTEXT,
    });

    const repos = fixtureRepositories();
    const { index } = await loadTopology(repos.registry, DAY.end);
    const { records } = await repos.events.listOutages({ period: DAY });
    const viaRepositories = calculateReliability({
      scope,
      period: DAY,
      outages: records,
      customersServed: customersServed(index, scope).input,
      context: CONTEXT,
    });

    assert.equal(records.length, OUTAGES.length);
    assert.equal(direct.saidi.status, "ok");
    assert.deepEqual(viaRepositories, direct);
  });
});
