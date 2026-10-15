import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scaleBars } from "./bars.ts";

describe("bar scales", () => {
  it("draws every row on one scale, the longest row full length, parts in the order given", () => {
    const bars = scaleBars([
      { id: "a", parts: [{ key: "x", value: 30 }, { key: "y", value: 10 }] },
      { id: "b", parts: [{ key: "x", value: 10 }, { key: "y", value: 10 }] },
    ]);
    assert.deepEqual(bars, [
      { id: "a", parts: [{ key: "x", fraction: 0.75 }, { key: "y", fraction: 0.25 }], reason: null },
      { id: "b", parts: [{ key: "x", fraction: 0.25 }, { key: "y", fraction: 0.25 }], reason: null },
    ]);
  });

  it("draws nothing for a row with a part that has no value or is below zero, says why, and leaves it out of the scale", () => {
    const bars = scaleBars([
      { id: "missing", parts: [{ key: "x", value: null }, { key: "y", value: 500 }] },
      { id: "negative", parts: [{ key: "x", value: -400 }, { key: "y", value: 900 }] },
      { id: "drawn", parts: [{ key: "x", value: 2 }, { key: "y", value: 2 }] },
    ]);
    assert.equal(bars[0].parts, null);
    assert.match(bars[0].reason ?? "", /no value/);
    assert.equal(bars[1].parts, null);
    assert.match(bars[1].reason ?? "", /below zero/);
    assert.deepEqual(bars[2].parts, [{ key: "x", fraction: 0.5 }, { key: "y", fraction: 0.5 }]);
  });

  it("draws zero-length bars, not a division by zero, when every row is zero", () => {
    assert.deepEqual(scaleBars([{ id: "a", parts: [{ key: "x", value: 0 }] }])[0].parts, [{ key: "x", fraction: 0 }]);
  });
});
