import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { MetricView } from "../operations/views.ts";
import type { FeederSignals, TransformerSignals } from "./attention.ts";
import { ATTENTION_METHOD, attention } from "./attention.ts";

const metric = (label: string, value: number | null, unit: MetricView["unit"] = "fraction"): MetricView => ({
  label,
  value,
  unit,
  currency: unit === "currency" ? "NGN" : null,
  status: value === null ? "insufficient_data" : "ok",
  origin: "calculated",
  derivation: null,
  method: null,
  inputs: [],
  estimatedInputs: [],
  missingInputs: [],
  warnings: [],
  note: null,
});

const feeder = (
  id: string,
  signals: { gap: number | null; atcc: number | null; collection: number | null; saidi?: number | null; daysBelow?: number | null },
): FeederSignals => ({
  id,
  name: `Feeder ${id}`,
  revenueNotRealised: metric("Revenue not realised", signals.gap, "currency"),
  atcc: metric("ATC&C", signals.atcc),
  collectionEfficiency: metric("Collection efficiency", signals.collection),
  networkSaidi: metric("SAIDI, network-attributable", signals.saidi ?? null, "hours"),
  supply: { band: "A", minimumHours: 20, averageHours: metric("Hours of supply per day", 21, "hours_per_day"), daysBelowMinimum: signals.daysBelow ?? 0 },
});

const transformer = (
  id: string,
  feederName: string,
  signals: { peak: number | null; hoursOver?: number; commercialLoss: number | null; commercialGap: number | null },
): TransformerSignals => ({
  id,
  name: `Transformer ${id}`,
  feederName,
  peakLoading: signals.peak === null ? null : metric("Peak loading", signals.peak),
  hoursOverRating: signals.hoursOver ?? 0,
  commercialLoss: metric("Commercial loss", signals.commercialLoss),
  commercialGap: metric("Commercial gap", signals.commercialGap, "currency"),
});

// F-A: the larger money figure but better ratios. F-B: worse ratios, smaller money figure.
const FEEDERS = [
  feeder("F-A", { gap: 2_600_000, atcc: 0.13, collection: 0.95, saidi: 2, daysBelow: 7 }),
  feeder("F-B", { gap: 1_200_000, atcc: 0.59, collection: 0.66, saidi: 8, daysBelow: 3 }),
];
// T-2's commercial gap alone is larger than feeder F-B's whole figure would rank... if it were ranked.
const TRANSFORMERS = [
  transformer("T-1", "Feeder F-A", { peak: 0.9, commercialLoss: 0.1, commercialGap: 300_000 }),
  transformer("T-2", "Feeder F-B", { peak: 1.21, hoursOver: 69, commercialLoss: 0.29, commercialGap: 5_000_000 }),
  transformer("T-3", "Feeder F-B", { peak: 1.05, hoursOver: 4, commercialLoss: 0.2, commercialGap: 100_000 }),
  transformer("T-4", "Feeder F-A", { peak: 0.5, commercialLoss: 0.35, commercialGap: 9_000_000 }),
];

const result = attention(FEEDERS, TRANSFORMERS);
const ids = (subjects: { subject: { id: string } }[]) => subjects.map((entry) => entry.subject.id);

describe("where to look first: asset risk", () => {
  it("is its own group, ordered by peak loading and never by money", () => {
    assert.deepEqual(ids(result.assetRisk), ["T-2", "T-3"]);
    assert.deepEqual(result.assetRisk.map((entry) => entry.rank), [1, 2]);
    assert.ok(result.assetRisk.every((entry) => entry.group === "asset_risk" && entry.money === null));
    // T-3 has a tiny money figure and T-2 a huge one; neither moves them, and a larger gap elsewhere does not outrank them.
    const reordered = attention(FEEDERS, [
      ...TRANSFORMERS.filter((dt) => dt.id !== "T-3"),
      transformer("T-3", "Feeder F-B", { peak: 1.05, hoursOver: 4, commercialLoss: 0.2, commercialGap: 99_000_000 }),
    ]);
    assert.deepEqual(ids(reordered.assetRisk), ["T-2", "T-3"]);
  });

  it("does not list a transformer that stayed within its rating", () => {
    assert.ok(!ids(result.assetRisk).includes("T-1"));
    assert.deepEqual(attention(FEEDERS, [transformer("T-1", "Feeder F-A", { peak: 0.99, commercialLoss: null, commercialGap: null })]).assetRisk, []);
  });

  it("appears nowhere in the money ranking", () => {
    assert.ok(!ids(result.ranked).some((id) => ids(result.assetRisk).includes(id)));
  });
});

