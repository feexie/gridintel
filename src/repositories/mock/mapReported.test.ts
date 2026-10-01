import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEGACY_DATA } from "./legacy.ts";
import { mapReported } from "./mapReported.ts";

const { reportedKpis, issues } = mapReported(LEGACY_DATA);
const byId = new Map(reportedKpis.map((kpi) => [kpi.id, kpi]));

describe("reported figure mapping", () => {
  it("stores a figure exactly as stated, with no period, as-of, document or methodology", () => {
    const billed = byId.get("rk:mock-executive:region:adamawa:revenue_billed");
    assert.deepEqual(billed && {
      value: billed.value,
      unit: billed.unit,
      currency: billed.currency,
      period: billed.period,
      asOf: billed.asOf,
      document: billed.document,
      basis: billed.basis,
      methodology: billed.methodology,
      reportedAt: billed.reportedAt,
      source: billed.source,
    }, {
      value: 820000000,
      unit: "currency",
      currency: "NGN",
      period: null,
      asOf: null,
      document: null,
      basis: null,
      methodology: null,
      reportedAt: null,
      source: { name: "GridIntel mock executive dataset", kind: "gridintel_mock", organizationId: "mock-utility" },
    });
  });

  it("records the NGN currency as an assumption (D7)", () => {
    const currency = issues.filter((issue) =>
      issue.code === "ASSUMED_VALUE" && (issue.source.field === "revenueBilled" || issue.source.field === "revenueCollected"));
    assert.equal(currency.length, 8);
  });

  it("keeps percentages as published, without converting them to fractions", () => {
    const efficiency = byId.get("rk:mock-executive:region:adamawa:collection_efficiency");
    assert.deepEqual([efficiency?.value, efficiency?.unit], [86.6, "percent"]);
  });

  it("maps every legacy transformer count as transformer_count_unspecified (D11)", () => {
    const counts = reportedKpis.filter((kpi) => kpi.metric.endsWith("transformer_count") || kpi.metric === "transformer_count_unspecified");
    assert.ok(counts.length > 0);
    assert.ok(counts.every((kpi) => kpi.metric === "transformer_count_unspecified"));
  });

  it("keeps a reported zero as zero", () => {
    assert.equal(byId.get("rk:mock-operations:distribution_transformer:ADM-TR-003:transformer_loading")?.value, 0);
  });

  it("does not map a SAIDI figure with no stated unit", () => {
    assert.equal(byId.has("rk:mock-operations:region:adamawa:saidi"), false);
    assert.equal(byId.has("rk:mock-operations:feeder:ADM-FD-001:saidi"), false);
    assert.ok(issues.some((issue) =>
      issue.code === "UNMAPPED_FIELD" && issue.source.recordId === "adamawa" && issue.source.field === "saidi"));
    assert.deepEqual(
      [byId.get("rk:mock-executive:region:adamawa:saidi")?.value, byId.get("rk:mock-executive:region:adamawa:saidi")?.unit],
      [14.2, "hours"],
    );
  });

  it("keeps both sources' figures when they disagree, and reports the conflict", () => {
    assert.equal(byId.get("rk:mock-operations:region:adamawa:customer_count")?.value, 348520);
    assert.equal(byId.get("rk:mock-executive:region:adamawa:customer_count")?.value, 145000);
    const conflicts = issues.filter((issue) => issue.code === "CONFLICTING_SOURCES" && issue.source.recordId === "adamawa");
    assert.ok(conflicts.some((issue) => issue.source.field === "customer_count" && issue.severity === "warning"));
    // Adamawa's substation count is 12 in both sources, so it is not a conflict.
    assert.equal(conflicts.some((issue) => issue.source.field === "substation_count"), false);
  });

  it("gives every figure a unique id", () => {
    assert.equal(byId.size, reportedKpis.length);
  });
});
