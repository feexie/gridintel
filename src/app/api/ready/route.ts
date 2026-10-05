import { getReadiness } from "@/composition/runtime";

/* Whether the server has computed its screens. 200 when it has, or when no warm-up applies;
   503 with Retry-After while it is still warming. It reports a state and nothing else: no
   figure, no record. For a load balancer's health check and for the browser tests. */

export const dynamic = "force-dynamic";

export function GET(): Response {
  const status = getReadiness();
  const warming = status === "warming";
  return Response.json(
    { status },
    { status: warming ? 503 : 200, headers: { "Cache-Control": "no-store", ...(warming ? { "Retry-After": "2" } : {}) } },
  );
}
