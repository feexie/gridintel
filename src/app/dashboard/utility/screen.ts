import { connection } from "next/server";
import { datasetIsFixed, isPreparing } from "@/composition/runtime";

/* How a data screen is rendered (ADR 0012).

   On a fixed dataset a screen is the same on every request, so it is rendered when the
   application is built, or once on its first visit, and served as a file. There is no warm-up
   and nothing to prepare.

   On any other dataset a screen is rendered on each request, from the result cache. The route
   says so by waiting for the request, and while the server is still computing its screens it
   shows the preparing page instead of holding the request. */

/**
 * The `generateStaticParams` of a route with an identifier in its address. On a fixed dataset
 * it is the list given: those addresses are built ahead of time, and any other is rendered on
 * its first visit and kept. On any other dataset the route must have no such function at all:
 * a route that has one is rendered once and kept, which is wrong for records that can change.
 */
export function aheadOfTime<T>(list: () => Promise<T[]> | T[]): (() => Promise<T[]> | T[]) | undefined {
  return datasetIsFixed() ? list : undefined;
}

/** True when the route must show the preparing page. Every data route asks this first. */
export async function preparing(): Promise<boolean> {
  if (datasetIsFixed()) return false;
  await connection();
  return isPreparing();
}
