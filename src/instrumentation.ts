/* Runs once when the server starts. See src/composition/warm.ts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmResults } = await import("./composition/warm");
  // Not awaited: the server starts taking requests at once, and a request that arrives
  // during the warm-up shares its computation instead of starting another.
  void warmResults();
}
