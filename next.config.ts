import type { NextConfig } from "next";
import { MOVES, moveRedirects } from "./src/constants/moves.ts";
import { hrefOf, type ViewId } from "./src/constants/views.ts";

/* GRIDINTEL_RENDER=request builds and serves the application with every data screen rendered
   on request (see `datasetIsFixed` in src/composition/runtime.ts). That build goes to a folder
   of its own, so that it and the ordinary build can exist side by side and both be tested. */
const onRequest = process.env.GRIDINTEL_RENDER === "request";
/* A tenant deployment (GRIDINTEL_MODE=tenant, ADR 0020) renders every screen for the person who
   asks, and must never serve a page rendered ahead of time for the public viewer: not a data
   screen, and not a page whose frame was drawn for that viewer. Whether this build was made as a
   tenant deployment is written into it, and composition/mode.ts refuses to start a tenant
   deployment on any other build. */
const tenant = process.env.GRIDINTEL_MODE === "tenant";

/* A longer list used to be asked for with a query string. It is now a path of its own, which
   can be built ahead of time; the old addresses lead to the new ones. The screen's address
   before NAV-B (moves.ts) leads straight there too, in one step. */
const fullList = (view: ViewId, key: string, below = "") => {
  const to = `${hrefOf(view)}${below}`;
  const old = MOVES.find((move) => move.view === view)?.from;
  return [to, ...(old === undefined ? [] : [`${old}${below}`])].map((source) => ({
    source,
    has: [{ type: "query" as const, key, value: "all" }],
    destination: `${to}/all`,
    permanent: false,
  }));
};

const nextConfig: NextConfig = {
  // GRIDINTEL_DIST_DIR is set by scripts/next-as-tenant.mjs, so that the tests' tenant build lies beside the other two.
  distDir: process.env.GRIDINTEL_DIST_DIR ?? (onRequest ? ".next-request" : ".next"),
  env: { GRIDINTEL_BUILT_AS_TENANT: String(tenant) },
  // About this build reads the sprint changelog (src/repositories/sprint/changelog.ts).
  // The reference sites' vendored datasets (src/repositories/reference), read on the server by the
  // Mini-grid screens and by the front door's verification card.
  outputFileTracingIncludes: {
    [hrefOf("platform.about-this-build")]: ["./docs/geh/CHANGELOG-GEH.md"],
    [`${hrefOf("minigrid.overview")}/**`]: ["./src/repositories/reference/*/data/*.csv"],
    "/dashboard/minigrid/**": ["./src/repositories/reference/*/data/*.csv"],
    "/preview/**": ["./src/repositories/reference/*/data/*.csv"],
    "/preview": ["./src/repositories/reference/*/data/*.csv"],
  },
  async redirects() {
    return [
      ...fullList("utility.executive", "feeders"),
      ...fullList("utility.revenue", "valuation"),
      ...fullList("utility.assets", "transformers"),
      ...fullList("utility.operations", "rows", "/transformers/:transformerId"),
      // Every address NAV-B moved answers 308 with its new one (src/constants/moves.ts).
      ...moveRedirects(),
      // The map used to be one screen of the platform. Each sector now has its own GIS Map, and the
      // Platform Overview shows every sector on one small map, so the old addresses lead there.
      { source: "/dashboard/map", destination: "/dashboard", permanent: false },
      { source: "/dashboard/intelligence/gis", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
