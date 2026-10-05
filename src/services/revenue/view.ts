import type { ScopeRef } from "@/domain";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { CustomerClassRow, FeederRevenueRow, RevenueWorkspaceView } from "./views.ts";
import { feedersOfSubstation } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { loadRegistry, lossesBlock, revenueGapBlock } from "../operations/levels.ts";

/* ==========================================================
   SERVICES — REVENUE WORKSPACE READ MODEL

   "Where is revenue not realised, who is not paying, and is the
   loss commercial or collection?"

   - WHERE: the portfolio's revenue gap and each feeder's.
   - WHO: billing and collection by customer class, with government
     (MDA) accounts as their own class, and each class's share of
     what was left uncollected.
   - WHICH LOSS: for each feeder, commercial loss beside collection
     loss, as shares of energy input and in money.

   Every figure is the one the Operations drill-down shows for the
   same scope: the blocks are the same blocks. Nothing is calculated
   here. A customer class is ordered by its shortfall, which
   analytics computes; a class that paid more than it was billed is
   last and is never set against the others.
========================================================== */

/** Largest shortfall first; classes with no shortfall after them, largest billing first. */
function byShortfall(rows: readonly CustomerClassRow[]): CustomerClassRow[] {
  return [...rows].sort((a, b) => b.notCollected - a.notCollected || b.revenueBilled - a.revenueBilled || (a.category < b.category ? -1 : 1));
}

export async function revenueWorkspaceView(runtime: OperationsRuntime): Promise<RevenueWorkspaceView> {
  const key = `view:revenue-workspace|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, () => build(runtime));
}

async function build(runtime: OperationsRuntime): Promise<RevenueWorkspaceView> {
  const loaded = await loadRegistry(runtime);
  const { index, snapshot } = loaded;
  const organization = snapshot.organizations[0];
  const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: snapshot.regions[0]?.id ?? "" };

  const feeders: FeederRevenueRow[] = [];
  for (const substation of snapshot.substations) {
    for (const feeder of feedersOfSubstation(index, substation.id)) {
      const scope: ScopeRef = { kind: "feeder", id: feeder.id };
      const losses = await lossesBlock(runtime, scope);
      const gap = await revenueGapBlock(runtime, loaded, scope);
      feeders.push({
        id: feeder.id,
        name: feeder.name,
        band: feeder.serviceBand ?? null,
        losses,
        commercialGap: gap.commercial,
        collectionGap: gap.collection,
        notRealised: gap.notRealised,
        byCustomerClass: byShortfall(losses.byCustomerClass),
      });
    }
  }

  const losses = await lossesBlock(runtime, portfolio);
  return {
    organization: organization?.name ?? null,
    period: runtime.period,
    asOf: runtime.now,
    sourcing: losses.sourcing,
    gap: await revenueGapBlock(runtime, loaded, portfolio),
    gapByFeeder: feeders.map((feeder) => ({ kind: "feeder", id: feeder.id, name: feeder.name, commercial: feeder.commercialGap, collection: feeder.collectionGap, notRealised: feeder.notRealised })),
    revenueBilled: losses.revenueBilled,
    revenueCollected: losses.revenueCollected,
    collectionEfficiency: losses.collectionEfficiency,
    collectionBasis: losses.collectionBasis,
    byCustomerClass: byShortfall(losses.byCustomerClass),
    feeders,
  };
}
