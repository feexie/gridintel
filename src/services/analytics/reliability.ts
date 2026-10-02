import type { Period, ScopeRef } from "@/domain";
import type { Completeness, GridIntelRepositories } from "../../repositories/ports/index.ts";
import type {
  CalculationContext,
  InputValue,
  ReliabilityResult,
  SupplyHoursResult,
  UnattributableExposure,
  Warning,
} from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { Sourced } from "./sourcing.ts";
import { calculateReliability, calculateSupplyHours, customersServed, outagesForScope } from "../../analytics/index.ts";
import { NO_CACHE, resultKey } from "./cache.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — RELIABILITY INDICES FOR A SCOPE

   Fetches the outages of a period, keeps the exposures that belong
   to the scope, counts the customers served from the registry and
   has analytics calculate SAIDI, SAIFI, CAIDI and ASAI.

   The customer count is used only when the registry holds every
   customer account. With a partial registry the count is not a
   total, so it is passed on as missing and the indices are
   insufficient_data rather than wrong.

   Hours of supply per day are calculated from the same exposures.
   For a feeder they are tested against the minimum of the service
   band recorded on the feeder; other scopes have no band.
========================================================== */

export interface ScopeReliability {
  reliability: ReliabilityResult;
  /** Hours of supply per day, and for a feeder its compliance with its service band. */
  supply: SupplyHoursResult;
  /** Exposures recorded on an element above the scope, or on one that could not be placed. */
  unattributable: UnattributableExposure[];
  /** Whether the outage log is complete; an index from a partial log is a lower bound. */
  outageCompleteness: Completeness;
  warnings: Warning[];
}

interface ReliabilityParams {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  context: CalculationContext;
  cache?: ServiceCache;
}

export function scopeReliability(params: ReliabilityParams): Promise<Sourced<ScopeReliability>> {
  return (params.cache ?? NO_CACHE).get(resultKey("reliability", params.scope, params.period, params.context.computedAt), () =>
    computeReliability(params),
  );
}

async function computeReliability(params: ReliabilityParams): Promise<Sourced<ScopeReliability>> {
  const { repos, scope, period, context } = params;
  const trail = new SourceTrail();
  const { index, snapshot, coverage } = await loadTopology(repos.registry, period.end, params.cache);
  trail.add(snapshot.customers);

  const outages = await repos.events.listOutages({ period });
  const scoped = outagesForScope(index, scope, outages.records);
  trail.add(scoped.outages);

  const served = customersServed(index, scope);
  const warnings: Warning[] = [...scoped.warnings, ...served.warnings];
  let servedInput: InputValue = served.input;
  if (coverage.customers !== "complete") {
    servedInput = { ...served.input, value: null, quality: "missing" };
    warnings.push({
      code: "CUSTOMER_REGISTRY_INCOMPLETE",
      message: "The registry does not hold every customer account, so the number of customers served is not known.",
    });
  }
  if (outages.completeness !== "complete") {
    warnings.push({
      code: "OUTAGE_LOG_INCOMPLETE",
      message: "The outage log is not complete; indices calculated from it are lower bounds.",
    });
  }

  const reliability = calculateReliability({
    scope,
    period,
    outages: scoped.outages,
    customersServed: servedInput,
    context,
  });
  const supply = calculateSupplyHours({
    scope,
    period,
    outages: scoped.outages,
    customersServed: servedInput,
    band: scope.kind === "feeder" ? (index.feederById.get(scope.id)?.serviceBand ?? null) : null,
    context,
  });
  return {
    result: { reliability, supply, unattributable: scoped.unattributable, outageCompleteness: outages.completeness, warnings },
    sourcing: await trail.resolve(repos.sources),
  };
}
