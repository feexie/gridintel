import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Area, Territory } from "@/domain";
import type { DomainDataset } from "../memory/dataset.ts";
import { createInMemoryRepositories } from "../memory/inMemoryRepositories.ts";
import { demoDataset } from "./index.ts";

const PROVENANCE = { sourceSystem: "test", ingestedAt: "2026-01-01T00:00:00Z" };
const square = { type: "area" as const, polygons: [{ outer: [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }, { latitude: 1, longitude: 1 }] }] };
const AREAS: Area[] = [
  { id: "NG-AD", kind: "state", name: "A state", geometry: square, provenance: PROVENANCE },
  { id: "NG-AD-01", kind: "lga", name: "An LGA", parentAreaId: "NG-AD", geometry: square, provenance: PROVENANCE },
];
const TERRITORIES: Territory[] = [
  { organizationId: "org-1", parts: [{ kind: "areas", areaIds: ["NG-AD"] }], provenance: PROVENANCE },
  { organizationId: "org-2", parts: [{ kind: "assets", assets: [{ kind: "feeder", id: "FD-1" }] }], provenance: PROVENANCE },
];

/** The demonstration dataset with its areas replaced; only the spatial port is asked. */
function withAreas(overrides: Partial<DomainDataset>): DomainDataset {
  const base = demoDataset();
  return { ...base, intervalEnergy: [], telemetry: [], billingRecords: [], payments: [], areas: undefined, territories: undefined, completeness: { ...base.completeness, areas: undefined, territories: undefined }, ...overrides };
}

describe("in-memory repositories: areas and territories", () => {
  it("selects areas by kind and territories by organization, as stored", async () => {
    const repos = createInMemoryRepositories(withAreas({ areas: AREAS, territories: TERRITORIES, completeness: { ...demoDataset().completeness, areas: "complete", territories: "partial" } }));
    assert.deepEqual(await repos.spatial.listAreas({}), { records: AREAS, completeness: "complete" });
    assert.deepEqual((await repos.spatial.listAreas({ kinds: ["lga"] })).records, [AREAS[1]]);
    assert.deepEqual(await repos.spatial.listTerritories({ organizationIds: ["org-2"] }), { records: [TERRITORIES[1]], completeness: "partial" });
    assert.equal((await repos.spatial.listTerritories({})).records.length, 2);
  });

  it("says a dataset that holds no areas has none available, never an empty but complete list", async () => {
    const repos = createInMemoryRepositories(withAreas({}));
    assert.deepEqual(await repos.spatial.listAreas({}), { records: [], completeness: "not_available" });
    assert.deepEqual(await repos.spatial.listTerritories({}), { records: [], completeness: "not_available" });
  });

  it("holds three synthetic districts in the demonstration dataset, none of them an administrative area, and no territory", async () => {
    const repos = createInMemoryRepositories(demoDataset());
    const { records, completeness } = await repos.spatial.listAreas({});
    assert.equal(completeness, "complete");
    assert.deepEqual(records.map((area) => [area.id, area.kind]), [["demo-district-south", "other"], ["demo-district-north-west", "other"], ["demo-district-north-east", "other"]]);
    assert.ok(records.every((area) => area.name.includes("(synthetic)") && area.provenance.sourceSystem === "synthetic-registry"));
    assert.deepEqual((await repos.spatial.listAreas({ kinds: ["state", "lga", "ward"] })).records, []);
    assert.deepEqual(await repos.spatial.listTerritories({}), { records: [], completeness: "complete" });
  });
});
