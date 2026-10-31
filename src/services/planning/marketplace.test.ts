import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSyntheticMarketplace } from "../../repositories/demo/marketplace.ts";
import { nercPublishedFigures } from "../../repositories/published/nerc.ts";
import { marketplaceView } from "./marketplace.ts";

describe("the Metering Marketplace", () => {
  it("states the finding in one line, with how it is calculated, and is marked synthetic", async () => {
    const view = await marketplaceView(createSyntheticMarketplace(), nercPublishedFigures());
    assert.match(view.headline, /^5 funders have pledged ₦[\d.,]+ (million|billion); [\d,]+ approved meters are matched; ₦[\d.,]+( million| billion)? is queued for the next allocation\.$/);
    assert.match(view.headlineHow, /^How this is calculated:/);
    assert.equal(view.sourcing.synthetic, true);
    assert.equal(view.funders.length, 5);
    assert.ok(view.funders[0].pledged.startsWith("1,000 meters"));
    assert.ok(view.funders.some((one) => one.queued.startsWith("Queued for the next allocation")));
    assert.ok(view.totals.every((one) => one.origin === "synthetic"));
  });

  it("charges Bands A and B by the day, Bands C to E 5% of their typical bill with a top-up, and exempts Lifeline", async () => {
    const view = await marketplaceView(createSyntheticMarketplace(), nercPublishedFigures());
    assert.deepEqual(
      view.bands.map((one) => one.perDay),
      ["₦200", "₦250", "₦150", "₦8.58", "₦4.54", "₦2.90", "Exempt"],
    );
    // The same bills as the Metering Fund: Band C ₦5,215 a month, so 5% is ₦261.
    assert.equal(view.bands[3].typicalBill, "₦5,215");
    assert.deepEqual(
      view.bands.slice(3, 6).map((one) => one.shareOfBill),
      ["5.0%", "5.0%", "5.0%"],
    );
    assert.equal(view.bands[3].topUp, "₦75,389");
    assert.equal(view.bands[0].monthsToRepay, "15.0 at cost; 17.7 at 22% (Private capital fund); 18.0 at 24% (Second private fund)");
    assert.match(view.bands[1].monthsToRepay, /Second private fund: over its 24-month tenor/);
    assert.equal(view.bands.at(-1)?.monthsToRepay, "Not repaid: exempt");
  });

  it("sends private money only to Bands A and B, and DFI money only to C to E", async () => {
    const view = await marketplaceView(createSyntheticMarketplace(), nercPublishedFigures());
    for (const row of view.matching) {
      if (/private/i.test(row.funder)) assert.match(row.band, /^(A|B)/, row.funder);
      if (row.funder.startsWith("DFI")) assert.match(row.band, /^(C|D|E)$/, row.funder);
    }
    assert.equal(view.demand.length, 11);
  });
});
