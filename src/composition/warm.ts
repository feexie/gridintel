import { getRepositories, getClock } from "./runtime.ts";
import { executive } from "./executive.ts";
import { operations } from "./operations.ts";

/* ==========================================================
   COMPOSITION — WARM-UP

   Computes the network screens once at server start, so the first
   visitor does not wait for them. Service-point screens are left to
   be computed on first visit: there are many and each is quick.

   A failure here is logged and otherwise ignored: the screens then
   compute on first request, as they would without a warm-up.
========================================================== */

export async function warmResults(): Promise<void> {
  const started = Date.now();
  try {
    const { snapshot } = await getRepositories().registry.getSnapshot({ asOf: getClock().now });
    await executive.view();
    await operations.overview();
    for (const region of snapshot.regions) await operations.region(region.id);
    for (const substation of snapshot.substations) await operations.substation(substation.id);
    for (const feeder of snapshot.feeders) await operations.feeder(feeder.id);
    for (const transformer of snapshot.distributionTransformers) await operations.transformer(transformer.id);
    console.info(`[gridintel] results warmed in ${Date.now() - started} ms`);
  } catch (error) {
    console.warn("[gridintel] warm-up failed; screens will compute on first request", error);
  }
}
