import { getRepositories, getClock, getReadiness, setReadiness } from "./runtime.ts";
import { executive } from "./executive.ts";
import { operations } from "./operations.ts";
import { reliability } from "./reliability.ts";
import { revenue } from "./revenue.ts";

/* ==========================================================
   COMPOSITION — WARM-UP

   Computes the network screens once at server start, so the first
   visitor does not wait for them. Service-point screens are left to
   be computed on first visit: there are many and each is quick.

   READINESS. While this runs, the process is "warming" and the data
   routes answer with a short "preparing data" page instead of
   waiting (see `isPreparing`). For that page to be served at all,
   the warm-up must let the server take requests while it works: the
   calculations are synchronous, and a chain of awaits on values that
   are already there never returns to the event loop. So the work is
   done in small steps, lowest level first, and the event loop is
   given a turn between steps. The screens above reuse the blocks
   computed below, so the order costs nothing.

   A failure here is logged and the process is marked "failed": the
   screens then compute on first request, as they would without a
   warm-up.
========================================================== */

/**
 * Lets the server answer whatever arrived while the last step ran. A short pause rather than a
 * single turn of the event loop: answering one request takes several turns, and with one turn
 * between steps a request would wait for as many steps. The pauses add about half a second to
 * the warm-up.
 */
const PAUSE_MS = 10;
const yieldToRequests = () => new Promise<void>((resolve) => setTimeout(resolve, PAUSE_MS));

export async function warmResults(): Promise<void> {
  if (getReadiness() !== "not_started") return;
  setReadiness("warming");
  const started = Date.now();
  try {
    await yieldToRequests();
    const { snapshot } = await getRepositories().registry.getSnapshot({ asOf: getClock().now });
    const steps: (() => Promise<unknown>)[] = [
      ...snapshot.distributionTransformers.map((transformer) => () => operations.transformer(transformer.id)),
      ...snapshot.feeders.map((feeder) => () => operations.feeder(feeder.id)),
      ...snapshot.substations.map((substation) => () => operations.substation(substation.id)),
      ...snapshot.regions.map((region) => () => operations.region(region.id)),
      () => operations.overview(),
      () => executive.view(),
      () => reliability.view(),
      () => revenue.view(),
    ];
    for (const step of steps) {
      await yieldToRequests();
      await step();
    }
    setReadiness("ready");
    console.info(`[gridintel] results warmed in ${Date.now() - started} ms`);
  } catch (error) {
    setReadiness("failed");
    console.warn("[gridintel] warm-up failed; screens will compute on first request", error);
  }
}
