import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { InputValue } from "../core/result.ts";
import type { InterruptionCause, InterruptionOrigin, Outage, Period, ResponsibleParty } from "@/domain";
import { CONTEXT, PROVENANCE, approx } from "../__fixtures__/network.ts";
import { calculateReliability } from "./indices.ts";
import { calculateSupplyHours } from "./supplyHours.ts";

const TWO_DAYS: Period = { start: "2026-01-01T00:00:00Z", end: "2026-01-03T00:00:00Z" };
const SCOPE = { kind: "feeder", id: "FD-1" } as const;
const served = (value: number | null): InputValue => ({
  value,
  unit: "count",
  origin: "calculated",
  quality: value === null ? "missing" : "measured",
});

const outage = (
  id: string,
  cause: InterruptionCause,
  responsibleParty: ResponsibleParty,
  customers: number | null,
  interruptedAt?: string,
  restoredAt?: string,
): Outage => ({
  id,
  origin: { kind: "feeder", id: "FD-1" },
  planned: cause === "planned_maintenance",
  cause,
  responsibleParty,
  exposures: [
    {
      affected: { kind: "feeder", id: "FD-1" },
      customersAffected: customers,
      customerCountBasis: "recorded",
      interruptedAt,
      restoredAt,
      quality: "measured",
    },
  ],
  provenance: PROVENANCE,
});

// 10 customers. Day 1: 6 h of shedding for all, a 2 h fault for 5. Day 2: 3 h upstream loss for all.
const OUTAGES: Outage[] = [
  outage("O-SHED", "load_shedding", "transmission", 10, "2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"),
  outage("O-FAULT", "fault", "distribution", 5, "2026-01-01T10:00:00Z", "2026-01-01T12:00:00Z"),
  outage("O-PLANNED", "planned_maintenance", "distribution", 2, "2026-01-01T13:00:00Z", "2026-01-01T14:00:00Z"),
  outage("O-UP", "upstream_supply", "transmission", 10, "2026-01-02T08:00:00Z", "2026-01-02T11:00:00Z"),
  outage("O-GEN", "fault", "generation", 10, "2026-01-02T12:00:00Z", "2026-01-02T13:00:00Z"),
  outage("O-THIRD", "vandalism", "third_party", 1, "2026-01-02T14:00:00Z", "2026-01-02T15:00:00Z"),
  outage("O-TRIP", "fault", "distribution", 10, "2026-01-02T16:00:00Z", "2026-01-02T16:02:00Z"),
  outage("O-OPEN", "unknown", "unknown", 1, "2026-01-02T17:00:00Z"),
];

describe("reliability attribution", () => {
  const result = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: OUTAGES, customersServed: served(10), context: CONTEXT });

  it("puts every counted exposure in exactly one class, by cause and responsible party", () => {
    const a = result.attribution;
    // Load shedding wins over the responsible party; a generation fault is upstream supply.
    assert.equal(a.load_management.customerMinutes, 10 * 360);
    assert.equal(a.upstream_supply.customerMinutes, 10 * 180 + 10 * 60);
    assert.equal(a.network.customerMinutes, 5 * 120 + 2 * 60);
    assert.equal(a.other.customerMinutes, 60);
    assert.equal(a.network.customerInterruptions, 7);
    assert.equal(a.upstream_supply.customerInterruptions, 20);
  });

  it("sums to the total SAIDI and SAIFI", () => {
    const parts = Object.values(result.attribution);
    assert.ok(approx(parts.reduce((sum, part) => sum + (part.saidi as number), 0), result.saidi.value as number));
    assert.ok(approx(parts.reduce((sum, part) => sum + (part.saifi as number), 0), result.saifi.value as number));
    assert.ok(approx(result.attribution.network.saidi, 72));
  });

  it("leaves momentary and unusable exposures out of every class", () => {
    const counted = Object.values(result.components.attribution).reduce((sum, part) => sum + part.exposures, 0);
    assert.equal(counted, 6);
    assert.equal(result.components.momentary.exposures, 1);
    assert.equal(result.components.excludedForData, 1);
  });

  it("gives customer-minutes but no index when the customers served are not known", () => {
    const unknown = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: OUTAGES, customersServed: served(null), context: CONTEXT });
    assert.equal(unknown.attribution.network.saidi, null);
    assert.equal(unknown.attribution.network.saifi, null);
    assert.equal(unknown.attribution.network.customerMinutes, 720);
  });
});

