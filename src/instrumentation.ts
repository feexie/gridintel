/* Runs once when the server starts. See src/composition/warm.ts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // A build prerenders pages from the records themselves; there is nothing to warm, and a
  // page prerendered while "warming" would be the preparing page for ever.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { warmResults } = await import("./composition/warm");
  // Not awaited: the server starts taking requests at once. While the warm-up runs, the data
  // routes answer with a short "preparing data" page instead of waiting for it.
  void warmResults();
}
