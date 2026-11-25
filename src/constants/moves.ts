/* ==========================================================
   THE ADDRESSES NAV-B MOVED, AND WHERE EACH NOW IS
   (docs/design/NAV-B-PLAN.md sections 1 and 4b)

   Every row is one old address and the View it was; the new
   address is the View's own, from the catalogue (views.ts), so it
   is never written twice. A View keeps its id, and so who may open
   it, wherever it moves.

   The table is read by next.config.ts, which answers each old
   address with a permanent redirect (308) to its new one, the rest
   of the address and the query carried; by the unit test beside it
   (every route of step 0 has a row or still answers, no chains);
   and by the browser tests that walk every old address.

   Pure data and pure functions: no clock, no I/O.
========================================================== */

import { hrefOf, type ViewId } from "./views.ts";

export type Move = {
  /** The old address. */
  from: string;
  /** The View it was, and is. */
  view: ViewId;
  /** True when the addresses below the old one move with it (a feeder below Operations). */
  below: boolean;
  /** The NAV-B step that moved it. */
  step: number;
};

const U = "/dashboard/utility";
const M = "/dashboard/minigrid";

export const MOVES: readonly Move[] = [
  // Step 2: Intelligence, by domain.
  { from: U, view: "utility.overview", below: false, step: 2 },
  { from: `${U}/map`, view: "utility.map", below: true, step: 2 },
  { from: `${U}/ai`, view: "utility.ai", below: true, step: 2 },
  { from: `${U}/executive`, view: "utility.executive", below: true, step: 2 },
  { from: `${U}/operations`, view: "utility.operations", below: true, step: 2 },
  { from: `${U}/reliability`, view: "utility.reliability", below: true, step: 2 },
  { from: `${U}/revenue`, view: "utility.revenue", below: true, step: 2 },
  { from: `${U}/assets`, view: "utility.assets", below: true, step: 2 },
  { from: `${U}/events`, view: "utility.events", below: true, step: 2 },
  { from: M, view: "minigrid.overview", below: false, step: 2 },
  { from: `${M}/map`, view: "minigrid.map", below: true, step: 2 },
  { from: `${M}/ai`, view: "minigrid.ai", below: true, step: 2 },
  { from: `${M}/sites`, view: "minigrid.sites", below: true, step: 2 },
  { from: "/dashboard/der", view: "der.overview", below: false, step: 2 },
];

/** Where an old address now is, the rest of it carried; null when it did not move. */
export function destinationOf(address: string): string | null {
  const mark = address.indexOf("?");
  const path = mark < 0 ? address : address.slice(0, mark);
  const query = mark < 0 ? undefined : address.slice(mark + 1);
  for (const move of [...MOVES].sort((a, b) => b.from.length - a.from.length)) {
    const to = hrefOf(move.view);
    if (path === move.from) return query === undefined ? to : `${to}?${query}`;
    if (move.below && path.startsWith(`${move.from}/`)) {
      const moved = `${to}${path.slice(move.from.length)}`;
      return query === undefined ? moved : `${moved}?${query}`;
    }
  }
  return null;
}

/** The redirects next.config.ts answers with: one per row, permanent (308), most specific first. */
export function moveRedirects(): { source: string; destination: string; permanent: true }[] {
  return [...MOVES]
    .sort((a, b) => b.from.length - a.from.length)
    .map((move) => (move.below ? { source: `${move.from}/:path*`, destination: `${hrefOf(move.view)}/:path*`, permanent: true as const } : { source: move.from, destination: hrefOf(move.view), permanent: true as const }));
}
