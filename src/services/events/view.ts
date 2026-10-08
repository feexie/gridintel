import type { AssetRef, EntityRef, ScopeRef } from "@/domain";
import type { OpenOutage } from "../../analytics/index.ts";
import type { Loaded, OperationsRuntime } from "../operations/levels.ts";
import type { AlarmSubjectView, MetricView, SourcingView } from "../operations/views.ts";
import type { EventsWorkspaceView, OpenInterruptionRow, PlaceRow, PlaceView } from "./views.ts";
import { feedersOfSubstation, placeOfAsset } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { openInterruptions } from "../analytics/openInterruptions.ts";
import { activeAccountsUnder, alarmSubject, alarmsBlock, allAlarmsBlock, loadRegistry } from "../operations/levels.ts";
import { registryCount, sourcingView, unavailable } from "../operations/metric.ts";
import { CAUSE_LABEL } from "../reliability/view.ts";

/* ==========================================================
   SERVICES — EVENTS / ALARMS WORKSPACE READ MODEL

   "What is wrong now, where, and who is affected?"

   - WHAT IS WRONG NOW: the source alarms standing at the as-of
     time, the derived conditions that hold at it, and the
     interruptions the outage log says were in progress at it.
     Three lists; nothing is moved between them.
   - WHERE: each entry with the substation and feeder above it, and
     every substation and feeder with how much of each list is under
     it.
   - WHO IS AFFECTED: for an interruption, the customers the outage
     record gives. For an alarm or a condition, the active accounts
     connected behind the asset it names, counted from the registry
     and labelled as that: an alarm does not say that supply was
     lost, so it is never called "customers affected".

   The alarms and conditions are the blocks the Operations drill-down
   shows for the same scope. Nothing is calculated here.
========================================================== */

const ACCOUNTS_LABEL = "Active accounts behind it";

/** The registry record a subject view names, when it names one. */
function refOf(subject: AlarmSubjectView): AssetRef | null {
  return subject.assetKind === null ? null : { kind: subject.assetKind, id: subject.id };
}

function placeView(loaded: Loaded, ref: AssetRef | null): PlaceView {
  if (ref === null) return { path: [] };
  const { index, snapshot } = loaded;
  const place = placeOfAsset(index, { powerTransformers: snapshot.powerTransformers, edgeDevices: snapshot.edgeDevices }, ref);
  const path: PlaceView["path"] = [];
  const substation = place?.substationId ? index.substationById.get(place.substationId) : undefined;
  if (substation) path.push({ kind: "substation", id: substation.id, name: substation.name });
  const feeder = place?.feederId ? index.feederById.get(place.feederId) : undefined;
  if (feeder) path.push({ kind: "feeder", id: feeder.id, name: feeder.name });
  return { path };
}

/** Active accounts connected behind an asset, from the registry. A power transformer's are those of the feeders it carries. */
function accountsBehind(loaded: Loaded, ref: AssetRef | null): MetricView {
  const note = "Accounts connected behind the asset named, from the registry. Not a count of customers without supply.";
  if (ref === null) return unavailable(ACCOUNTS_LABEL, "count", "The subject is not matched to the registry, so what is connected behind it is not known.");
  switch (ref.kind) {
    case "substation":
    case "feeder":
    case "distribution_transformer":
      return registryCount(ACCOUNTS_LABEL, activeAccountsUnder(loaded, ref as ScopeRef), note);
    case "power_transformer": {
      const feeders = loaded.snapshot.feeders.filter((feeder) => feeder.origin.powerTransformerId === ref.id);
      const counts = feeders.map((feeder) => activeAccountsUnder(loaded, { kind: "feeder", id: feeder.id }));
      const known = counts.every((count): count is number => count !== null);
      return registryCount(ACCOUNTS_LABEL, known ? counts.reduce((sum, count) => sum + count, 0) : null, `${note} Those of the ${feeders.length} feeder(s) the transformer carries.`);
    }
    case "edge_device": {
      const device = loaded.snapshot.edgeDevices.find((candidate) => candidate.id === ref.id);
      if (device === undefined || device.attachedTo.kind === "edge_device") return unavailable(ACCOUNTS_LABEL, "count", "The device is not attached to an asset in the registry.");
      const behind = accountsBehind(loaded, device.attachedTo);
      return { ...behind, note: `${note} Those behind the asset the device monitors; a monitor that is not reporting does not interrupt supply.` };
    }
    default:
      return unavailable(ACCOUNTS_LABEL, "count", "Not counted for this kind of asset.");
  }
}

const COUNT_BASIS: Record<OpenOutage["customerCountBasis"], { origin: MetricView["origin"]; words: string }> = {
  recorded: { origin: "measured", words: "Counted for this interruption and written in the outage record." },
  topology_derived: { origin: "calculated", words: "Read from the network model: the accounts connected under the elements still without supply." },
  estimated: { origin: "estimated", words: "A judgement written in the outage record, with no count and no model behind it." },
  mixed: { origin: "calculated", words: "The sum of the counts the outage record gives for the parts still off, which were not all obtained the same way." },
};

function customersMetric(outage: OpenOutage): MetricView {
  const basis = COUNT_BASIS[outage.customerCountBasis];
  return {
    label: "Customers affected",
    value: outage.customersAffected,
    unit: "count",
    currency: null,
    status: outage.customersAffected === null ? "insufficient_data" : "ok",
    origin: basis.origin,
    derivation: basis.words,
    method: null,
    inputs: [],
    estimatedInputs: outage.customerCountBasis === "estimated" && outage.customersAffected !== null ? [{ name: "Customers affected", share: 1 }] : [],
    missingInputs: outage.customersAffected === null ? ["the number of customers affected, which the outage record does not give for every part"] : [],
    warnings: [],
    note: null,
  };
}