describe("reliability attribution by origin point", () => {
  const at = (id: string, originPoint: InterruptionOrigin, cause: InterruptionCause, party: ResponsibleParty, hour: number): Outage => ({
    ...outage(id, cause, party, 10, `2026-01-01T${String(hour).padStart(2, "0")}:00:00Z`, `2026-01-01T${String(hour + 1).padStart(2, "0")}:00:00Z`),
    originPoint,
  });
  const classes = (outages: Outage[]) => {
    const { attribution } = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages, customersServed: served(10), context: CONTEXT });
    return Object.fromEntries(Object.entries(attribution).map(([name, part]) => [name, part.customerMinutes]));
  };

  it("puts a sub-transmission line fault on the network, even when its record calls it a loss of upstream supply", () => {
    assert.deepEqual(classes([at("O-LINE", "subtransmission_line", "upstream_supply", "transmission", 1)]), {
      network: 600,
      upstream_supply: 0,
      load_management: 0,
      other: 0,
    });
  });

  it("keeps the transmission station and the grid upstream, whoever the record names", () => {
    assert.deepEqual(
      classes([at("O-STATION", "transmission_station", "fault", "distribution", 1), at("O-GRID", "grid", "upstream_supply", "transmission", 3)]),
      { network: 0, upstream_supply: 1200, load_management: 0, other: 0 },
    );
  });

  it("keeps load shedding its own class, whatever its origin point", () => {
    assert.deepEqual(classes([at("O-SHED", "grid", "load_shedding", "transmission", 1)]), {
      network: 0,
      upstream_supply: 0,
      load_management: 600,
      other: 0,
    });
  });

  it("leaves damage by a third party on the network in 'other'", () => {
    assert.equal(classes([at("O-THIRD", "lv_network", "vandalism", "third_party", 1)]).other, 600);
  });

  it("falls back on cause and responsible party only where no origin point is recorded", () => {
    const unrecorded = outage("O-UP", "upstream_supply", "transmission", 10, "2026-01-01T01:00:00Z", "2026-01-01T02:00:00Z");
    assert.equal(classes([unrecorded]).upstream_supply, 600);
  });

  it("breaks the usable exposures down by origin point, with those not recorded named as such", () => {
    const result = calculateReliability({
      scope: SCOPE,
      period: TWO_DAYS,
      outages: [at("O-LINE", "subtransmission_line", "fault", "distribution", 1), ...OUTAGES.slice(1, 2)],
      customersServed: served(10),
      context: CONTEXT,
    });
    const byOrigin = result.components.breakdown.byOriginPoint;
    assert.equal(byOrigin.subtransmission_line?.customerMinutes, 600);
    assert.equal(byOrigin.not_recorded?.customerMinutes, 600);
  });

  it("names the methodology version that carries the rule", () => {
    const result = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: [], customersServed: served(10), context: CONTEXT });
    assert.deepEqual(result.saidi.methodology, { id: "gridintel.reliability.reference", version: "0.3.0" });
  });
});

