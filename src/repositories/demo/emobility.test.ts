import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoRepositories } from "./index.ts";
import { DEMO_CLOCK } from "./clock.ts";
import { createSyntheticEmobility, NASA_POWER_CITATION, SYNTHETIC_EMOBILITY_SOURCE } from "./emobility.ts";

/* Companies active in Nigerian e-mobility, and words that would make a record read as a real one. None may appear. */
const REAL_NAMES = [/spiro/i, /\bswap\b(?! co-operative)/i, /\bmax\b/i, /metro africa/i, /qargo/i, /siltech/i, /ampersand/i, /empan/i, /techcabal/i];

describe("the synthetic e-mobility dataset", () => {
  const repo = createSyntheticEmobility();

  it("is synthetic in every record", async () => {
    assert.equal(SYNTHETIC_EMOBILITY_SOURCE.kind, "synthetic");
    const records = [...(await repo.hubs()), ...(await repo.operators()), ...(await repo.pledges()), ...(await repo.swapDays())];
    assert.ok(records.length > 0);
    for (const record of records) assert.equal(record.sourceId, SYNTHETIC_EMOBILITY_SOURCE.id);
    for (const named of [...(await repo.hubs()), ...(await repo.operators())]) assert.match(named.name, /\(synthetic\)$/);
    for (const pledge of await repo.pledges()) assert.match(pledge.funder, /\(synthetic\)$/);
  });

  it("names no real company", async () => {
    const names = [...(await repo.hubs()).map((one) => one.name), ...(await repo.operators()).map((one) => one.name), ...(await repo.pledges()).map((one) => one.funder)];
    for (const name of names) for (const real of REAL_NAMES) assert.doesNotMatch(name, real);
  });

  it("places every hub on a transformer of the synthetic network, and every pledge on its feeders", async () => {
    const { distributionTransformers, feeders } = (await createDemoRepositories().registry.getSnapshot({ asOf: DEMO_CLOCK })).snapshot;
    const dts = new Set(distributionTransformers.map((dt) => dt.id));
    const feederIds = new Set(feeders.map((feeder) => feeder.id));
    for (const hub of await repo.hubs()) assert.ok(dts.has(hub.transformerId), hub.transformerId);
    for (const pledge of await repo.pledges()) for (const feeder of pledge.feeders) assert.ok(feederIds.has(feeder), feeder);
  });

  it("gives each hub its cited solar resource", async () => {
    for (const hub of await repo.hubs()) {
      assert.equal(hub.solar.citationId, NASA_POWER_CITATION.id);
      assert.ok(hub.solar.rainySeasonPeakSunHours < hub.solar.annualPeakSunHours);
    }
  });

  it("records a month of swaps at the installed hub only", async () => {
    const days = await repo.swapDays();
    const installed = (await repo.hubs()).filter((hub) => hub.status === "installed").map((hub) => hub.id);
    assert.deepEqual([...new Set(days.map((day) => day.hubId))], installed);
    assert.equal(days.length, 30);
    assert.equal(days[0].day, "2026-09-01");
    assert.equal(days[29].day, "2026-09-30");
    for (const day of days) assert.ok(day.minutesAvailable > 0 && day.minutesAvailable <= 1_440);
  });
});