const refIfResolved = (ref: EntityRef): AssetRef | null => ("id" in ref ? ref : null);

function interruptionRow(loaded: Loaded, outage: OpenOutage): OpenInterruptionRow {
  // The latest restoration the record gives for the parts listed; null when any of them has none.
  const restored = outage.exposures.map((exposure) => exposure.restoredAt);
  const lastRestored = restored.every((time): time is string => time !== null) ? ([...restored].sort().at(-1) ?? null) : null;
  return {
    outageId: outage.outageId,
    status: outage.status,
    beganAt: alarmSubject(loaded, outage.origin),
    // Where it began; for an origin that is not a registry asset, where its first part is.
    place: placeView(loaded, refIfResolved(outage.origin) ?? refIfResolved(outage.exposures[0].affected)),
    affected: outage.exposures.map((exposure) => alarmSubject(loaded, exposure.affected)),
    cause: CAUSE_LABEL[outage.cause] ?? outage.cause,
    planned: outage.planned,
    interruptedAt: outage.interruptedAt,
    restoredAt: lastRestored,
    customers: customersMetric(outage),
  };
}

/** The sources of two results, as one list. Synthetic as soon as either is. */
function mergeSourcing(a: SourcingView, b: SourcingView): SourcingView {
  const sources = new Map([...a.sources, ...b.sources].map((source) => [source.id, source]));
  return { synthetic: a.synthetic || b.synthetic, sources: [...sources.values()].sort((x, y) => (x.id < y.id ? -1 : 1)) };
}

export async function eventsWorkspaceView(runtime: OperationsRuntime): Promise<EventsWorkspaceView> {
  const key = `view:events-workspace|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, () => build(runtime));
}

async function build(runtime: OperationsRuntime): Promise<EventsWorkspaceView> {
  const loaded = await loadRegistry(runtime);
  const { index, snapshot } = loaded;
  const organization = snapshot.organizations[0];
  const portfolio: ScopeRef = organization ? { kind: "organization", id: organization.id } : { kind: "region", id: snapshot.regions[0]?.id ?? "" };

  const alarms = await allAlarmsBlock(runtime, loaded, portfolio);
  const open = await openInterruptions({ repos: runtime.repos, period: runtime.period, asOf: runtime.now, cache: runtime.cache });
  const records = { powerTransformers: snapshot.powerTransformers, edgeDevices: snapshot.edgeDevices };
  const inProgress = open.result.outages.filter((outage) => outage.state === "in_progress");

  const places: PlaceRow[] = [];
  const placeRow = async (kind: PlaceRow["kind"], id: string, name: string, within: string | null): Promise<PlaceRow> => {
    const scope: ScopeRef = { kind, id };
    const own = await alarmsBlock(runtime, loaded, scope);
    return {
      kind,
      id,
      name,
      within,
      activeAlarms: own.recorded.active.length,
      undatedAlarms: own.recorded.undated.length,
      clearedAlarms: own.recorded.clearedTotal,
      conditions: own.derived.conditions.length,
      conditionsHolding: own.derived.conditions.filter((condition) => condition.activeNow === true).length,
      interruptionsInProgress: inProgress.filter((outage) =>
        outage.exposures.some((exposure) => {
          const ref = refIfResolved(exposure.affected);
          const place = ref === null ? null : placeOfAsset(index, records, ref);
          return place !== null && (kind === "substation" ? place.substationId === id : place.feederId === id);
        }),
      ).length,
      accounts: registryCount("Active accounts", activeAccountsUnder(loaded, scope)),
    };
  };
  for (const substation of snapshot.substations) {
    places.push(await placeRow("substation", substation.id, substation.name, null));
    for (const feeder of feedersOfSubstation(index, substation.id)) places.push(await placeRow("feeder", feeder.id, feeder.name, substation.name));
  }

  const completeness = open.result.outageCompleteness;
  const holding = alarms.derived.conditions.filter((condition) => condition.activeNow === true);
  return {
    organization: organization?.name ?? null,
    period: runtime.period,
    asOf: runtime.now,
    sourcing: mergeSourcing(alarms.sourcing, sourcingView(open.sourcing)),
    now: {
      alarms: alarms.recorded.active.map((alarm) => ({ alarm, place: placeView(loaded, refOf(alarm.subject)), accountsBehind: accountsBehind(loaded, refOf(alarm.subject)) })),
      undatedAlarms: alarms.recorded.undated.length,
      conditions: holding.map((condition) => ({ condition, place: placeView(loaded, refOf(condition.subject)), accountsBehind: accountsBehind(loaded, refOf(condition.subject)) })),
      conditionsNotHolding: alarms.derived.conditions.length - holding.length,
      interruptions: {
        completeness,
        note:
          completeness === "not_available"
            ? "Not available. The source holds no outage log, so no interruption is shown rather than an invented list."
            : completeness === "partial"
              ? "The outage log is partial: an interruption not listed here may still be in progress."
              : null,
        inProgress: inProgress.map((outage) => interruptionRow(loaded, outage)),
        restorationNotRecorded: open.result.outages.filter((outage) => outage.state === "restoration_not_recorded").map((outage) => interruptionRow(loaded, outage)),
        startNotRecorded: open.result.startNotRecorded,
      },
    },
    places,
    alarms,
  };
}
