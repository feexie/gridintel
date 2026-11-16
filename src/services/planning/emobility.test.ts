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
    assert.ok(view.sourcing.citations.some((citation) => citation.id === "nbs-diesel-price-watch-2026-05"));
    const url = (id: string) => view.sourcing.citations.find((citation) => citation.id === id)?.url;
    assert.equal(url("ifi-harmonized-gef-v2-2019"), "https://unfccc.int/sites/default/files/resource/Harmonized_Grid_Emission_factor_data_set.pdf");
    assert.match(url("nbs-diesel-price-watch-2026-05") ?? "", /^https:\/\/www\.legit\.ng\//);
    assert.match(url("techcabal-2026-07-30") ?? "", /^https:\/\/techcabal\.com\/2026\/07\/30\//);
  });

  it("gives every input a status and a source or basis", () => {
    for (const input of view.inputs) {
      assert.ok(STATUSES.has(input.status), input.key);
      assert.ok(input.basis.length > 0, input.key);
    }
    assert.equal(view.inputs.find((one) => one.key === "pvCost")?.status, "placeholder");
    const input = (key: string) => view.inputs.find((one) => one.key === key)!;
    assert.equal(input("gridCo2").status, "reported");
    assert.equal(input("gridCo2").value, "0.395 kg CO2 a kWh");
    assert.match(input("gridCo2").basis, /IFI Harmonized Grid Emission Factors, v2\.0 \(July 2019\), Nigeria, combined margin, firm energy.*dates from 2019/);
    assert.equal(input("dieselPrice").value, "₦3,277.47 a litre");
    assert.match(input("dieselPrice").basis, /NBS Diesel Price Watch, May 2026 \(published 24 June 2026\)/);
    assert.equal(input("dieselLowPrice").value, "₦1,750 a litre");
    assert.match(input("dieselLowPrice").basis, /TechCabal, 30 July 2026.*low case/);
    assert.equal(input("dieselPerKwh").value, "₦1,092.49/kWh");
    assert.equal(input("dieselPerKwhLow").value, "₦583.33/kWh");
    assert.match(input("dieselPerKwh").basis, /Fuel only/);
    assert.match(input("dieselPerKwhLow").basis, /Fuel only/);
    assert.equal(input("bessEfficiency").value, "90%");
    assert.equal(input("bessEfficiency").status, "assumption");
    assert.equal(input("adoption").status, "placeholder");
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
    assert.deepEqual(view.sites.order[0].reasons, ["fits on the grid at 24 months", "cheapest feasible option: Grid with diesel backup, ₦524 a swap", "headroom left at 24 months: 121 kVA"]);
    const demo = view.sites.order.find((row) => row.hub.startsWith("Government Avenue"))!;
    assert.deepEqual(demo.reasons, ["does not fit on the grid at 24 months", "grid options not feasible without a DT upgrade (4.9 kVA short)", "cheapest feasible option: Diesel only, ₦2,731 a swap", "headroom left at 24 months: -5 kVA"]);
  });

  it("answers power source at each hub's own band tariff, with no solar cost or payback before an EPC quote", () => {
    const demo = view.power.hubs.find((hub) => hub.hubId === "HUB-02")!;
    const option = (name: string) => demo.options.find((one) => one.option === name)!;
    assert.equal(option("Diesel only").costPerKwh.value, "₦1,092.49/kWh");
    assert.equal(option("Diesel only").costAtLowDiesel.value, "₦583.33/kWh, ₦1,458 a swap");
    assert.equal(option("Grid with diesel backup").costPerKwh.value, "₦63.33/kWh");
    assert.equal(option("Solar + BESS").costPerKwh.status, "placeholder");
    assert.equal(option("Solar + BESS").payback.status, "placeholder");
    assert.equal(option("Grid with diesel backup").co2Avoided.status, "calculated");
    assert.equal(option("Solar + BESS").co2Avoided.status, "calculated");
    assert.match(view.power.headline, /Band B grid/);
  });

  it("reports no material CO2 saving for the tricycle hub on diesel, with its assumptions beside it", () => {
    const keke = view.power.hubs.find((hub) => hub.hubId === "HUB-06")!.options.find((one) => one.option === "Diesel only")!;
    assert.equal(keke.co2Avoided.value, "No material saving under these assumptions (assumptions: petrol tricycle (keke) 30 km a litre, electric 12 km a kWh)");
  });

  it("answers finance: the 3-month pledge is queued with its reason, and hub costs are synthetic or a placeholder", () => {
    const short = view.finance.pledges.find((pledge) => pledge.id === "PL-SHORT")!;
    assert.equal(short.hasQueued, true);
    assert.equal(short.placed, "₦0");
    assert.equal(short.hubs, "None");
    assert.equal(short.queuedReason, "tenor shorter than any hub's payback");
    for (const hub of view.finance.hubs) assert.ok(hub.cost.status === "synthetic" || hub.cost.status === "placeholder", hub.hubId);
    assert.ok(!view.finance.hubs.some((hub) => hub.hubId === "HUB-05"), "an installed hub is not offered for funding");
  });

  it("answers verify for the installed hub, from synthetic records", () => {
    assert.equal(view.verify.hubs.length, 1);
    const figures: EmobilityFigure[] = view.verify.hubs[0].figures;
    assert.deepEqual(figures.map((figure) => figure.status), ["synthetic", "synthetic", "synthetic"]);
  });

  it("funds no hub on a grid option it fails: a named DT upgrade, or solar + BESS waiting for its cost", () => {
    const hub = (id: string) => view.finance.hubs.find((one) => one.hubId === id)!;
    assert.equal(hub("HUB-01").power, "Grid with diesel backup");
    assert.equal(hub("HUB-02").power, "Grid with diesel backup, after a DT upgrade");
    assert.match(hub("HUB-02").powerReason, /^DT upgrade needed on DT-GOV-4 \(300 kVA\) by 24 months/);
    assert.match(hub("HUB-04").powerReason, /^DT upgrade needed on DT-OLD-2 \(100 kVA\) now/);
    for (const id of ["HUB-03", "HUB-06"]) {
      assert.equal(hub(id).power, "Solar + BESS");
      assert.equal(hub(id).cost.status, "placeholder");
      assert.equal(hub(id).fundedBy, "Not offered until costed");
    }
    // Every hub that does not fit on the grid through 24 months is funded only after a named DT upgrade, or not at all.
    for (const site of view.sites.hubs) {
      const financed = view.finance.hubs.find((one) => one.hubId === site.hubId);
      if (financed === undefined || financed.fundedBy === "Waiting" || financed.fundedBy === "Not offered until costed") continue;
      const failsBy24 = site.horizons.filter((row) => Number(row.months) <= 24).some((row) => row.fits !== "Fits");
      if (failsBy24) assert.match(financed.power, /after a DT upgrade/, site.hubId);
    }
  });
});
