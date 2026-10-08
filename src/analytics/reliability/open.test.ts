import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Outage } from "@/domain";
import { PROVENANCE } from "../__fixtures__/network.ts";
import { openExposuresAt, openOutagesAt } from "./open.ts";

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

  it("calls an exposure with no restoration time in progress only when the source says the outage is open", () => {
    const open = { ...outage("OUT-OPEN", [["DT-1", "2026-01-01T23:20:00Z", undefined, 30], ["DT-2", "2026-01-01T23:20:00Z", undefined, 12]]), status: "open" as const };
    const closed = { ...outage("OUT-CLOSED", [["DT-3", "2026-01-01T09:00:00Z", undefined, 7]]), status: "closed" as const };
    const unknown = outage("OUT-UNKNOWN", [["DT-4", "2026-01-01T09:30:00Z", undefined, 1]]);
    // Restored in stages: the outage is still open, but the part already back is over.
    const staged = { ...outage("OUT-STAGED", [["DT-5", "2026-01-01T20:00:00Z", "2026-01-01T21:00:00Z", 50], ["DT-6", "2026-01-01T20:00:00Z", undefined, 20]]), status: "open" as const };
    const result = openExposuresAt([open, closed, unknown, staged], AT);
    assert.deepEqual(result.exposures.map((exposure) => [exposure.outageId, exposure.exposureIndex, exposure.state, exposure.restoredAt]), [
      ["OUT-STAGED", 1, "in_progress", null],
      ["OUT-OPEN", 0, "in_progress", null],
      ["OUT-OPEN", 1, "in_progress", null],
      ["OUT-CLOSED", 0, "restoration_not_recorded", null],
      ["OUT-UNKNOWN", 0, "restoration_not_recorded", null],
    ]);

    // As a list shows them: one row for each outage, with the customers of the parts still off.
    const grouped = openOutagesAt([open, closed, unknown, staged], AT);
    assert.deepEqual(grouped.outages.map((entry) => [entry.outageId, entry.state, entry.exposures.length, entry.customersAffected, entry.customerCountBasis]), [
      ["OUT-STAGED", "in_progress", 1, 20, "topology_derived"],
      ["OUT-OPEN", "in_progress", 2, 42, "topology_derived"],
      ["OUT-CLOSED", "restoration_not_recorded", 1, 7, "topology_derived"],
      ["OUT-UNKNOWN", "restoration_not_recorded", 1, 1, "topology_derived"],
    ]);
  });

  it("never shows a partial sum of customers as the total", () => {
    const open = { ...outage("OUT-OPEN", [["DT-1", "2026-01-01T23:20:00Z", undefined, 30], ["DT-2", "2026-01-01T23:20:00Z", undefined, null]]), status: "open" as const };
    assert.equal(openOutagesAt([open], AT).outages[0].customersAffected, null);
  });

  it("returns nothing for an empty log", () => {
    assert.deepEqual(openExposuresAt([], AT), { exposures: [], startNotRecorded: 0 });
  });
});
