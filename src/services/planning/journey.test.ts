import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSyntheticMarketplace } from "../../repositories/demo/marketplace.ts";
import { journeyView } from "./journey.ts";

describe("one meter's journey", () => {
  it("follows one household in Ibadan, Band A single-phase, through six steps, each naming who acts and linking to a screen", async () => {
    const view = await journeyView(createSyntheticMarketplace());
    assert.deepEqual(
      view.steps.map((step) => step.title),
      ["Applied", "Approved", "Priced", "Funded", "Installed", "Repaying"],
    );
    for (const step of view.steps) {
      assert.ok(step.who.length > 0, step.key);
      assert.match(step.link.href, /^\/dashboard\/planning\/metering(\/marketplace|\/monitoring)?$/, step.key);
    }
    assert.match(view.steps[2].what, /^₦200 a day, taken at each recharge, never more than 50% of the recharge, into escrow\./);
    assert.equal(view.sourcing.synthetic, true);
    assert.match(view.headlineHow, /^How this is calculated:/);
  });

  it("is funded by the Marketplace's match, and repays the meter with the balance falling to nothing", async () => {
    const view = await journeyView(createSyntheticMarketplace());
    assert.deepEqual(view.steps[3].who, ["Second private fund", "GridIntel"]);
    assert.equal(view.schedule.length, 15);
    assert.equal(view.schedule.at(-1)?.repaid, true);
    assert.match(view.headline, /^On GridIntel one household in Ibadan applied, Ibadan DisCo approved it, .+ repays the funder in 15 months\.$/);
  });
});
