import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GridIntelRepositories } from "../repositories/ports/index.ts";
import { DEMO_PERIOD, createDemoRepositories } from "../repositories/demo/index.ts";
import { createMemoryCache } from "../services/analytics/cache.ts";
import { reliabilityWorkspaceView } from "../services/reliability/view.ts";
import { canonicalJson, recordingRepositories } from "./fingerprint.ts";

/* The data fingerprint of a report (ADR 0019): the same records give the same fingerprint, in
   whatever order they are read; a changed record gives another; nothing passing is changed. */

async function fingerprintOf(repos: GridIntelRepositories): Promise<string> {
  const recording = recordingRepositories(repos);
  await reliabilityWorkspaceView({ repos: recording.repos, now: DEMO_PERIOD.end, period: DEMO_PERIOD, caveats: {}, cache: createMemoryCache() });
  return recording.fingerprint();
}

describe("the data fingerprint", () => {
  it("writes an object the same whatever the order of its keys", () => {
    assert.equal(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } }), canonicalJson({ a: { c: null, d: [2, { x: 2, y: 1 }] }, b: 1 }));
    assert.equal(canonicalJson(new Map([["k", 1]])), '[["k",1]]');
  });

  it("is the same for the same records, read twice", async () => {
    const a = await fingerprintOf(createDemoRepositories());
    const b = await fingerprintOf(createDemoRepositories());
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.equal(a, b);
  });

  it("changes when a record the report reads changes, and passes every result through unchanged", async () => {
    const base = createDemoRepositories();
    // The first outage the report reads, with a note added to it.
    const changed: GridIntelRepositories = {
      ...base,
      events: {
        ...base.events,
        listOutages: async (query) => {
          const result = await base.events.listOutages(query);
          return { ...result, records: result.records.map((outage, i) => (i === 0 ? { ...outage, notes: "corrected" } : outage)) };
        },
      },
    };
    assert.notEqual(await fingerprintOf(base), await fingerprintOf(changed));

    const recording = recordingRepositories(base);
    const query = { period: DEMO_PERIOD };
    assert.deepEqual(await recording.repos.events.listOutages(query), await base.events.listOutages(query));
    assert.equal(recording.size(), 1);
  });
});
