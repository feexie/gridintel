import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSyntheticMarketplace } from "../../repositories/demo/marketplace.ts";
import { marketplaceView } from "./marketplace.ts";

describe("the Metering Marketplace", () => {
  it("states the finding in one line, with how it is calculated, and is marked synthetic", async () => {
    const view = await marketplaceView(createSyntheticMarketplace());
    assert.match(view.headline, /^5 funders have pledged ₦[\d.,]+ (million|billion); [\d,]+ approved meters are matched; ₦[\d.,]+( million| billion)? is queued for the next allocation\.$/);
    assert.match(view.headlineHow, /^How this is calculated:/);
    assert.equal(view.sourcing.synthetic, true);
    assert.equal(view.funders.length, 5);
    assert.ok(view.funders[0].pledged.startsWith("1,000 meters"));
    assert.ok(view.funders.some((one) => one.queued.startsWith("Queued for the next allocation")));
    assert.ok(view.totals.every((one) => one.origin === "synthetic"));
  });

  it("charges each band by the day, repays Band A single-phase fastest, and exempts Lifeline", async () => {
    const view = await marketplaceView(createSyntheticMarketplace());
    assert.deepEqual(
      view.bands.map((one) => one.perDay),
      ["₦200", "₦250", "₦150", "₦100", "₦75", "₦50", "Exempt"],
    );
    assert.equal(view.bands.at(-1)?.monthsToRepay, "Not repaid: exempt");
    const months = view.bands.slice(0, 6).map((one) => parseFloat(one.monthsToRepay));
    assert.ok(months[0] < months[2] && months[2] < months[3] && months[3] < months[5]);
  });

  it("sends private money only to Bands A and B, and DFI money only to C to E", async () => {
    const view = await marketplaceView(createSyntheticMarketplace());
    for (const row of view.matching) {
      if (/private/i.test(row.funder)) assert.match(row.band, /^(A|B)/, row.funder);
      if (row.funder.startsWith("DFI")) assert.match(row.band, /^(C|D|E)$/, row.funder);
    }
    assert.equal(view.demand.length, 11);
  });
});
