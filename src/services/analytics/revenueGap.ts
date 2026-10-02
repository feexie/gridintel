import type { Period, ScopeRef } from "@/domain";
import type { GridIntelRepositories } from "../../repositories/ports/index.ts";
import type { CalculationContext, InputValue, RevenueGap, RevenueGapNode } from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { Sourced } from "./sourcing.ts";
import { calculateRevenueGap, feedersOfSubstation, transformersOnFeeder } from "../../analytics/index.ts";
import { fetchBillingTotals } from "./billing.ts";
import { NO_CACHE, resultKey } from "./cache.ts";
import { sectionLosses } from "./losses.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — REVENUE GAP FOR A SCOPE

   Builds the scope's section tree down to its distribution
   transformers, takes each section's unbilled energy from its
   energy account and each transformer's low-voltage billing from
   its billing totals, and has analytics value the gap.

   The rate that values unbilled energy comes only from low-voltage,
   non-maximum-demand accounts: those supplied through a distribution
   transformer and not recorded as MD. A customer supplied directly
   by a feeder at medium voltage never enters a rate, however large
   its bill.
========================================================== */

interface GapParams {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  context: CalculationContext;
  cache?: ServiceCache;
}

export async function scopeRevenueGap(params: GapParams): Promise<Sourced<RevenueGap>> {
  const { repos, scope, period, context, cache } = params;
  return (cache ?? NO_CACHE).get(resultKey("revenue-gap", scope, period, context.computedAt), async () => {
    const { index, snapshot } = await loadTopology(repos.registry, period.end, cache);

    const node = async (section: ScopeRef): Promise<RevenueGapNode> => {
      const { result } = await sectionLosses({ ...params, scope: section });
      const figure = result.account.unbilled;
      const unbilled: InputValue = {
        value: figure.status === "ok" ? figure.value : null,
        unit: "kWh",
        origin: "calculated",
        quality: figure.quality ?? "missing",
        ...(figure.estimatedShare === undefined ? {} : { estimatedShare: figure.estimatedShare }),
        ref: `energy_account.unbilled:${section.kind}:${section.id}`,
      };

      let below: ScopeRef[];
      switch (section.kind) {
        case "distribution_transformer": {
          const ordinary = await fetchBillingTotals({
            repos,
            index,
            snapshot,
            scope: section,
            period,
            trail: new SourceTrail(),
            accounts: "low_voltage_non_md",
          });
          return {
            scope: section,
            unbilled,
            lowVoltage: { energyBilled: ordinary.energyBilled, revenueBilled: ordinary.revenueBilled },
            children: [],
          };
        }
        case "feeder":
          below = transformersOnFeeder(index, section.id).map((dt) => ({ kind: "distribution_transformer", id: dt.id }));
          break;
        case "substation":
          below = feedersOfSubstation(index, section.id).map((feeder) => ({ kind: "feeder", id: feeder.id }));
          break;
        default:
          below = result.sections;
      }
      return { scope: section, unbilled, children: await Promise.all(below.map(node)) };
    };

    const top = await sectionLosses(params);
    return {
      result: calculateRevenueGap({
        period,
        tree: await node(scope),
        revenueBilled: top.result.billing.revenueBilled,
        revenueCollected: top.result.billing.revenueCollected,
        collectionBasis: top.result.billing.collectionBasis,
        context,
      }),
      sourcing: top.sourcing,
    };
  });
}
