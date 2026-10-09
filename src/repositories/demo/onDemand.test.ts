import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInMemoryRepositories } from "../memory/inMemoryRepositories.ts";
import { createDemoRepositories, demoDataset, demoDatasetIsBuilt } from "./index.ts";
import { DEMO_CLOCK, DEMO_PERIOD } from "./clock.ts";
import { SUPPLY_KEYS, connectionsOf } from "./energy.ts";

/* The order matters in this file: the first tests run before anything has built the whole
   dataset, and check that it stays unbuilt. The last builds it and compares. */

const onDemand = createDemoRepositories();
const period = DEMO_PERIOD;
// Register readings are looked for from the previous reading round to a few days after the period.
const readings = { from: "2026-07-27T00:00:00+01:00", asOf: "2026-10-04T00:00:00+01:00" };

/** What a screen about these connections asks the adapter for. */
async function recordsOf(repos: ReturnType<typeof createDemoRepositories>, meterIds: string[], customerIds: string[]) {
  return {
    intervals: await repos.observations.listIntervalEnergy({ meterIds, period }),
    registers: await repos.observations.listTelemetry({ sources: meterIds.map((id) => ({ kind: "meter" as const, id })), ...readings }),
    charges: await repos.billing.listBillingRecords({ period, customerIds }),
    payments: await repos.billing.listPayments({ period, customerIds }),
  };
}

const standing: { outages: unknown[] } = { outages: [] };
const asked = new Map<string, Awaited<ReturnType<typeof recordsOf>>>();

describe("demo adapter: one supply's records on demand", () => {
  it("answers for every supply's customer meters and accounts, still without the whole dataset", async () => {
    for (const key of SUPPLY_KEYS) {
      const connections = connectionsOf(key);
      asked.set(key, await recordsOf(onDemand, connections.flatMap((c) => c.meterId ?? []), connections.map((c) => c.customerId)));
    }
    // Two supplies in one question, given out of the dataset's order.
    const two = [...connectionsOf("OLD2"), ...connectionsOf("MKT1")];
    asked.set("two", await recordsOf(onDemand, two.flatMap((c) => c.meterId ?? []), two.map((c) => c.customerId)));
    assert.equal(demoDatasetIsBuilt(), false);
  });

  it("gives the registry, the outage log, the alarm list and the sources without the whole dataset", async () => {
    const { snapshot } = await onDemand.registry.getSnapshot({ asOf: DEMO_CLOCK });
    assert.equal(snapshot.servicePoints.length, 6448);
    standing.outages = (await onDemand.events.listOutages({ period })).records;
    assert.ok(standing.outages.length > 0);
    assert.equal((await onDemand.events.listAlarms({ period })).records.length, 32);
    assert.ok((await onDemand.sources.listDataSources()).every((source) => source.kind === "synthetic"));
    assert.equal(demoDatasetIsBuilt(), false);
  });

  it("returns exactly the records the whole dataset holds, in the same order", async () => {
    const dataset = demoDataset();
    const whole = createInMemoryRepositories(dataset);
    for (const [key, answer] of asked) {
      const connections = key === "two" ? [...connectionsOf("OLD2"), ...connectionsOf("MKT1")] : connectionsOf(key);
      const expected = await recordsOf(whole, connections.flatMap((c) => c.meterId ?? []), connections.map((c) => c.customerId));
      assert.deepEqual(answer, expected, key);
    }
    // An account filter selects, and changes nothing: the records are the dataset's own for those accounts.
    const some = new Set(connectionsOf("FRM3").map((c) => c.customerId));
    assert.deepEqual((await whole.billing.listBillingRecords({ period, customerIds: [...some] })).records, dataset.billingRecords.filter((record) => some.has(record.customerId)));
    assert.deepEqual((await whole.billing.listPayments({ period, customerIds: [] })).records, []);
    // Every charge and payment in the dataset was reachable that way: nothing belongs to no supply.
    const charges = [...asked].filter(([key]) => key !== "two").reduce((total, [, answer]) => total + answer.charges.records.length, 0);
    assert.equal(charges, dataset.billingRecords.length);
    assert.deepEqual(standing.outages, (await whole.events.listOutages({ period })).records);
  });

  it("builds the whole dataset for a question one supply cannot answer, and answers from it afterwards", async () => {
    const fresh = createDemoRepositories();
    const head = await fresh.observations.listIntervalEnergy({ meterIds: ["M-FD-MKT-HEAD"], period });
    assert.equal(head.records.length, 720);
    assert.equal((await fresh.billing.listBillingRecords({ period })).records.length, demoDataset().billingRecords.length);
    // A question with a boundary meter among customer meters goes to the whole dataset too.
    const meter = connectionsOf("MKT3")[0].meterId as string;
    const mixed = await onDemand.observations.listIntervalEnergy({ meterIds: [meter, "M-FD-MKT-HEAD"], period });
    assert.equal(mixed.records.length, 1440);
  });
});
