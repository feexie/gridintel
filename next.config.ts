import type { NextConfig } from "next";

/* GRIDINTEL_RENDER=request builds and serves the application with every data screen rendered
   on request (see `datasetIsFixed` in src/composition/runtime.ts). That build goes to a folder
   of its own, so that it and the ordinary build can exist side by side and both be tested. */
const onRequest = process.env.GRIDINTEL_RENDER === "request";

/* A longer list used to be asked for with a query string. It is now a path of its own, which
   can be built ahead of time; the old addresses lead to the new ones. */
const fullList = (source: string, key: string) => ({
  source,
  has: [{ type: "query" as const, key, value: "all" }],
  destination: `${source}/all`,
  permanent: false,
});

const nextConfig: NextConfig = {
  distDir: onRequest ? ".next-request" : ".next",
  async redirects() {
    return [
      fullList("/dashboard/utility/executive", "feeders"),
      fullList("/dashboard/utility/revenue", "valuation"),
      fullList("/dashboard/utility/assets", "transformers"),
      fullList("/dashboard/utility/operations/transformers/:transformerId", "rows"),
      // GIS used to have a placeholder under "Intelligence". It is the Map workspace of the platform now.
      { source: "/dashboard/intelligence/gis", destination: "/dashboard/map", permanent: false },
    ];
  },
};

export default nextConfig;
