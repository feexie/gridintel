import type { TerritoryPart } from "@/domain";

/* ==========================================================
   SERVICES — WHO IS LOOKING

   Every spatial service and every map read model is asked on
   behalf of a viewer, and answers only with what that viewer may
   see. The viewer is an argument of the service, never something a
   service looks up: the composition root says who is asking.

   WHAT A VIEWER MAY SEE is one of two things:
   - everything: the viewer of the public demonstration, whose data
     is synthetic and open to anyone;
   - a territory: the entities held by the parts of an organization's
     territory (named areas, a drawn boundary, listed assets with
     what they supply). Anything else does not exist for this viewer:
     it is in no list, no count and no total.

   THERE IS NO THIRD CASE. A viewer with an empty territory sees
   nothing. Nothing is visible by default.

   FILTERING HAPPENS HERE, IN THE SERVICES. A component is handed a
   view model that already holds only what its viewer may see, so a
   component cannot leak what it was never given.

   CACHING. A result computed for one viewer must never be served to
   another, so every cached spatial result is keyed by
   `viewerScopeKey`: the organization and the full territory, written
   out. Two viewers share a cached result only when both are equal.

   Logging in, and where an organization's territory is kept, come
   with the API boundary (Phase 8). Until then the composition root
   supplies the one public viewer.
========================================================== */

export type ViewerAccess = { kind: "everything" } | { kind: "territory"; parts: readonly TerritoryPart[] };

export interface ViewerContext {
  /** Who is asking: an account, or the name of a standing viewer such as the public demonstration. */
  viewerId: string;
  /** The organization the viewer acts for; null for a viewer that belongs to none. */
  organizationId: string | null;
  access: ViewerAccess;
}

/** True when the viewer's results are limited to a territory. */
export function isLimited(viewer: ViewerContext): boolean {
  return viewer.access.kind !== "everything";
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((name) => [name, canonical(record[name])]));
  }
  return value;
}

/**
 * The part of a cache key that stands for what a viewer may see. It is the access written out
 * in full, not a digest of it: two different territories can never share a key.
 */
export function viewerScopeKey(viewer: ViewerContext): string {
  if (viewer.access.kind === "everything") return "viewer:everything";
  return `viewer:${viewer.organizationId ?? "-"}:${JSON.stringify(canonical(viewer.access.parts))}`;
}
