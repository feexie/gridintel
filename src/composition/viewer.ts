import type { ViewerContext } from "../services/spatial/viewer.ts";
import { deploymentMode } from "./mode.ts";

/* ==========================================================
   THE VIEWER

   Who a request is answered for. Every spatial service and map read
   model takes the viewer and returns only what that viewer may see
   (services/spatial/viewer.ts).

   The public demonstration has one viewer, synthetic data open to
   anyone, who sees everything. It is the same on every request,
   which is what allows its screens to be built ahead of time
   (ADR 0012), and it is answered without reading the request.

   A tenant deployment (Phase 8A, ADR 0020) reads the request: the
   person signed in, their membership and their organization
   (identity.ts). Its screens are rendered on each request and never
   built ahead of time or kept as a file (ADR 0014), and the
   membership, not a constant, decides which screens open and whose
   records are read (ADR 0018).

   This module loads the identity composition only in a tenant
   deployment, so that the demonstration never loads it.
========================================================== */

const PUBLIC_DEMO_VIEWER: ViewerContext = { viewerId: "public-demo", organizationId: null, access: { kind: "everything" }, screens: { kind: "everything" } };

export async function getViewer(): Promise<ViewerContext> {
  if (deploymentMode() === "demo") return PUBLIC_DEMO_VIEWER;
  const { tenantViewer } = await import("./identity.ts");
  return tenantViewer();
}

/** Who is signed in, for the frame of every screen; null on the public demonstration and for anyone not signed in at aal2. */
export async function getAccount(): Promise<{ email: string; organization: string; administrator: boolean } | null> {
  if (deploymentMode() === "demo") return null;
  const { signedIn } = await import("./identity.ts");
  const who = await signedIn();
  return who === null ? null : { email: who.user.email, organization: who.organization.name, administrator: who.membership.role === "admin" };
}

/** The demonstration's viewer: for what is the same for everyone, such as the outlines of the states. */
export function publicViewer(): ViewerContext {
  return PUBLIC_DEMO_VIEWER;
}