describe("where to look first: money ranking", () => {
  it("ranks feeders by revenue not realised, largest first, whatever their ratios", () => {
    const money = result.ranked.filter((entry) => entry.group === "money");
    assert.deepEqual(ids(money), ["F-A", "F-B"]);
    assert.deepEqual(money.map((entry) => entry.money?.value), [2_600_000, 1_200_000]);
    assert.ok(money.every((entry) => entry.subject.kind === "feeder"));
  });

  it("never lets a transformer's commercial gap compete with its feeder's total", () => {
    // T-4 has the highest commercial loss and a commercial gap larger than either feeder's figure.
    const t4 = result.ranked.find((entry) => entry.subject.id === "T-4");
    assert.equal(t4?.group, "other");
    assert.equal(t4?.money, null);
    assert.ok((t4?.rank as number) > 2, "it follows every money-ranked feeder");
    // The gap is still shown, as context, and says whose total it belongs to.
    const finding = t4?.findings[0];
    assert.equal(finding?.context?.metric.value, 9_000_000);
    assert.match(finding?.context?.note ?? "", /part of Feeder F-A's revenue not realised; not ranked separately/);
    assert.ok(result.ranked.every((entry) => entry.group !== "money" || entry.subject.kind === "feeder"));
  });

  it("puts a feeder with no positive money figure after the ranked ones, in rule order", () => {
    const withUnknown = attention(
      [...FEEDERS, feeder("F-C", { gap: null, atcc: 0.9, collection: 0.2, saidi: 20 }), feeder("F-D", { gap: -500, atcc: 0.1, collection: 0.99, daysBelow: 2 })],
      [],
    );
    assert.deepEqual(ids(withUnknown.ranked), ["F-A", "F-B", "F-C", "F-D"]);
    assert.deepEqual(withUnknown.ranked.map((entry) => entry.group), ["money", "money", "other", "other"]);
    assert.deepEqual(withUnknown.ranked.map((entry) => entry.rank), [1, 2, 3, 4]);
  });
});

describe("where to look first: one entry per subject", () => {
  it("lists each subject once, with every rule it triggered", () => {
    const all = [...result.assetRisk, ...result.ranked];
    assert.equal(new Set(all.map((entry) => `${entry.subject.kind}:${entry.subject.id}`)).size, all.length);

    const fb = result.ranked.find((entry) => entry.subject.id === "F-B");
    assert.deepEqual(fb?.findings.map((finding) => finding.rule), [
      "Feeder with the highest ATC&C",
      "Feeder below its service-band minimum on at least one day",
      "Feeder with the lowest collection efficiency",
      "Feeder with the highest network-attributable SAIDI",
    ]);
    const fa = result.ranked.find((entry) => entry.subject.id === "F-A");
    assert.deepEqual(fa?.findings.map((finding) => finding.rule), [
      "Feeder with the largest revenue not realised",
      "Feeder below its service-band minimum on at least one day",
    ]);
  });

  it("keeps an over-rating transformer in asset risk even when it triggers another rule, with both listed", () => {
    const both = attention(FEEDERS, [transformer("T-9", "Feeder F-B", { peak: 1.3, hoursOver: 10, commercialLoss: 0.5, commercialGap: 400_000 })]);
    assert.deepEqual(ids(both.assetRisk), ["T-9"]);
    assert.deepEqual(both.assetRisk[0].findings.map((finding) => finding.rule), [
      "Transformer loaded above its rating",
      "Transformer with the highest commercial loss",
    ]);
    assert.ok(!ids(both.ranked).includes("T-9"));
  });

  it("makes no finding from a figure that has no value, and is the same every time", () => {
    const empty = attention([feeder("F-X", { gap: null, atcc: null, collection: null })], [transformer("T-X", "Feeder F-X", { peak: null, commercialLoss: null, commercialGap: null })]);
    assert.deepEqual(empty, { assetRisk: [], ranked: [] });
    assert.deepEqual(attention(FEEDERS, TRANSFORMERS), result);
  });

  it("prints a method that says exactly this", () => {
    assert.match(ATTENTION_METHOD, /Asset risk is its own group, shown first and never ranked by money/);
    assert.match(ATTENTION_METHOD, /Only feeders are ranked by money, because a transformer's commercial gap is already part of its feeder's total/);
    assert.match(ATTENTION_METHOD, /Subjects with no money figure follow in rule order/);
    assert.match(ATTENTION_METHOD, /Each subject appears once, with every rule it triggered/);
  });
});
