import type { Period, ScopeRef } from "@/domain";
import type { GridIntelRepositories, NetworkRegistrySnapshot } from "../../repositories/ports/index.ts";
import type { BillingTotals, CalculatedKpi, CalculationContext, TopologyIndex } from "../../analytics/index.ts";
import type { Sourced } from "./sourcing.ts";
import { billingTotals, calculateCollectionEfficiency } from "../../analytics/index.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — BILLING AND COLLECTION FOR A SCOPE

   Fetches the charges and payments of a period and has analytics
   total them for the accounts under a scope. Works for electrical
   and administrative scopes alike.
========================================================== */

/** The one currency the registry's organizations operate in; null when there is none or several. */
export function registryCurrency(snapshot: NetworkRegistrySnapshot): string | null {
  const currencies = new Set(snapshot.organizations.flatMap((organization) => organization.currency ?? []));
  return currencies.size === 1 ? [...currencies][0] : null;
}

export async function fetchBillingTotals(params: {
  repos: GridIntelRepositories;
  index: TopologyIndex;
  snapshot: NetworkRegistrySnapshot;
  scope: ScopeRef;
  period: Period;
  trail: SourceTrail;
}): Promise<BillingTotals> {
  const { repos, index, scope, period } = params;
  const [charges, payments] = await Promise.all([
    repos.billing.listBillingRecords({ period }),
    repos.billing.listPayments({ period }),
  ]);
  params.trail.add(charges.records).add(payments.records);
  const currency = registryCurrency(params.snapshot);
  const totals = billingTotals({
    index,
    scope,
    period,
    recordsAvailable: charges.completeness !== "not_available" && currency !== null,
    billingRecords: charges.records,
    payments: payments.records,
    currency: currency ?? "unknown",
  });
  if (charges.completeness === "partial") {
    totals.warnings.push({
      code: "BILLING_PARTIAL",
      message: "The source holds only some billing records; the totals are a lower bound, not the full figure.",
    });
  }
  return totals;
}

export interface ScopeCollection {
  billing: BillingTotals;
  collectionEfficiency: CalculatedKpi;
}

export async function scopeCollection(params: {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  context: CalculationContext;
}): Promise<Sourced<ScopeCollection>> {
  const { repos, scope, period, context } = params;
  const trail = new SourceTrail();
  const { index, snapshot } = await loadTopology(repos.registry, period.end);
  const billing = await fetchBillingTotals({ repos, index, snapshot, scope, period, trail });
  const collectionEfficiency = calculateCollectionEfficiency({
    scope,
    period,
    revenueBilled: billing.revenueBilled,
    revenueCollected: billing.revenueCollected,
    context,
  });
  return { result: { billing, collectionEfficiency }, sourcing: await trail.resolve(repos.sources) };
}
