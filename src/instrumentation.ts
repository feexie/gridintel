/* Runs once when the server starts. See src/composition/warm.ts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A build prerenders pages from the records themselves; there is nothing to warm, and a
  // page prerendered while "warming" would be the preparing page for ever.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // A fixed dataset has its network screens built ahead of time: there is nothing to warm, and a
  // screen rendered on request (a service point) computes only what it shows (ADR 0012).
  const { datasetIsFixed } = await import("./composition/runtime");
  if (datasetIsFixed()) return;
  const { warmResults } = await import("./composition/warm");
  // Not awaited: the server starts taking requests at once. While the warm-up runs, the data
  // routes answer with a short "preparing data" page instead of waiting for it.
  void warmResults();
}
