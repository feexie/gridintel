/* The routes every cross-cutting browser test visits: one of each kind of screen. */

export const OPERATIONS = "/dashboard/utility/operations";

export const ROUTES = [
  "/dashboard/utility/executive",
  OPERATIONS,
  `${OPERATIONS}/regions/demo-region-northfield`,
  `${OPERATIONS}/substations/SS-RIV`,
  `${OPERATIONS}/feeders/FD-MKT`,
  `${OPERATIONS}/feeders/FD-OLD`,
  `${OPERATIONS}/transformers/DT-OLD-2`,
  `${OPERATIONS}/transformers/DT-OLD-2?rows=all`,
  `${OPERATIONS}/service-points/SP-OLD2-001`,
];
