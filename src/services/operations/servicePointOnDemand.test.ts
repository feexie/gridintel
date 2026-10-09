import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories, demoDatasetIsBuilt } from "../../repositories/demo/index.ts";
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
});
