import type { Period, ReportedKpi, ScopeRef } from "@/domain";
import type { GridIntelRepositories } from "../../repositories/ports/index.ts";
import type {
  AtccDecomposition,
  AtccResult,
  BillingTotals,
  CalculationContext,
  EnergyAccount,
  InputValue,
  LossSplit,
} from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { Sourced } from "./sourcing.ts";
import {
  aggregateEnergyAccounts,
  atccInputsFromAccount,
  calculateAtcc,
  calculateLossSplit,
  computeEnergyAccount,
  decomposeAtcc,
  metersWithRole,
  sectionBoundary,
  sectionsForScope,
  servicePointsUnder,
  toEpochMs,
} from "../../analytics/index.ts";
import { fetchBillingTotals } from "./billing.ts";
import { NO_CACHE, resultKey } from "./cache.ts";
import { reportedInput } from "./inputs.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — ENERGY ACCOUNT, LOSSES AND ATC&C

   For an electrical section (a distribution transformer, a feeder
   or a substation) and a period:
   - interval energy for the section's boundary meters and for the
     customer meters under it → the energy account;
   - charges and payments of the accounts under it → energy billed,
     revenue billed and revenue collected;
   - the technical loss a loss study reports for exactly this scope
     and period, if there is one. Technical loss is not metered, so
     without a study the technical/commercial split is unavailable
     and only the total loss is given. A study is an estimate: the
     input is tagged "estimated", and the commercial loss derived
     from it is a residual that inherits that uncertainty.

   For an administrative scope (a region, an organization) the
   account is the sum of the accounts of the electrical sections
   that make it up, and the revenue is that of all its accounts.

   Analytics does every calculation; this service only gathers the
   inputs and says where they came from.
========================================================== */

export interface SectionLosses {
  account: EnergyAccount;
  billing: BillingTotals;
  atcc: AtccResult;
  split: LossSplit;
  decomposition: AtccDecomposition;
  /** The electrical sections the account covers: the scope itself, or the sections an administrative scope is cut into. */
  sections: ScopeRef[];
  /** The reported figure used as the technical-loss input of a single section; null when none applied or the account is a sum. */
  technicalLossStudy: ReportedKpi | null;
  /** How the technical-loss input was obtained, or why there is none. */
  technicalLossNote: string | null;
}

interface LossParams {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  context: CalculationContext;
  cache?: ServiceCache;
}

function samePeriod(a: Period | null, b: Period): boolean {
  return a !== null && toEpochMs(a.start) === toEpochMs(b.start) && toEpochMs(a.end) === toEpochMs(b.end);
}

function finish(
  params: LossParams,
  account: EnergyAccount,
  billing: BillingTotals,
  rest: Pick<SectionLosses, "sections" | "technicalLossStudy" | "technicalLossNote">,
): SectionLosses {
  const { scope, period, context } = params;
  const atcc = calculateAtcc({
    scope,
    period,
    inputs: { ...atccInputsFromAccount(account), collectionBasis: billing.collectionBasis },
    context,
  });
  const split = calculateLossSplit({ account, context });
  return { account, billing, atcc, split, decomposition: decomposeAtcc(atcc, split), ...rest };
}

async function sectionAccount(params: LossParams): Promise<Sourced<SectionLosses>> {
  const { repos, scope, period, context } = params;
  const trail = new SourceTrail();
  const { index, snapshot } = await loadTopology(repos.registry, period.end, params.cache);

  const boundary = sectionBoundary(index, scope);
  const customerMeters = (servicePointsUnder(index, scope).value ?? []).flatMap((sp) =>
    metersWithRole(index, "service_point", sp.id).map((meter) => meter.id),
  );
  const boundaryMeters = [...boundary.input, ...boundary.downstream].flatMap((req) => req.meterIds);
  const meterIds = [...new Set([...boundaryMeters, ...customerMeters])];
  const intervals = await repos.observations.listIntervalEnergy({ meterIds, period });
  trail.add(intervals.records);

  const billing = await fetchBillingTotals({ repos, index, snapshot, scope, period, trail });

  const reported = await repos.reported.listReportedKpis({ metrics: ["technical_loss"], scopes: [scope] });
  const studies = reported.records.filter((kpi) => samePeriod(kpi.period, period));
  let technicalLossStudy: ReportedKpi | null = null;
  let technicalLossNote: string | null = null;
  let technicalLoss: InputValue | undefined;
  if (studies.length === 1) {
    // A loss study is an estimate as of its date, not a measurement.
    const conversion = reportedInput(studies[0], "energy", "estimated");
    if (conversion.ok) {
      technicalLossStudy = studies[0];
      technicalLoss = conversion.input;
      trail.add(studies);
    } else {
      technicalLossNote = conversion.reason;
    }
  } else {
    technicalLossNote =
      studies.length === 0
        ? "No technical-loss figure is reported for this scope and period."
        : "More than one technical-loss figure is reported for this scope and period; none was chosen.";
  }

  const account = computeEnergyAccount({
    index,
    scope,
    period,
    intervals: intervals.records,
    inputs: {
      technicalLoss,
      energyBilled: billing.energyBilled,
      revenueBilled: billing.revenueBilled,
      revenueCollected: billing.revenueCollected,
    },
    computedAt: context.computedAt,
  });
  return {
    result: finish(params, account, billing, { sections: [scope], technicalLossStudy, technicalLossNote }),
    sourcing: await trail.resolve(repos.sources),
  };
}

async function aggregatedAccount(params: LossParams): Promise<Sourced<SectionLosses>> {
  const { repos, scope, period, context } = params;
  const trail = new SourceTrail();
  const { index, snapshot } = await loadTopology(repos.registry, period.end, params.cache);

  const cut = sectionsForScope(index, scope);
  const parts = await Promise.all(cut.sections.map((section) => sectionLosses({ ...params, scope: section })));
  for (const part of parts) trail.addSourcing(part.sourcing);

  const billing = await fetchBillingTotals({ repos, index, snapshot, scope, period, trail });
  const account = aggregateEnergyAccounts({
    scope,
    period,
    accounts: parts.map((part) => part.result.account),
    revenueBilled: billing.revenueBilled,
    revenueCollected: billing.revenueCollected,
    warnings: cut.warnings,
    computedAt: context.computedAt,
  });
  // A scope that cannot be cut into sections has no account at all, rather than an empty one.
  const computable = cut.status === "not_computable" ? { ...account, status: "not_computable" as const } : account;
  const names = cut.sections.map((section) => section.id).join(", ");
  return {
    result: finish(params, computable, billing, {
      sections: cut.sections,
      technicalLossStudy: null,
      technicalLossNote:
        cut.sections.length === 0
          ? (cut.warnings.find((warning) => warning.code !== "TOPOLOGY_CURRENT_ONLY")?.message ?? "No electrical section lies inside this scope.")
          : `Sum of the technical-loss figures of ${cut.sections.length} section(s): ${names}. Each is an estimate from a loss study.`,
    }),
    sourcing: await trail.resolve(repos.sources),
  };
}

export function sectionLosses(params: LossParams): Promise<Sourced<SectionLosses>> {
  const { scope, period, context } = params;
  const administrative = scope.kind === "region" || scope.kind === "organization";
  return (params.cache ?? NO_CACHE).get(resultKey("losses", scope, period, context.computedAt), () =>
    administrative ? aggregatedAccount(params) : sectionAccount(params),
  );
}
