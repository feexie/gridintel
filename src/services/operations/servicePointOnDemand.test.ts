import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories, demoDatasetIsBuilt } from "../../repositories/demo/index.ts";
import { MINIGRID_SPATIAL_MODULE } from "../minigrid/spatial.ts";
import { mapView } from "../spatial/map.ts";
import { createSpatialRegistry } from "../spatial/module.ts";
import { REFERENCE_SPATIAL_MODULE } from "../spatial/reference.ts";
import { UTILITY_SPATIAL_MODULE } from "../utility/spatial.ts";
import { servicePointView } from "./levels.ts";

describe("service point on the demonstration adapter", () => {
  it("is computed from its own transformer's records, without building the whole dataset", async () => {
    const runtime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
    // A register-read meter, an unmetered connection's neighbour, an AMI meter, a prepaid meter and the 11 kV customer.
    for (const id of ["SP-FRM3-010", "SP-OLD2-001", "SP-GOV3-004", "SP-MKT2-005", "SP-MKT-MV-001"]) {
      const view = await servicePointView(runtime, id);
      assert.ok(view !== null && view.header.id === id, id);
      assert.equal(view.sourcing.synthetic, true, id);
      assert.ok(view.charges.length > 0, id);
    }
    assert.equal(demoDatasetIsBuilt(), false);
  });

  it("draws where the connection is, with what supplies it, still without building the whole dataset", async () => {
    const runtime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
    const context = { runtime, registry: createSpatialRegistry([UTILITY_SPATIAL_MODULE, MINIGRID_SPATIAL_MODULE, REFERENCE_SPATIAL_MODULE]), viewer: { viewerId: "public-demo", organizationId: null, access: { kind: "everything" as const } } };
    const map = await mapView(context, { layers: ["utility.substations", "utility.feeders", "utility.transformers", "utility.service_points"], focus: { kind: "service_point", id: "SP-OLD2-001" }, figures: false });
    assert.deepEqual(map.layers.map((layer) => layer.features.map((feature) => feature.entity.id)), [["SS-RIV"], ["FD-OLD"], ["DT-OLD-2"], ["SP-OLD2-001"]]);
    // No figure of any service is on it, and each asset still says where it sits.
    assert.ok(map.layers.flatMap((layer) => layer.features).every((feature) => feature.metric === null && feature.details.length === 0));
    assert.deepEqual(map.layers[2].features[0].trace?.upstream.map((above) => above.id), ["FD-OLD", "PT-RIV-1", "SS-RIV"]);
    assert.equal(map.layers[1].notes.length, 1, "the route is still said to be schematic");
    assert.equal(demoDatasetIsBuilt(), false);
  });
});
