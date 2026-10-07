import type { ScopeRef } from "@/domain";
import type { Loaded, OperationsRuntime } from "../operations/levels.ts";
import type { AlarmSubjectView, LoadingView, MetricView } from "../operations/views.ts";
import type { AssetAlarmView, AssetClass, AssetClassTable, AssetConditionView, AssetRowView, AssetsWorkspaceView } from "./views.ts";
import { LOADING_REFERENCE, convertUnit, methodologyRef } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { scopeReliability } from "../analytics/reliability.ts";
import { alarmsBlock, loadRegistry, loadingBlock } from "../operations/levels.ts";
import { methodView, registryCount, unavailable } from "../operations/metric.ts";

/* ==========================================================
   SERVICES — ASSETS WORKSPACE READ MODEL

   "Which assets require attention?"

   Every in-service power transformer, feeder and distribution
   transformer, with what the engine already holds about it:

   - its loading: the peak in the period, the loading at the as-of
     time and the readings above rating (calculated);
   - the source alarms standing on it or on its monitor (observed);
   - the conditions derived for it or for its monitor (calculated);
   - the network-attributed interruptions that began at it, from the
     outage log (calculated from observed records).

   An asset is LISTED FOR ATTENTION when at least one of the last
   three is on it. There is no score and no weighting: the list is
   ordered by a fixed rule, stated on the screen, and each fact
   stays in its own column with its own origin.

   Every figure is the one the Operations drill-down shows for the
   same asset: the blocks are the same blocks. Nothing is calculated
   here. What the platform holds no source for (maintenance, age,
   condition assessments) is said outright and not filled in.
========================================================== */

/** Which distribution transformers the loading table lists: the most loaded few, or every one. */
export type TransformerListing = "top" | "all";

/** How many distribution transformers the short listing shows. */
export const TRANSFORMER_LIMIT = 10;

const ATTENTION_RULE =
  "An asset is listed when a source alarm is standing on it or on its monitor at the as-of time, or GridIntel derived a condition for it or its monitor in the " +
  "period, or one or more interruptions attributed to the distribution network began at it in the period. Order: most standing alarms first; then conditions " +
  "that hold at the as-of time; then most readings above rating; then most interruptions begun; then by id. It is an ordering of facts, not a score.";

const CLASS_TITLE: Record<AssetClass, string> = {
  power_transformer: "Power transformers",
  feeder: "Feeders",
  distribution_transformer: "Distribution transformers",
};

const keyOf = (kind: string, id: string) => `${kind}:${id}`;

