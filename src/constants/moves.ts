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

import { demoWorkspaceId, PUBLIC_HOME, railHref, roleHref, takePartHref, TRACK_PATH, workspaceHref } from "./frontDoor.ts";
import { DEMO_WORKSPACE_QUERY, hrefOf, RAILS, WORKSPACE_TYPES, type ViewId } from "./views.ts";

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
const P = "/dashboard/planning";

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
  // Step 3: Plan, Finance, Oversight, the journey, the Metering Plan report and About this build.
  { from: P, view: "plan.overview", below: false, step: 3 },
  { from: `${P}/metering`, view: "finance.metering-fund", below: false, step: 3 },
  { from: `${P}/metering/allocation`, view: "plan.metering-allocation", below: true, step: 3 },
  { from: `${P}/metering/dt`, view: "plan.dt-sequencing", below: true, step: 3 },
  { from: `${P}/metering/marketplace`, view: "finance.marketplace", below: true, step: 3 },
  { from: `${P}/metering/monitoring`, view: "oversight.monitoring", below: true, step: 3 },
  { from: `${P}/metering/journey`, view: "initiative.journey", below: true, step: 3 },
  { from: `${P}/metering/report`, view: "plan.metering-report", below: true, step: 3 },
  { from: `${P}/about-this-build`, view: "platform.about-this-build", below: true, step: 3 },
  { from: `${P}/dt`, view: "plan.dt", below: true, step: 3 },
  { from: `${P}/feeders`, view: "plan.feeders", below: true, step: 3 },
  { from: `${P}/network-expansion`, view: "plan.network-expansion", below: true, step: 3 },
  { from: `${P}/unserved`, view: "plan.unserved", below: true, step: 3 },
  { from: `${P}/underserved`, view: "plan.underserved", below: true, step: 3 },
  { from: `${P}/pue`, view: "plan.pue", below: true, step: 3 },
  { from: `${P}/e-mobility`, view: "plan.charging-hubs", below: true, step: 3 },
  // Step 4: each domain's reports under Reports; People under Account.
  { from: `${U}/reports`, view: "utility.reports", below: true, step: 4 },
  { from: `${M}/reports`, view: "minigrid.reports", below: true, step: 4 },
  { from: "/dashboard/settings/people", view: "platform.people", below: true, step: 4 },
  // Step 6: the old map addresses lead to the Platform Overview, now under Intelligence with its map (they led to /dashboard before).
  { from: "/dashboard/map", view: "platform.overview", below: false, step: 6 },
  { from: "/dashboard/intelligence/gis", view: "platform.overview", below: false, step: 6 },
];

/* ==========================================================
   THE NAV-A PROTOTYPE'S ADDRESSES (NAV-B step 7)

   The public layer left /preview for "/", and the demo workspaces
   are the dashboard itself, named by ?workspace=. These rows lead
   to public pages, not to Views, so each destination is taken from
   the front door's own addresses (frontDoor.ts), never written
   again. A segment written ":name" stands for any one segment and
   is carried to the same name in the destination.
========================================================== */

export type Elsewhere = { from: string; to: string; step: number };

const param = (id: string) => `:${id}`;
export const ELSEWHERE: readonly Elsewhere[] = [
  { from: "/preview", to: PUBLIC_HOME, step: 7 },
  { from: "/preview/track", to: TRACK_PATH, step: 7 },
  // The prototype's initiative page was "Who are you?"; it is now one step under the initiative's own page.
  { from: "/preview/initiatives/:initiative", to: takePartHref(param("initiative")), step: 7 },
  { from: "/preview/initiatives/:initiative/:role", to: roleHref(param("initiative"), param("role")), step: 7 },
  ...WORKSPACE_TYPES.flatMap((type) => {
    const id = demoWorkspaceId(type);
    return [
      { from: `/preview/workspace/${id}`, to: workspaceHref(id), step: 7 },
      ...RAILS[type].filter((entry) => entry.item !== "home").map((entry) => ({ from: `/preview/workspace/${id}/${entry.item}`, to: railHref(id, entry.item), step: 7 })),
      { from: `/preview/workspace/${id}/initiatives/:initiative`, to: `${hrefOf("initiative.home")}/:initiative?${DEMO_WORKSPACE_QUERY}=${type}`, step: 7 },
    ];
  }),
];

/** The parameters of an address matched against a pattern with ":name" segments; null when it does not match. */
function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split("/");
  const have = path.split("/");
  if (want.length !== have.length) return null;
  const found: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) {
      if (have[i] === "") return null;
      found[want[i].slice(1)] = have[i];
    } else if (want[i] !== have[i]) return null;
  }
  return found;
}

/** A query added to an address that may already have one. */
const withQuery = (to: string, query: string | undefined) => (query === undefined ? to : `${to}${to.includes("?") ? "&" : "?"}${query}`);

/** Where an old address now is, the rest of it carried; null when it did not move. */
export function destinationOf(address: string): string | null {
  const mark = address.indexOf("?");
  const path = mark < 0 ? address : address.slice(0, mark);
  const query = mark < 0 ? undefined : address.slice(mark + 1);
  for (const row of [...ELSEWHERE].sort((a, b) => b.from.split("/").length - a.from.split("/").length)) {
    const params = matchPattern(row.from, path);
    if (params !== null) return withQuery(row.to.replace(/:([a-z]+)/g, (_, name: string) => params[name] ?? `:${name}`), query);
  }
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
  return [
    ...[...ELSEWHERE].sort((a, b) => b.from.split("/").length - a.from.split("/").length).map((row) => ({ source: row.from, destination: row.to, permanent: true as const })),
    ...[...MOVES]
      .sort((a, b) => b.from.length - a.from.length)
      .map((move) => (move.below ? { source: `${move.from}/:path*`, destination: `${hrefOf(move.view)}/:path*`, permanent: true as const } : { source: move.from, destination: hrefOf(move.view), permanent: true as const })),
  ];
}
