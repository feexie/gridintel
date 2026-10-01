import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EntityRef, Outage, ScopeRef } from "@/domain";
import { PROVENANCE, buildRegistry } from "../__fixtures__/network.ts";
import { buildTopologyIndex } from "../topology/registry.ts";
import { outagesForScope } from "./scope.ts";

const index = buildTopologyIndex(buildRegistry());

const outage = (id: string, ...affected: EntityRef[]): Outage => ({
  id,
  origin: affected[0],
  planned: false,
  cause: "fault",
  responsibleParty: "distribution",
  exposures: affected.map((element) => ({
    affected: element,
    customersAffected: 1,
    customerCountBasis: "recorded",
    interruptedAt: "2026-01-01T10:00:00Z",
    restoredAt: "2026-01-01T11:00:00Z",
    quality: "measured",
  })),
  provenance: PROVENANCE,
});

const OUTAGES: Outage[] = [
  outage("O-DT1", { kind: "distribution_transformer", id: "DT-1" }),
  outage("O-DT2", { kind: "distribution_transformer", id: "DT-2" }),
  outage("O-SP1", { kind: "service_point", id: "SP-1" }),
  outage("O-SP4", { kind: "service_point", id: "SP-4" }),
  outage("O-FD1", { kind: "feeder", id: "FD-1" }),
  outage("O-FD2", { kind: "feeder", id: "FD-2" }),
  outage("O-SS1", { kind: "substation", id: "SS-1" }),
  outage("O-STAGED", { kind: "distribution_transformer", id: "DT-1" }, { kind: "distribution_transformer", id: "DT-2" }),
  outage("O-NAME", { kind: "feeder", label: "Feeder 4" }),
];

const select = (scope: ScopeRef) => outagesForScope(index, scope, OUTAGES);
const ids = (scope: ScopeRef) => select(scope).outages.map((o) => o.id);

describe("outages for a scope", () => {
  it("keeps exposures on the transformer and its service points", () => {
    assert.deepEqual(ids({ kind: "distribution_transformer", id: "DT-1" }), ["O-DT1", "O-SP1", "O-STAGED"]);
  });

  it("reduces a staged outage to the exposures inside the scope", () => {
    const staged = select({ kind: "distribution_transformer", id: "DT-1" }).outages.find((o) => o.id === "O-STAGED");
    assert.deepEqual(staged?.exposures.map((e) => e.affected), [{ kind: "distribution_transformer", id: "DT-1" }]);
  });

  it("reports exposures on an element above the scope instead of dropping or scaling them", () => {
    const result = select({ kind: "distribution_transformer", id: "DT-1" });
    const above = result.unattributable.filter((u) => u.reason === "ABOVE_SCOPE").map((u) => u.outageId);
    assert.deepEqual(above, ["O-FD1", "O-SS1"]);
    assert.ok(result.warnings.some((w) => w.code === "EXPOSURES_NOT_ATTRIBUTABLE"));
  });

  it("includes everything under a feeder, including a service point supplied directly", () => {
    assert.deepEqual(ids({ kind: "feeder", id: "FD-1" }), ["O-DT1", "O-DT2", "O-SP1", "O-SP4", "O-FD1", "O-STAGED"]);
  });

  it("includes everything under a substation, with nothing above it", () => {
    const result = select({ kind: "substation", id: "SS-1" });
    assert.equal(result.outages.length, 8);
    assert.deepEqual(result.unattributable.map((u) => u.reason), ["UNRESOLVED_REFERENCE"]);
  });

  it("resolves administrative scopes through the admin region", () => {
    assert.equal(select({ kind: "region", id: "R-1" }).outages.length, 8);
    assert.equal(select({ kind: "organization", id: "ORG-1" }).outages.length, 8);
    assert.equal(select({ kind: "region", id: "R-2" }).outages.length, 0);
  });

  it("never attributes an unresolved name", () => {
    for (const scope of [{ kind: "feeder", id: "FD-2" }, { kind: "region", id: "R-1" }] satisfies ScopeRef[]) {
      const result = select(scope);
      assert.ok(!result.outages.some((o) => o.id === "O-NAME"));
      assert.ok(result.unattributable.some((u) => u.outageId === "O-NAME" && u.reason === "UNRESOLVED_REFERENCE"));
    }
  });

  it("does not modify its input", () => {
    const before = JSON.stringify(OUTAGES);
    select({ kind: "distribution_transformer", id: "DT-1" });
    assert.equal(JSON.stringify(OUTAGES), before);
  });
});
