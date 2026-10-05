import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { operations } from "./operations.ts";
import { getReadiness, isPreparing } from "./runtime.ts";
import { warmResults } from "./warm.ts";

describe("warm-up and readiness", () => {
  it("is 'warming' while it runs, lets other work in between its steps, and is 'ready' when done", async () => {
    // No warm-up has begun in a process that did not start one: routes calculate as usual.
    assert.equal(getReadiness(), "not_started");
    assert.equal(isPreparing(), false);

    const warming = warmResults();
    // From the first instant, a data route would answer with the preparing page.
    assert.equal(getReadiness(), "warming");
    assert.equal(isPreparing(), true);

    // Work queued on the event loop while the warm-up runs is reached before it finishes:
    // the warm-up does not hold the server for its whole length.
    let turns = 0;
    let duringWarmUp = 0;
    const tick = () => {
      turns += 1;
      if (getReadiness() === "warming") {
        duringWarmUp += 1;
        setImmediate(tick);
      }
    };
    setImmediate(tick);

    await warming;
    assert.equal(getReadiness(), "ready");
    assert.equal(isPreparing(), false);
    // One turn at least for every screen warmed: 48 transformers, 4 feeders, 2 substations and more.
    assert.ok(duringWarmUp > 50, `the event loop was reached ${duringWarmUp} time(s) during the warm-up (${turns} in all)`);

    // What it warmed is served from the cache, and a second warm-up does nothing.
    const before = await operations.feeder("FD-OLD");
    await warmResults();
    assert.equal(getReadiness(), "ready");
    assert.equal(await operations.feeder("FD-OLD"), before);
  });
});
