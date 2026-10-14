import type { ViewerContext } from "../services/spatial/viewer.ts";

/* ==========================================================
   THE VIEWER

   Who a request is answered for. Every spatial service and map read
   model takes the viewer and returns only what that viewer may see
   (services/spatial/viewer.ts).

   Today there is one viewer: the public demonstration, which is
   synthetic data open to anyone and sees everything. It is the same
   on every request, which is what allows its screens to be built
   ahead of time (ADR 0012).

   When people log in (Phase 8) this function reads the request, and
   two things follow, by ADR 0014: a screen for a real tenant is
   rendered on each request and is never built ahead of time or kept
   as a file; and the organization's territory, not this constant,
   decides what is seen, and the viewer's grant, not this constant,
   decides which screens open (ADR 0018).

   This module imports nothing but a type, so that the proxy, which
   runs before every dashboard request, can ask who is looking
   without loading the dataset.
========================================================== */

const PUBLIC_DEMO_VIEWER: ViewerContext = { viewerId: "public-demo", organizationId: null, access: { kind: "everything" }, screens: { kind: "everything" } };

export function getViewer(): ViewerContext {
  return PUBLIC_DEMO_VIEWER;
}
