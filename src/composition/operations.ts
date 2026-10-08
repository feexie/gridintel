import {
  feederView,
  overviewView,
  regionView,
  servicePointView,
  substationView,
  transformerView,
} from "../services/operations/levels.ts";
import { cachedView, datasetIsFixed, getClock, getRepositories } from "./runtime.ts";

/* ==========================================================
   COMPOSITION — OPERATIONS

   The Operations read models bound to the running adapter, clock
   and result cache. This is what the Operations screens call; they
   never see a repository, a service function or an analytics result.
========================================================== */

export const operations = {
  overview: () => cachedView("operations", (runtime) => overviewView(runtime)),
  region: (id: string) => cachedView(`region:${id}`, (runtime) => regionView(runtime, id)),
  substation: (id: string) => cachedView(`substation:${id}`, (runtime) => substationView(runtime, id)),
  feeder: (id: string) => cachedView(`feeder:${id}`, (runtime) => feederView(runtime, id)),
  transformer: (id: string) => cachedView(`transformer:${id}`, (runtime) => transformerView(runtime, id)),
  servicePoint: (id: string) => cachedView(`service-point:${id}`, (runtime) => servicePointView(runtime, id)),
};

/**
 * The network levels that can be rendered when the application is built: every region,
 * substation, feeder and distribution transformer, when the dataset is fixed; none when it is
 * not, so that nothing is built ahead of records that can change. Service points are never in
 * the list: there are thousands, and each is rendered on its first visit.
 */
export async function buildableLevels(): Promise<{ regions: string[]; substations: string[]; feeders: string[]; transformers: string[] }> {
  if (!datasetIsFixed()) return { regions: [], substations: [], feeders: [], transformers: [] };
  const { snapshot } = await getRepositories().registry.getSnapshot({ asOf: getClock().now });
  const ids = (records: readonly { id: string }[]) => records.map((record) => record.id);
  return { regions: ids(snapshot.regions), substations: ids(snapshot.substations), feeders: ids(snapshot.feeders), transformers: ids(snapshot.distributionTransformers) };
}

export { getDataNotice, isPreparing } from "./runtime.ts";
