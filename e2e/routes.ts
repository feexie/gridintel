/* The routes every cross-cutting browser test visits: one of each kind of screen. */

/** The ordinary build: network screens built ahead of time. Playwright's default server. */
export const BUILT_PORT = 3210;
/** The same application built to render every data screen on request (GRIDINTEL_RENDER=request). */
export const REQUEST_PORT = 3212;
export const REQUEST_BASE = `http://localhost:${REQUEST_PORT}`;
/** The environment that selects the request-rendered build, for a server a test starts itself. */
export const REQUEST_ENV = { ...process.env, GRIDINTEL_RENDER: "request" };

export const OPERATIONS = "/dashboard/utility/operations";

export const ROUTES = [
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
];
