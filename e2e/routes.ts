/* The routes every cross-cutting browser test visits: one of each kind of screen. */

/** The ordinary build: network screens built ahead of time. Playwright's default server. */
export const BUILT_PORT = 3210;
/** The same application built to render every data screen on request (GRIDINTEL_RENDER=request). */
export const REQUEST_PORT = 3212;
export const REQUEST_BASE = `http://localhost:${REQUEST_PORT}`;
/** A tenant deployment's build, with the in-memory identity adapter (playwright.tenant.config.ts; ADR 0020). */
export const TENANT_PORT = 3214;
/** The environment that selects the request-rendered build, for a server a test starts itself. */
export const REQUEST_ENV = { ...process.env, GRIDINTEL_RENDER: "request" };

/** Set by `npm run verify:local`: the ordinary build only, with no server started by a test (see scripts/e2e-local.mjs). */
export const LOCAL = process.env.GRIDINTEL_E2E === "local";

export const OPERATIONS = "/dashboard/utility/operations";

export const ROUTES = [
  // The overviews, and each sector's GIS Map.
  "/dashboard",
  "/dashboard/utility",
  "/dashboard/utility/map",
  "/dashboard/minigrid",
  "/dashboard/minigrid/map",
  "/dashboard/utility/executive",
  "/dashboard/utility/reliability",
  "/dashboard/utility/revenue",
  "/dashboard/utility/assets",
  "/dashboard/utility/assets/all",
  "/dashboard/utility/events",
  OPERATIONS,
  `${OPERATIONS}/regions/demo-region-northfield`,
  `${OPERATIONS}/substations/SS-RIV`,
  `${OPERATIONS}/substations/SS-HIL`,
  `${OPERATIONS}/feeders/FD-MKT`,
  `${OPERATIONS}/feeders/FD-OLD`,
  `${OPERATIONS}/feeders/FD-GOV`,
  `${OPERATIONS}/feeders/FD-FRM`,
  `${OPERATIONS}/transformers/DT-OLD-2`,
  `${OPERATIONS}/transformers/DT-OLD-2/all`,
  // One of each kind of customer meter: read by hand, prepaid and not read, and AMI.
  `${OPERATIONS}/service-points/SP-OLD2-001`,
  `${OPERATIONS}/service-points/SP-OLD2-004`,
  `${OPERATIONS}/service-points/SP-MKT2-005`,
  // The Sites workspace and one site.
  "/dashboard/minigrid/sites",
  "/dashboard/minigrid/sites/MG-DRY",
  // The reports: each sector's list, every report, and each built report for its month.
  "/dashboard/utility/reports",
  "/dashboard/minigrid/reports",
  "/dashboard/reports",
  "/dashboard/utility/reports/reliability/2026-09",
  "/dashboard/minigrid/reports/compliance/2026-09",
  "/dashboard/utility/reports/operations/2026-09",
  "/dashboard/utility/reports/daily-brief/2026-09-30",
  "/dashboard/minigrid/reports/site-performance/2026-09",
];
