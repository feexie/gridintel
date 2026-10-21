import { AsyncLocalStorage } from "node:async_hooks";

/* ==========================================================
   COMPOSITION — WHICH DEPLOYMENT THIS IS (Phase 8A, ADR 0020)

   One codebase, two deployments, told apart by GRIDINTEL_MODE:

   - "demo" (the default): the public demonstration. No login; one
     viewer who sees everything; synthetic records only; screens
     built ahead of time (ADR 0012). It holds no secret: it never
     creates a Supabase client, and it refuses to start if the
     secret key is in its environment.
   - "tenant": the pilot. Every screen asks who is signed in; each
     organization reads its own records only; every screen is
     rendered on request. It refuses to serve from a build whose
     screens were rendered ahead of time, since those were rendered
     for the public viewer and would show every organization.

   This module imports nothing heavy, so that the proxy can ask it.
========================================================== */

export type DeploymentMode = "demo" | "tenant";

/** The request header the proxy writes with the address asked for; the data layer checks the grant against it. */
export const PATH_HEADER = "x-gridintel-path";

export function deploymentMode(): DeploymentMode {
  return process.env.GRIDINTEL_MODE === "tenant" ? "tenant" : "demo";
}

/**
 * True when this build was made as a tenant deployment. Written into the build by next.config.ts
 * (`env`), so that a build made for the demonstration, whose pages were rendered for the public
 * viewer, cannot be started as a tenant deployment.
 */
function builtAsTenant(): boolean {
  return process.env.GRIDINTEL_BUILT_AS_TENANT === "true";
}

/** Why this deployment must not serve, or null when it may. Asked at start-up and by the proxy. */
export function unsafeConfiguration(): string | null {
  if (deploymentMode() === "demo") {
    if (process.env.SUPABASE_SECRET_KEY) return "The public demonstration must hold no secret: SUPABASE_SECRET_KEY is set.";
    return null;
  }
  if (!builtAsTenant()) return "A tenant deployment must be built with GRIDINTEL_MODE=tenant, so that no page is rendered ahead of time.";
  if (process.env.GRIDINTEL_AUTH === "memory") {
    if (process.env.VERCEL) return "The in-memory identity adapter is for tests and must not run on Vercel.";
    return null;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return "A tenant deployment needs SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.";
  return null;
}

/* Work the server does for itself, with no request and no viewer: the start-up warm-up, which
   computes each organization's screens into that organization's own cache. Nothing reached
   from a request runs inside it. */
const systemWork = new AsyncLocalStorage<true>();

export function asSystem<T>(work: () => Promise<T>): Promise<T> {
  return systemWork.run(true, work);
}

export function isSystemWork(): boolean {
  return systemWork.getStore() === true;
}
