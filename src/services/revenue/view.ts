import type { ScopeRef } from "@/domain";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { RevenueGapPartView } from "../operations/views.ts";
import type { CustomerClassRow, FeederRevenueRow, RevenueWorkspaceView, ValuationView } from "./views.ts";
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

   The valuation of the commercial gap has one row for each
   distribution transformer. It is ordered by amount and cut to the
   largest few here, with the whole list one click away, so that the
   screen neither orders nor cuts.
========================================================== */

/** Which sections the valuation lists: the largest few, or every one. */
export type ValuationListing = "top" | "all";

/** How many sections the short valuation listing shows. */
export const VALUATION_LIMIT = 10;

/** The valuation, cut to what is asked for. Sections by amount, largest first; one with no amount is last. */
export function valuationView(parts: readonly RevenueGapPartView[], listing: ValuationListing): ValuationView {
  const every = parts
    .filter((part) => part.kind === "section")
    .sort((a, b) => (b.amount ?? -Infinity) - (a.amount ?? -Infinity) || (a.scope.id < b.scope.id ? -1 : 1));
  const sections = listing === "all" ? every : every.slice(0, VALUATION_LIMIT);
  return {
    sections,
    sectionsTotal: every.length,
    limit: VALUATION_LIMIT,
    complete: sections.length === every.length,
    residuals: parts.filter((part) => part.kind === "residual"),
  };
}

/** The whole view with the valuation uncut: computed once, whichever listing is asked for. */
type Workspace = Omit<RevenueWorkspaceView, "valuation">;

/** Largest shortfall first; classes with no shortfall after them, largest billing first. */
function byShortfall(rows: readonly CustomerClassRow[]): CustomerClassRow[] {
  return [...rows].sort((a, b) => b.notCollected - a.notCollected || b.revenueBilled - a.revenueBilled || (a.category < b.category ? -1 : 1));
}

export async function revenueWorkspaceView(runtime: OperationsRuntime, valuation: ValuationListing = "top"): Promise<RevenueWorkspaceView> {
  const key = `view:revenue-workspace|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  const workspace = await (runtime.cache ?? NO_CACHE).get(key, () => build(runtime));
  return { ...workspace, valuation: valuationView(workspace.gap.parts, valuation) };
}

async function build(runtime: OperationsRuntime): Promise<Workspace> {
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
