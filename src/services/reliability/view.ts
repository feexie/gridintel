import type { EntityRef, ScopeRef } from "@/domain";
import type { BreakdownRow } from "../../analytics/index.ts";
import type { Loaded, OperationsRuntime } from "../operations/levels.ts";
import type { BreakdownRowView, FeederReliabilityRow, OriginRowView, ReliabilityWorkspaceView } from "./views.ts";
import { convertUnit, feedersOfSubstation } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { scopeReliability } from "../analytics/reliability.ts";
import { alarmSubject, attributedIndex, loadRegistry, reliabilityBlock, timeZoneOf } from "../operations/levels.ts";
import { sourcingView } from "../operations/metric.ts";

/* ==========================================================
   SERVICES — RELIABILITY WORKSPACE READ MODEL

   "Which feeders fail their customers, why, and is it ours to fix?"

   - WHICH: every feeder, ranked by the SAIDI attributed to the
     distribution network, highest first. Load shedding and loss of
     upstream supply are shown beside it and do not set the rank:
     the rank is about what the network itself did.
   - WHY: the portfolio's interruptions by cause and by the part of
     the system where they began, and the elements they most often
     began at.
   - IS IT OURS: the split by attribution class, each reported figure
     beside the calculation on its own basis, and what a report's
     attribution rule changes, as a finding.

   Everything is the figure the Operations drill-down shows for the
   same scope: the blocks are the same blocks. Nothing is calculated
   here; units are converted through analytics.
========================================================== */

export const CAUSE_LABEL: Record<string, string> = {
  load_shedding: "Load shedding",
  fault: "Fault",
  planned_maintenance: "Planned maintenance",
  upstream_supply: "Loss of upstream supply",
  weather: "Weather",
  vandalism: "Vandalism",
  other: "Other",
  unknown: "Cause not known",
};

const ORIGIN_LABEL: Record<string, string> = {
  grid: "The grid (supply allocated)",
  transmission_station: "Transmission station",
  subtransmission_line: "Sub-transmission line (33 kV)",
  mv_feeder: "Distribution feeder (11 kV)",
  distribution_transformer: "Distribution transformer",
  lv_network: "Low-voltage network",
  not_recorded: "Not recorded",
};

/** Which side of the boundary each origin point is on under the reference methodology, in words. */
const ORIGIN_SIDE: Record<string, string> = {
  grid: "Load management or upstream",
  transmission_station: "Upstream",
  subtransmission_line: "The distribution network",
  mv_feeder: "The distribution network",
  distribution_transformer: "The distribution network",
  lv_network: "The distribution network",
  not_recorded: "Classified from the record's cause",
};

const CLASS_LABEL: Record<string, string> = {
  network: "Network",
  upstream_supply: "Upstream supply",
  load_management: "Load shedding",
  other: "Other",
};

function hours(minutes: number | null, unit: "minutes" | "hours"): number | null {
  return minutes === null ? null : convertUnit(minutes, unit, "hours");
}

function breakdownRows(rows: readonly BreakdownRow[], labels: Record<string, string>, unit: "minutes" | "hours", note?: Record<string, string>): BreakdownRowView[] {
  return rows.map((row) => ({
    key: row.key,
    label: labels[row.key] ?? row.key.replaceAll("_", " "),
    note: note?.[row.key] ?? null,
    saidiHours: hours(row.saidi, unit),
    saifi: row.saifi,
    share: row.shareOfCustomerMinutes,
  }));
}

export async function reliabilityWorkspaceView(runtime: OperationsRuntime): Promise<ReliabilityWorkspaceView> {
  const key = `view:reliability-workspace|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, () => build(runtime));
}

async function build(runtime: OperationsRuntime): Promise<ReliabilityWorkspaceView> {
  const loaded: Loaded = await loadRegistry(runtime);
  const { index, snapshot } = loaded;
  const timeZone = timeZoneOf(snapshot);
  const organization = snapshot.organizations[0];
  const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: snapshot.regions[0]?.id ?? "" };

  const feeders: Omit<FeederReliabilityRow, "rank">[] = [];
  const comparisons: ReliabilityWorkspaceView["comparisons"] = [];
  const ruleFindings: ReliabilityWorkspaceView["ruleFindings"] = [];
  for (const substation of snapshot.substations) {
    const own = await reliabilityBlock(runtime, { kind: "substation", id: substation.id }, timeZone);
    comparisons.push(...own.reported.map((row) => ({ ...row, statedFor: substation.name })));
    for (const feeder of feedersOfSubstation(index, substation.id)) {
      const reliability = await reliabilityBlock(runtime, { kind: "feeder", id: feeder.id }, timeZone);
      const part = (name: "upstream_supply" | "load_management") => reliability.attribution.find((row) => row.key === name)?.saidiHours ?? null;
      feeders.push({
        id: feeder.id,
        name: feeder.name,
        substationName: substation.name,
        customers: reliability.customersServed,
        networkSaidi: attributedIndex(reliability, "network", "saidi"),
        networkSaifi: attributedIndex(reliability, "network", "saifi"),
        upstreamSaidiHours: part("upstream_supply"),
        loadSheddingSaidiHours: part("load_management"),
        totalSaidi: reliability.saidi,
        supply: reliability.supply,
      });
      comparisons.push(...reliability.reported.map((row) => ({ ...row, statedFor: feeder.name })));
      ruleFindings.push(...reliability.ruleFindings);
    }
  }
  // Highest network-attributable SAIDI first; a feeder with no figure last; ties by id.
  feeders.sort((a, b) => (b.networkSaidi.value ?? -1) - (a.networkSaidi.value ?? -1) || (a.id < b.id ? -1 : 1));

  const { result, sourcing } = await scopeReliability({ repos: runtime.repos, scope: portfolio, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
  const unit = result.reliability.saidi.unit as "minutes" | "hours";
  // Where interruptions began, leaving out load shedding: a feeder opened on purpose began nowhere on the network.
  const origins: OriginRowView[] = result.origins
    .filter((origin) => origin.attribution !== "load_management")
    .map((origin) => ({
      subject: originSubject(loaded, origin.origin),
      originPoint: origin.originPoint === null ? ORIGIN_LABEL.not_recorded : ORIGIN_LABEL[origin.originPoint],
      attribution: origin.attribution,
      attributionLabel: CLASS_LABEL[origin.attribution],
      interruptions: origin.interruptions,
      saidiHours: hours(origin.saidi, unit),
    }));

  return {
    organization: organization?.name ?? null,
    period: runtime.period,
    asOf: runtime.now,
    sourcing: sourcingView(sourcing),
    portfolio: await reliabilityBlock(runtime, portfolio, timeZone),
    feeders: feeders.map((feeder, i) => ({ ...feeder, rank: i + 1 })),
    byCause: breakdownRows(result.byCause, CAUSE_LABEL, unit),
    byOriginPoint: breakdownRows(result.byOriginPoint, ORIGIN_LABEL, unit, ORIGIN_SIDE),
    origins,
    originsNote:
      "Interruptions other than load shedding, by the element the outage record names as where they began. A 33 kV line and the transmission station are not registry assets, so they keep the names the outage log gives them.",
    comparisons,
    ruleFindings,
    method: result.reliability.saidi.methodology,
  };
}

/** The element an interruption began at: a registry asset with its screen, or the name the source gave. */
function originSubject(loaded: Loaded, origin: EntityRef) {
  const subject = alarmSubject(loaded, origin);
  return "id" in origin ? subject : { ...subject, kindLabel: "Named in the outage log; not a registry asset" };
}
