import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import type { OperationsRuntime } from "../operations/levels.ts";
import { DEMO_CLOCK, DEMO_PERIOD, createDemoRepositories } from "../../repositories/demo/index.ts";
import { createSyntheticEmobility } from "../../repositories/demo/emobility.ts";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { emobilityView } from "./emobility.ts";
import type { EmobilityFigure, EmobilityView } from "./emobilityViews.ts";

const runtime: OperationsRuntime = { repos: createDemoRepositories(), now: DEMO_CLOCK, period: DEMO_PERIOD, caveats: {} };
const STATUSES = new Set(["reported", "calculated", "assumption", "placeholder", "synthetic", "not_available"]);

describe("the e-mobility planner on the synthetic hubs", () => {
  let view: EmobilityView;
  before(async () => {
    view = await emobilityView(runtime, nercPublishedFigures(), createSyntheticEmobility());
  });

  it("is marked synthetic and names its sources and citations", () => {
    assert.equal(view.sourcing.synthetic, true);
    assert.ok(view.sourcing.sources.some((source) => source.id === "synthetic-emobility"));
    assert.ok(view.sourcing.citations.some((citation) => citation.id.startsWith("nasa-power")));
    assert.ok(view.sourcing.citations.some((citation) => /NERC/.test(citation.title)));
  });

  it("gives every input a status and a source or basis", () => {
    for (const input of view.inputs) {
      assert.ok(STATUSES.has(input.status), input.key);
      assert.ok(input.basis.length > 0, input.key);
    }
    assert.equal(view.inputs.find((one) => one.key === "pvCost")?.status, "placeholder");
    assert.equal(view.inputs.find((one) => one.key === "gridCo2")?.status, "not_available");
    assert.equal(view.inputs.find((one) => one.key === "dieselPerKwh")?.value, "₦583.33/kWh");
    assert.match(view.inputs.find((one) => one.key === "dieselPerKwh")!.basis, /Fuel only/);
  });

  it("answers demand: 750 kWh a day at the demonstration hub, 1,000 at full depletion", () => {
    assert.match(view.demand.headline, /^The demonstration hub draws 750 kWh a day for 300 swaps \(1,000 kWh if every battery came back empty\), and 1,367 kWh at 24 months under base adoption\.$/);
    assert.match(view.demand.how, /^How this is calculated:/);
  });

  it("answers sites: each case the dataset was designed for", () => {
    const finding = (id: string) => view.sites.hubs.find((hub) => hub.hubId === id)!.finding;
    assert.equal(finding("HUB-01"), "Fits now and at 48 months");
    assert.equal(finding("HUB-02"), "Fits now; not at 24 months (DT rating)");
    assert.match(finding("HUB-03"), /^Does not fit now \(supply hours\)$/);
    assert.match(finding("HUB-04"), /^Does not fit now \(DT rating/);
    const farm = view.sites.hubs.find((hub) => hub.hubId === "HUB-03")!;
    assert.equal(farm.band, "Band D");
    assert.equal(farm.tariff, "₦50.01/kWh");
    assert.equal(view.sites.order.length, 6);
    assert.deepEqual(view.sites.order[0].reasons, ["fits on the grid at 24 months", "cheapest costed option: Grid with diesel backup, ₦524 a swap", "headroom left at 24 months: 121 kVA"]);
  });

  it("answers power source at each hub's own band tariff, with no solar cost or payback before an EPC quote", () => {
    const demo = view.power.hubs.find((hub) => hub.hubId === "HUB-02")!;
    const option = (name: string) => demo.options.find((one) => one.option === name)!;
    assert.equal(option("Diesel only").costPerKwh.value, "₦583.33/kWh");
    assert.equal(option("Grid with diesel backup").costPerKwh.value, "₦63.33/kWh");
    assert.equal(option("Solar + BESS").costPerKwh.status, "placeholder");
    assert.equal(option("Solar + BESS").payback.status, "placeholder");
    assert.equal(option("Grid with diesel backup").co2Avoided.status, "not_available");
    assert.equal(option("Solar + BESS").co2Avoided.status, "calculated");
    assert.match(view.power.headline, /Band B grid/);
  });

  it("answers finance: a pledge that cannot place its money is queued, and hub costs are synthetic", () => {
    const short = view.finance.pledges.find((pledge) => pledge.id === "PL-SHORT")!;
    assert.equal(short.hasQueued, true);
    assert.equal(short.placed, "₦0");
    for (const hub of view.finance.hubs) assert.equal(hub.cost.status, "synthetic");
    assert.ok(!view.finance.hubs.some((hub) => hub.hubId === "HUB-05"), "an installed hub is not offered for funding");
  });

  it("answers verify for the installed hub, from synthetic records", () => {
    assert.equal(view.verify.hubs.length, 1);
    const figures: EmobilityFigure[] = view.verify.hubs[0].figures;
    assert.deepEqual(figures.map((figure) => figure.status), ["synthetic", "synthetic", "synthetic"]);
  });
});