describe("hours of supply and band compliance", () => {
  const supply = (band: "A" | "C" | null, customers: number | null = 10, period = TWO_DAYS) =>
    calculateSupplyHours({ scope: SCOPE, period, outages: OUTAGES, customersServed: served(customers), band, context: CONTEXT });

  it("is the customer-weighted hours of supply on each day, counting every interruption", () => {
    const result = supply("A");
    assert.equal(result.status, "ok");
    // Day 1: 3600 + 600 + 120 customer-minutes over 10 customers = 7.2 h off.
    assert.ok(approx(result.days[0].hoursOfSupply, 24 - 7.2));
    // Day 2: 1800 + 600 + 60 + 20 (the momentary trip counts too) = 4.1333 h off.
    assert.ok(approx(result.days[1].hoursOfSupply, 24 - 2480 / 600));
    assert.ok(approx(result.averageHours, (16.8 + 24 - 2480 / 600) / 2));
  });

  it("tests each day against the band minimum, separately from the average", () => {
    const bandA = supply("A");
    assert.equal(bandA.minimumHours, 20);
    assert.deepEqual(bandA.days.map((day) => day.compliant), [false, false]);
    assert.equal(bandA.daysNonCompliant, 2);
    assert.equal(bandA.compliantOnAverage, false);

    const bandC = supply("C");
    assert.equal(bandC.minimumHours, 12);
    assert.equal(bandC.daysCompliant, 2);
    assert.equal(bandC.complianceRate, 1);
    assert.equal(bandC.compliantOnAverage, true);
  });

  it("reports the exposure it could not use instead of treating it as supply", () => {
    const result = supply("A");
    assert.equal(result.exposuresExcludedForData, 1);
    assert.ok(result.warnings.some((w) => w.code === "EXPOSURES_EXCLUDED"));
  });

  it("makes no band test where there is no band", () => {
    const result = supply(null);
    assert.equal(result.minimumHours, null);
    assert.equal(result.daysCompliant, null);
    assert.equal(result.compliantOnAverage, null);
    assert.equal(result.days.length, 2);
  });

  it("is insufficient_data without the customers served, and not computable over part-days", () => {
    assert.equal(supply("A", null).status, "insufficient_data");
    assert.deepEqual(supply("A", null).missingInputs, ["customers served"]);
    assert.equal(supply("A", 0).status, "not_computable");
    assert.equal(supply("A", 10, { start: "2026-01-01T00:00:00Z", end: "2026-01-02T12:00:00Z" }).status, "not_computable");
  });
});

describe("an interruption still open at the end of the period", () => {
  // 10 customers, two days. A fault from 23:00 on day 2 that its source says is open: one hour inside the period.
  const open: Outage = { ...outage("OUT-OPEN", "fault", "distribution", 10, "2026-01-02T23:00:00Z"), status: "open" };
  const closedNoTime: Outage = { ...outage("OUT-GAP", "fault", "distribution", 10, "2026-01-02T20:00:00Z"), status: "closed" };
  const unstated: Outage = outage("OUT-UNSTATED", "fault", "distribution", 10, "2026-01-02T20:00:00Z");

  it("counts to the end of the period, and marks the result provisional without calling it an estimate", () => {
    const result = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: [open], customersServed: served(10), context: CONTEXT });
    assert.ok(approx(result.saidi.value as number, 60));
    assert.equal(result.saifi.value, 1);
    assert.equal(result.saidi.status, "ok");
    assert.equal(result.saidi.quality, "measured");
    assert.deepEqual(result.provisional, { openOutages: 1, note: "Provisional: includes 1 open outage(s); duration counted to period end." });
    assert.ok(result.saidi.warnings.some((warning) => warning.code === "OPEN_OUTAGES_COUNTED"));
    assert.equal(result.components.excludedForData, 0);
    assert.equal(result.saidi.methodology.version, "0.3.0");
  });

  it("does not count a record with no restoration time whose outage is closed or has no status", () => {
    const result = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: [closedNoTime, unstated], customersServed: served(10), context: CONTEXT });
    assert.equal(result.saidi.value, 0);
    assert.equal(result.provisional, null);
    assert.equal(result.components.excludedForData, 2);
  });

  it("leaves an open outage that began after the period to a later period", () => {
    const later: Outage = { ...outage("OUT-LATER", "fault", "distribution", 10, "2026-01-03T01:00:00Z"), status: "open" };
    const result = calculateReliability({ scope: SCOPE, period: TWO_DAYS, outages: [later], customersServed: served(10), context: CONTEXT });
    assert.equal(result.saidi.value, 0);
    assert.equal(result.provisional, null);
    assert.equal(result.components.outsidePeriod, 1);
  });

  it("takes the same hour out of the day's hours of supply, provisionally", () => {
    const supply = calculateSupplyHours({ scope: SCOPE, period: TWO_DAYS, outages: [open], customersServed: served(10), band: null, context: CONTEXT });
    assert.deepEqual(supply.days.map((day) => day.hoursOfSupply), [24, 23]);
    assert.equal(supply.openOutages, 1);
    assert.ok(supply.warnings.some((warning) => warning.code === "OPEN_OUTAGES_COUNTED"));
  });
});
