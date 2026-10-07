import type { IsoTimestamp, Period } from "@/domain";
import type { Completeness, GridIntelRepositories } from "../../repositories/ports/index.ts";
import type { OpenExposures } from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { Sourced } from "./sourcing.ts";
import { openExposuresAt } from "../../analytics/index.ts";
import { NO_CACHE } from "./cache.ts";
import { SourceTrail } from "./sourcing.ts";

/* ==========================================================
   SERVICES — INTERRUPTIONS OPEN AT THE AS-OF TIME

   Fetches the outage log of a period and has analytics say which
   exposures had begun and were not restored at the as-of time.

   An empty result means "none" only when the outage log is
   complete; the completeness is returned with it.
========================================================== */

export interface OpenInterruptions extends OpenExposures {
  asOf: IsoTimestamp;
  outageCompleteness: Completeness;
}

interface Params {
  repos: GridIntelRepositories;
  /** Outages overlapping this period are looked at. */
  period: Period;
  asOf: IsoTimestamp;
  cache?: ServiceCache;
}

export function openInterruptions(params: Params): Promise<Sourced<OpenInterruptions>> {
  const key = `open-interruptions|${params.period.start}|${params.period.end}|${params.asOf}`;
  return (params.cache ?? NO_CACHE).get(key, async () => {
    const trail = new SourceTrail();
    const outages = await params.repos.events.listOutages({ period: params.period });
    trail.add(outages.records);
    return {
      result: { ...openExposuresAt(outages.records, params.asOf), asOf: params.asOf, outageCompleteness: outages.completeness },
      sourcing: await trail.resolve(params.repos.sources),
    };
  });
}
