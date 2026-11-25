import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { destinationOf, MOVES, moveRedirects } from "./moves.ts";
import { viewAt } from "./views.ts";

/* The table of moved addresses (NAV-B safeguard B): one row per old address, each leading in one
   step to its View's address in the catalogue, the rest of the address and the query carried. */

describe("the addresses NAV-B moved", () => {
  it("claims each old address once", () => {
    const froms = MOVES.map((move) => move.from);
    assert.equal(new Set(froms).size, froms.length);
  });

  it("leads every old address to its own View, which no move redirects again (no chains, no loops)", () => {
    for (const move of MOVES) {
      const to = destinationOf(move.from)!;
      assert.equal(viewAt(to)?.id, move.view, move.from);
      assert.equal(destinationOf(to), null, `${move.from} → ${to} is redirected again`);
      assert.notEqual(to, move.from);
    }
  });

  it("carries the rest of the address and the query, and leaves an address that did not move alone", () => {
    assert.equal(destinationOf("/dashboard/utility/operations/feeders/FD-OLD?present=1&x=2"), "/dashboard/intelligence/utility/operations/feeders/FD-OLD?present=1&x=2");
    assert.equal(destinationOf("/dashboard/minigrid/sites/reference/rmg01"), "/dashboard/intelligence/minigrid/sites/reference/rmg01");
    assert.equal(destinationOf("/dashboard/utility?present=1"), "/dashboard/intelligence/utility?present=1");
    assert.equal(destinationOf("/dashboard/utility/reports/reliability/2026-09"), null, "the reports move in step 4");
    assert.equal(destinationOf("/dashboard/utility-other"), null);
    assert.equal(destinationOf("/dashboard"), null);
  });

  it("gives next.config.ts one permanent (308) redirect per row, most specific first", () => {
    const redirects = moveRedirects();
    assert.equal(redirects.length, MOVES.length);
    assert.ok(redirects.every((one) => one.permanent));
    for (let i = 1; i < redirects.length; i++) assert.ok(redirects[i - 1].source.replace("/:path*", "").length >= redirects[i].source.replace("/:path*", "").length);
  });
});
