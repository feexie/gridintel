import type { Period, ScopeRef } from "@/domain";

/* ==========================================================
   SERVICES — RESULT CACHE

   A service result depends only on its inputs: the records the
   repositories hold, the scope, the period and the as-of time. For
   as long as the records do not change, the same request gives the
   same result, so it can be computed once and reused.

   Services take an optional cache and never create one. Whoever
   owns the repositories owns the cache, because only they know when
   the records change (see the composition root for the rule).

   WHAT A KEY COVERS. Every key names the service, the scope, the
   period and the as-of time (`resultKey`). Nothing else may change a
   result: services read no clock and no configuration.

   WHEN A CACHE IS VALID. A cache belongs to one set of repositories
   and is valid only while the records behind them do not change. It
   has no expiry and evicts nothing by itself. The owner must discard
   it (`clear`, or a new cache) whenever any record is added,
   corrected or removed. A cache must never be shared between two
   sets of repositories.

   Cached results are shared between callers and must be treated as
   read-only.
========================================================== */

export interface ServiceCache {
  /** The result stored under `key`, computing and storing it on first use. */
  get<T>(key: string, compute: () => Promise<T>): Promise<T>;
}

/** No caching: every request is computed. The default, and what tests use. */
export const NO_CACHE: ServiceCache = { get: (_key, compute) => compute() };

/**
 * A cache that keeps every result until it is discarded as a whole.
 * Concurrent requests for the same key share one computation. A failed
 * computation is not kept.
 */
export function createMemoryCache(): ServiceCache & { clear(): void; size(): number } {
  const entries = new Map<string, Promise<unknown>>();
  return {
    get<T>(key: string, compute: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing !== undefined) return existing as Promise<T>;
      const pending = compute().catch((error: unknown) => {
        entries.delete(key);
        throw error;
      });
      entries.set(key, pending);
      return pending;
    },
    clear: () => entries.clear(),
    size: () => entries.size,
  };
}

/** A key for a result that depends on a scope, a period and the time it is computed as of. */
export function resultKey(name: string, scope: ScopeRef | { kind: string; id: string }, period: Period | null, asOf: string): string {
  return [name, scope.kind, scope.id, period?.start ?? "-", period?.end ?? "-", asOf].join("|");
}