/** The asset an alarm or condition is about: itself, or the asset its monitor is attached to. */
function assetOf(loaded: Loaded, subject: AlarmSubjectView): { key: string; onMonitor: boolean } | null {
  if (subject.assetKind === "edge_device") {
    const device = loaded.snapshot.edgeDevices.find((candidate) => candidate.id === subject.id);
    return device === undefined ? null : { key: keyOf(device.attachedTo.kind, device.attachedTo.id), onMonitor: true };
  }
  return subject.assetKind === null ? null : { key: keyOf(subject.assetKind, subject.id), onMonitor: false };
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

/** The whole view with the transformer table uncut: computed once, whichever listing is asked for. */
type Workspace = Omit<AssetsWorkspaceView, "classes"> & { classes: AssetClassTable[] };

export async function assetsWorkspaceView(runtime: OperationsRuntime, transformers: TransformerListing = "top"): Promise<AssetsWorkspaceView> {
  const key = `view:assets-workspace|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  const workspace = await (runtime.cache ?? NO_CACHE).get(key, () => build(runtime));
  return {
    ...workspace,
    classes: workspace.classes.map((table) => {
      if (table.assetClass !== "distribution_transformer" || transformers === "all") return table;
      const rows = table.rows.slice(0, TRANSFORMER_LIMIT);
      return { ...table, rows, complete: rows.length === table.total };
    }),
  };
}

async function build(runtime: OperationsRuntime): Promise<Workspace> {
  const loaded = await loadRegistry(runtime);
  const { index, snapshot, coverage } = loaded;
  const organization = snapshot.organizations[0];
  const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: snapshot.regions[0]?.id ?? "" };

  /* ---- What stands on each asset ---- */
  const alarms = await alarmsBlock(runtime, loaded, portfolio);
  const alarmsOn = new Map<string, AssetAlarmView[]>();
  for (const alarm of alarms.recorded.active) {
    const on = assetOf(loaded, alarm.subject);
    if (on !== null) push(alarmsOn, on.key, { id: alarm.id, code: alarm.code, severity: alarm.severity, message: alarm.message, onMonitor: on.onMonitor, raisedAt: alarm.raisedAt });
  }
  const conditionsOn = new Map<string, AssetConditionView[]>();
  for (const condition of alarms.derived.conditions) {
    const on = assetOf(loaded, condition.subject);
    if (on !== null) push(conditionsOn, on.key, { key: condition.key, ruleName: condition.ruleName, onMonitor: on.onMonitor, activeNow: condition.activeNow, sourceAlarm: condition.sourceAlarm.status });
  }

  /* ---- Interruptions that began at each asset, attributed to the network ---- */
  const reliability = await scopeReliability({ repos: runtime.repos, scope: portfolio, period: runtime.period, context: { computedAt: runtime.now }, cache: runtime.cache });
  const outageLog = reliability.result.outageCompleteness;
  const unit = reliability.result.reliability.saidi.unit as "minutes" | "hours";
  const began = new Map<string, { interruptions: number; saidiHours: number | null }>();
  for (const origin of reliability.result.origins) {
    if (origin.attribution !== "network" || !("id" in origin.origin)) continue;
    began.set(keyOf(origin.origin.kind, origin.origin.id), { interruptions: origin.interruptions, saidiHours: origin.saidi === null ? null : convertUnit(origin.saidi, unit, "hours") });
  }

  const noTelemetry = (label: string): MetricView => unavailable(label, "fraction", "The asset is not in the registry as in service, so no loading is calculated for it.");
  const row = async (assetClass: AssetClass, id: string, name: string, link: AssetRowView["link"], place: string, lifecycle: string): Promise<AssetRowView> => {
    const loading: LoadingView | null = await loadingBlock(runtime, { kind: assetClass, id });
    const key = keyOf(assetClass, id);
    const origin = began.get(key);
    return {
      assetClass,
      id,
      name,
      link,
      place,
      ratedKva: loading?.ratedKva ?? null,
      peak: loading?.peak ?? noTelemetry("Peak loading"),
      now: loading?.asOf ?? noTelemetry("Loading now"),
      readingsOverRating: loading?.hoursOverRating ?? null,
      readingsObserved: loading?.hoursObserved ?? null,
      loadingCaveat: loading?.caveat ?? null,
      alarms: alarmsOn.get(key) ?? [],
      conditions: conditionsOn.get(key) ?? [],
      interruptionsBegan: outageLog === "complete" ? (origin?.interruptions ?? 0) : (origin?.interruptions ?? null),
      saidiAddedHours: origin?.saidiHours ?? null,
      lifecycle,
    };
  };

  const inService = <T extends { lifecycle: string }>(records: readonly T[]) => records.filter((record) => record.lifecycle === "in_service");
  const substationName = (id: string) => index.substationById.get(id)?.name ?? id;
  const tables: { assetClass: AssetClass; coverage: AssetClassTable["coverage"]; rows: AssetRowView[] }[] = [
    {
      assetClass: "power_transformer",
      coverage: coverage.powerTransformers,
      rows: await Promise.all(
        inService(snapshot.powerTransformers).map((asset) => row("power_transformer", asset.id, asset.name, { kind: "substation", id: asset.substationId }, substationName(asset.substationId), asset.lifecycle)),
      ),
    },
    {
      assetClass: "feeder",
      coverage: coverage.feeders,
      rows: await Promise.all(inService(snapshot.feeders).map((asset) => row("feeder", asset.id, asset.name, { kind: "feeder", id: asset.id }, substationName(asset.origin.substationId), asset.lifecycle))),
    },
    {
      assetClass: "distribution_transformer",
      coverage: coverage.distributionTransformers,
      rows: await Promise.all(
        inService(snapshot.distributionTransformers).map((asset) => {
          const feeder = index.feederById.get(asset.feederId);
          const place = feeder === undefined ? asset.feederId : `${substationName(feeder.origin.substationId)} · ${feeder.name}`;
          return row("distribution_transformer", asset.id, asset.name, { kind: "distribution_transformer", id: asset.id }, place, asset.lifecycle);
        }),
      ),
    },
  ];

  // Highest peak loading first; an asset with no figure last; ties by id.
  const byPeak = (a: AssetRowView, b: AssetRowView) => (b.peak.value ?? -1) - (a.peak.value ?? -1) || (a.id < b.id ? -1 : 1);
  const classes: AssetClassTable[] = tables.map((table) => ({
    assetClass: table.assetClass,
    title: CLASS_TITLE[table.assetClass],
    coverage: table.coverage,
    rows: [...table.rows].sort(byPeak),
    total: table.rows.length,
    limit: table.assetClass === "distribution_transformer" ? TRANSFORMER_LIMIT : null,
    complete: true,
  }));

  const every = classes.flatMap((table) => table.rows);
  const holding = (asset: AssetRowView) => asset.conditions.filter((condition) => condition.activeNow === true).length;
  const attention = every
    .filter((asset) => asset.alarms.length > 0 || asset.conditions.length > 0 || (asset.interruptionsBegan ?? 0) > 0)
    .sort(
      (a, b) =>
        b.alarms.length - a.alarms.length ||
        holding(b) - holding(a) ||
        (b.readingsOverRating ?? 0) - (a.readingsOverRating ?? 0) ||
        (b.interruptionsBegan ?? 0) - (a.interruptionsBegan ?? 0) ||
        (a.id < b.id ? -1 : 1),
    );

  // Standing alarms that name no listed asset (a substation as a whole, a name not in the registry): on the Events / Alarms screen.
  const listed = new Set(every.map((asset) => keyOf(asset.assetClass, asset.id)));
  const alarmsElsewhere = alarms.recorded.active.filter((alarm) => {
    const on = assetOf(loaded, alarm.subject);
    return on === null || !listed.has(on.key);
  }).length;

  const method = methodView(methodologyRef(LOADING_REFERENCE));
  return {
    organization: organization?.name ?? null,
    period: runtime.period,
    asOf: runtime.now,
    // The alarms block already stands on every asset's loading and on the alarm and heartbeat records.
    sourcing: alarms.sourcing,
    attentionRule: ATTENTION_RULE,
    attention,
    assetsChecked: every.length,
    alarmsElsewhere,
    alarmRecord: alarms.recorded.completeness,
    outageLog,
    classes,
    monitoring: {
      devices: registryCount("Monitoring devices in the registry", coverage.edgeDevices === "complete" ? snapshot.edgeDevices.length : null),
      checked: alarms.derived.devicesChecked,
      note: alarms.derived.note,
    },
    notHeld: [
      { name: "Maintenance records", note: "Not available. No source supplies work orders, inspections or repairs, so none is shown and no asset is called maintained or overdue." },
      {
        name: "Age and condition",
        note: "Not available. The registry holds no commissioning date, test result or condition assessment for transformers or feeders, so no asset is ranked by age or health.",
      },
    ],
    loadingMethod: { id: method.id, version: method.version, name: method.name },
  };
}
