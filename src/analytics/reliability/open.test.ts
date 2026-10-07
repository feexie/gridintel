import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Outage } from "@/domain";
import { PROVENANCE } from "../__fixtures__/network.ts";
import { openExposuresAt } from "./open.ts";

const AT = "2026-01-02T00:00:00Z";

const outage = (id: string, exposures: [string, string | undefined, string | undefined, number | null][]): Outage => ({
  id,
  origin: { kind: "feeder", id: "FD-1" },
  originPoint: "mv_feeder",
  planned: false,
  cause: "fault",
  responsibleParty: "distribution",
  exposures: exposures.map(([affected, interruptedAt, restoredAt, customers]) => ({
    affected: { kind: "distribution_transformer", id: affected },
    customersAffected: customers,
    customerCountBasis: "topology_derived",
    interruptedAt,
    restoredAt,
    quality: "measured",
  })),
  provenance: PROVENANCE,
});

describe("interruptions open at a time", () => {
  it("keeps apart what is in progress, what has no restoration time, and what has no start", () => {
    const result = openExposuresAt(
      [
        // Over before the time: not returned.
        outage("OUT-1", [["DT-1", "2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z", 40]]),
        // Restored in stages: one part back before the time, one after it.
        outage("OUT-2", [
          ["DT-2", "2026-01-01T22:00:00Z", "2026-01-01T23:00:00Z", 30],
          ["DT-3", "2026-01-01T22:00:00Z", "2026-01-02T03:00:00Z", 55],
        ]),
        // No restoration time: still out, or not written down. Not assumed either way.
        outage("OUT-3", [["DT-4", "2026-01-01T08:00:00Z", undefined, null]]),
        // Begins after the time: not returned.
        outage("OUT-4", [["DT-5", "2026-01-02T01:00:00Z", undefined, 12]]),
        // No start time: counted, not listed.
        outage("OUT-5", [["DT-6", undefined, "2026-01-02T05:00:00Z", 9]]),
        // In progress since earlier than OUT-2: listed before it.
        outage("OUT-6", [["DT-7", "2026-01-01T20:00:00Z", "2026-01-02T00:30:00Z", 70]]),
      ],
      AT,
    );

    assert.deepEqual(
      result.exposures.map((exposure) => [exposure.outageId, exposure.exposureIndex, exposure.state, exposure.customersAffected, exposure.restoredAt]),
      [
        ["OUT-6", 0, "in_progress", 70, "2026-01-02T00:30:00Z"],
        ["OUT-2", 1, "in_progress", 55, "2026-01-02T03:00:00Z"],
        ["OUT-3", 0, "restoration_not_recorded", null, null],
      ],
    );
    assert.equal(result.startNotRecorded, 1);
    assert.deepEqual(result.exposures[0].origin, { kind: "feeder", id: "FD-1" });
    assert.equal(result.exposures[0].originPoint, "mv_feeder");
  });

  it("treats an exposure restored exactly at the time as over, and one interrupted exactly at it as open", () => {
    const result = openExposuresAt(
      [outage("OUT-1", [["DT-1", "2026-01-01T10:00:00Z", AT, 5]]), outage("OUT-2", [["DT-2", AT, "2026-01-02T01:00:00Z", 6]])],
      AT,
    );
    assert.deepEqual(result.exposures.map((exposure) => exposure.outageId), ["OUT-2"]);
  });

  it("returns nothing for an empty log", () => {
    assert.deepEqual(openExposuresAt([], AT), { exposures: [], startNotRecorded: 0 });
  });
});
