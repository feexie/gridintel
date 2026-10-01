import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_DATA } from "./legacy.ts";
import { mapEvents } from "./mapEvents.ts";

const { outages, issues } = mapEvents(LEGACY_DATA);

describe("event mapping", () => {
  it("maps each executive event to an outage located by an unresolved reference", () => {
    assert.deepEqual(
      outages.map((outage) => [outage.id, outage.origin]),
      [
        ["outage:mock-executive:1", { kind: "feeder", label: "Yobe / DTR / Ali-Marami Feeder", context: "executive event 1" }],
        ["outage:mock-executive:2", { kind: "feeder", label: "Adamawa / Jimeta / Feeder 4", context: "executive event 2" }],
      ],
    );
  });

  it("never links an event to a registry record by guessing", () => {
    for (const outage of outages) {
      assert.equal("id" in outage.origin, false);
      assert.ok(outage.exposures.every((exposure) => !("id" in exposure.affected)));
    }
  });

  it("leaves unstated facts unknown", () => {
    for (const outage of outages) {
      assert.equal(outage.planned, null);
      assert.equal(outage.cause, "unknown");
      assert.equal(outage.responsibleParty, "unknown");
      assert.equal(outage.provenance.sourceSystem, "mock-executive");
    }
  });

  it("keeps the recorded customer count and leaves times without a date undefined", () => {
    const [exposure] = outages[0].exposures;
    assert.equal(exposure.customersAffected, 25000);
    assert.equal(exposure.customerCountBasis, "recorded");
    assert.equal(exposure.interruptedAt, undefined);
    assert.equal(exposure.restoredAt, undefined);
    assert.match(outages[0].notes ?? "", /09:35 AM/);
    assert.match(outages[1].notes ?? "", /RESTORED/);
  });

  it("reports each unreadable time as a warning, since the outage is still usable", () => {
    const times = issues.filter((issue) => issue.code === "UNPARSEABLE_TIME");
    assert.deepEqual(times.map((issue) => [issue.severity, issue.source.recordId]), [["warning", "1"], ["warning", "2"]]);
  });

  it("uses a zoned event time: an interruption for OUTAGE, a restoration for RESTORED", () => {
    const legacy = structuredClone(LEGACY_DATA);
    const mapped = mapEvents({
      ...legacy,
      executiveEvents: [
        { ...legacy.executiveEvents[0], timestamp: "2026-07-12T08:35:00Z" },
        { ...legacy.executiveEvents[1], timestamp: "2026-07-12T09:02:00Z" },
      ],
    });
    assert.equal(mapped.outages[0].exposures[0].interruptedAt, "2026-07-12T08:35:00Z");
    assert.equal(mapped.outages[1].exposures[0].restoredAt, "2026-07-12T09:02:00Z");
    assert.equal(mapped.outages[1].exposures[0].interruptedAt, undefined);
    assert.equal(mapped.issues.some((issue) => issue.code === "UNPARSEABLE_TIME"), false);
  });
});
