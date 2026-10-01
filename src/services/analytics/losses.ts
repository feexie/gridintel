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
import type { Sourced } from "./sourcing.ts";
import {
  atccInputsFromAccount,
  calculateAtcc,
  calculateLossSplit,
  computeEnergyAccount,
  decomposeAtcc,
  metersWithRole,
  sectionBoundary,
  servicePointsUnder,
  toEpochMs,
} from "../../analytics/index.ts";
import { fetchBillingTotals } from "./billing.ts";
import { reportedInput } from "./inputs.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — ENERGY ACCOUNT, LOSSES AND ATC&C FOR A SECTION

   For a distribution transformer, a feeder or a substation, and a
   period:
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

   Analytics does every calculation; this service only gathers the
   inputs and says where they came from.
========================================================== */

export interface SectionLosses {
  account: EnergyAccount;
  billing: BillingTotals;
  atcc: AtccResult;
  split: LossSplit;
  decomposition: AtccDecomposition;
  /** The reported figure used as the technical-loss input; null when none applied. */
  technicalLossStudy: ReportedKpi | null;
  /** Why no technical-loss figure was used, when none was. */
  technicalLossNote: string | null;
}

function samePeriod(a: Period | null, b: Period): boolean {
  return a !== null && toEpochMs(a.start) === toEpochMs(b.start) && toEpochMs(a.end) === toEpochMs(b.end);
}

export async function sectionLosses(params: {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  context: CalculationContext;
}): Promise<Sourced<SectionLosses>> {
  const { repos, scope, period, context } = params;
  const trail = new SourceTrail();
  const { index, snapshot } = await loadTopology(repos.registry, period.end);

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
  const atcc = calculateAtcc({ scope, period, inputs: atccInputsFromAccount(account), context });
  const split = calculateLossSplit({ account, context });

  return {
    result: {
      account,
      billing,
      atcc,
      split,
      decomposition: decomposeAtcc(atcc, split),
      technicalLossStudy,
      technicalLossNote,
    },
    sourcing: await trail.resolve(repos.sources),
  };
}
