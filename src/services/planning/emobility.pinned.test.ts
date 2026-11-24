import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createSyntheticEmobility } from "../../repositories/demo/emobility.ts";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { comparePowerSources, type HubPowerFacts } from "../../analytics/planning/emobility/powerSource.ts";
import { emobilityView } from "./emobility.ts";

/* EMOB-A's results pinned across the move of the solar sizing to analytics/planning/solar.ts
   (Phase MG-PLAN-A, docs/design/MG-PLAN.md 3.5): the whole planner view on the six synthetic hubs,
   every figure and every method version, is compared with the view recorded before the move.
   The record is written only with GRIDINTEL_PIN=write, never by an ordinary run. */
const PINNED = new URL("./__pinned__/emobility-view.json", import.meta.url);
const PINNED_RAW = new URL("./__pinned__/emobility-power-source.json", import.meta.url);

/* The power-source comparison unformatted, at full precision, over a spread of hubs: small and
   large, sunny and cloudy, grid known and unknown, installed costs given and not. */
const HUBS: HubPowerFacts[] = [
  { swapsPerDay: { motorcycle: 40 }, kwhPerDay: 96.4, grid: { tariffPerKwh: 209.5, hoursOfSupply: 20.3, availableKw: 12 }, solar: { averagePeakSunHours: 5.41, rainySeasonPeakSunHours: 4.12 }, installed: { pvNairaPerKwp: null, bessNairaPerKwh: null } },
  { swapsPerDay: { motorcycle: 120, tricycle: 30 }, kwhPerDay: 431.7, grid: { tariffPerKwh: 62.33, hoursOfSupply: 9.7, availableKw: 25 }, solar: { averagePeakSunHours: 5.87, rainySeasonPeakSunHours: 4.66 }, installed: { pvNairaPerKwp: 650_000, bessNairaPerKwh: 420_000 } },
  { swapsPerDay: { tricycle: 55 }, kwhPerDay: 212.9, grid: { tariffPerKwh: null, hoursOfSupply: 14.2, availableKw: 18 }, solar: { averagePeakSunHours: 4.93, rainySeasonPeakSunHours: 3.71 }, installed: { pvNairaPerKwp: 700_000, bessNairaPerKwh: null } },
  { swapsPerDay: { motorcycle: 75 }, kwhPerDay: 180.25, grid: { tariffPerKwh: 225, hoursOfSupply: 23.1, availableKw: 4.5 }, solar: { averagePeakSunHours: 6.02, rainySeasonPeakSunHours: 5.1 }, installed: { pvNairaPerKwp: 610_000, bessNairaPerKwh: 395_000 } },
  { swapsPerDay: { motorcycle: 10, tricycle: 3 }, kwhPerDay: 31.3, grid: { tariffPerKwh: 130.6, hoursOfSupply: null, availableKw: null }, solar: { averagePeakSunHours: 5.15, rainySeasonPeakSunHours: 3.98 }, installed: { pvNairaPerKwp: null, bessNairaPerKwh: 400_000 } },
  { swapsPerDay: {}, kwhPerDay: 0, grid: { tariffPerKwh: 209.5, hoursOfSupply: 18, availableKw: 10 }, solar: { averagePeakSunHours: 5.5, rainySeasonPeakSunHours: 4.2 }, installed: { pvNairaPerKwp: 650_000, bessNairaPerKwh: 420_000 } },
];

describe("EMOB-A's planner view, pinned", () => {
  it("is exactly the view recorded before the solar sizing moved to a shared module", async () => {
    const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
    const view = JSON.parse(JSON.stringify(await emobilityView(runtime, nercPublishedFigures(), createSyntheticEmobility())));
    if (process.env.GRIDINTEL_PIN === "write") writeFileSync(PINNED, `${JSON.stringify(view, null, 1)}\n`);
    assert.deepEqual(view, JSON.parse(readFileSync(PINNED, "utf8")));
  });

  it("compares power sources to the last digit as it did before the move", () => {
    const raw = HUBS.map((hub) => comparePowerSources(hub));
    if (process.env.GRIDINTEL_PIN === "write") writeFileSync(PINNED_RAW, `${JSON.stringify(raw, null, 1)}
`);
    assert.deepEqual(raw, JSON.parse(readFileSync(PINNED_RAW, "utf8")));
  });
});
