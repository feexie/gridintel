import type { AssetRef, IsoTimestamp, Period, ScopeRef } from "@/domain";
import type { Completeness, GridIntelRepositories } from "../../repositories/ports/index.ts";
import type { CalculationContext, ClassifiedAlarm, ConditionRule, DerivedCondition } from "../../analytics/index.ts";
import type { ServiceCache } from "./cache.ts";
import type { LoadedAssetKind } from "./loading.ts";
import type { Sourced } from "./sourcing.ts";
import { classifyAlarms, conditionRules, loadingCondition, placeInScope, placeOfAsset, quietMonitorCondition, sortConditions } from "../../analytics/index.ts";
import { NO_CACHE, resultKey } from "./cache.ts";
import { assetLoading } from "./loading.ts";
import { SourceTrail } from "./sourcing.ts";
import { loadTopology } from "./topology.ts";

/* ==========================================================
   SERVICES — ALARMS AND DERIVED CONDITIONS FOR A SCOPE

   Two results, gathered separately and returned separately:

   - RECORDED: the alarms a source system holds for the assets under
     the scope, standing in or raised during the period, each with
     its state at the as-of time. Observed records. An empty list
     means "none" only when the source's alarm record is complete;
     when the source holds no alarms at all, that is said, and no
     list is implied.

   - DERIVED: the conditions GridIntel calculates from telemetry for
     the same assets: loading above rating at a reading in the
     period, and a monitoring device that has stopped checking in.
     Calculated, each under a named rule.

   Nothing here turns one into the other, or drops one because the
   other exists.

   WHICH SCOPE AN ALARM BELONGS TO. An alarm is under a scope when
   the asset it names sits under that scope in the current topology.
   An alarm on a name that is not matched to the registry belongs to
   no electrical scope; it is returned at organization scope only,
   and counted as unplaced, so it is seen once and never guessed into
   a place.
========================================================== */

export interface ScopeAlarms {
  asOf: IsoTimestamp;
  recorded: {
    /** In list order: active first, then undated, then cleared; most severe first within each. */
    alarms: ClassifiedAlarm[];
    /** Alarms on a subject not matched to the registry. Listed only at organization scope. */
    unplaced: number;
    completeness: Completeness;
  };
  derived: {
    conditions: DerivedCondition[];
    rules: ConditionRule[];
    /** A quiet monitor can be told only from a complete heartbeat record. */
    heartbeatCompleteness: Completeness;
    /** Assets whose loading was looked at, and monitoring devices whose check-ins were. */
    assetsChecked: number;
    devicesChecked: number;
  };
}

interface AlarmParams {
  repos: GridIntelRepositories;
  scope: ScopeRef;
  period: Period;
  asOf: IsoTimestamp;
  context: CalculationContext;
  cache?: ServiceCache;
}

export function scopeAlarms(params: AlarmParams): Promise<Sourced<ScopeAlarms>> {
  const key = `${resultKey("alarms", params.scope, params.period, params.asOf)}|${params.context.computedAt}`;
  return (params.cache ?? NO_CACHE).get(key, () => computeAlarms(params));
}

async function computeAlarms(params: AlarmParams): Promise<Sourced<ScopeAlarms>> {
  const { repos, scope, period, asOf, context, cache } = params;
  const trail = new SourceTrail();
  const { index, snapshot } = await loadTopology(repos.registry, asOf, cache);
  const records = { powerTransformers: snapshot.powerTransformers, edgeDevices: snapshot.edgeDevices };
  const under = (asset: AssetRef): boolean => {
    const place = placeOfAsset(index, records, asset);
    return place !== null && placeInScope(place, scope);
  };

  /* ---- Recorded by a source system ---- */
  const listed = await repos.events.listAlarms({ period });
  let unplaced = 0;
  const inScope = listed.records.filter((alarm) => {
    const subject = alarm.subject;
    if ("id" in subject && placeOfAsset(index, records, subject) !== null) return under(subject);
    unplaced += 1;
    return scope.kind === "organization";
  });
  trail.add(inScope);

  /* ---- Derived from telemetry ---- */
  const assets: { kind: LoadedAssetKind; id: string }[] = [
    ...snapshot.powerTransformers.filter((asset) => asset.lifecycle === "in_service").map((asset) => ({ kind: "power_transformer" as const, id: asset.id })),
    ...snapshot.feeders.filter((asset) => asset.lifecycle === "in_service").map((asset) => ({ kind: "feeder" as const, id: asset.id })),
    ...snapshot.distributionTransformers.filter((asset) => asset.lifecycle === "in_service").map((asset) => ({ kind: "distribution_transformer" as const, id: asset.id })),
  ].filter(under);

  const conditions: DerivedCondition[] = [];
  for (const asset of assets) {
    const loading = await assetLoading({ repos, asset, asOf, window: period, context, cache });
    if (loading.result.loading === null || loading.result.peak === null) continue;
    // Every asset looked at is behind the result, whether or not a condition was found.
    trail.addSourcing(loading.sourcing);
    const condition = loadingCondition({ peak: loading.result.peak, now: loading.result.loading, context });
    if (condition !== null) conditions.push(condition);
  }

  const devices = snapshot.edgeDevices.filter((device) => device.lifecycle === "in_service" && under({ kind: "edge_device", id: device.id }));
  const heartbeats = await allHeartbeats(params);
  if (heartbeats.completeness === "complete") {
    for (const device of devices) {
      const ref: AssetRef = { kind: "edge_device", id: device.id };
      const own = heartbeats.byDevice.get(device.id) ?? [];
      trail.add(own).add([device]);
      const condition = quietMonitorCondition({ device: ref, heartbeats: own, asOf, context });
      if (condition !== null) conditions.push(condition);
    }
  }

  return {
    result: {
      asOf,
      recorded: { alarms: classifyAlarms(inScope, asOf), unplaced, completeness: listed.completeness },
      derived: {
        conditions: sortConditions(conditions),
        rules: Object.values(conditionRules()),
        heartbeatCompleteness: heartbeats.completeness,
        assetsChecked: assets.length,
        devicesChecked: heartbeats.completeness === "complete" ? devices.length : 0,
      },
    },
    sourcing: await trail.resolve(repos.sources),
  };
}

/** Every device's check-ins over the period, fetched once and shared by every scope. */
function allHeartbeats(params: AlarmParams) {
  const { repos, period, asOf, cache } = params;
  return (cache ?? NO_CACHE).get(`heartbeats|${period.start}|${asOf}`, async () => {
    const { snapshot } = await loadTopology(repos.registry, asOf, cache);
    const listed = await repos.observations.listHeartbeats({
      devices: snapshot.edgeDevices.map((device) => ({ kind: "edge_device" as const, id: device.id })),
      from: period.start,
      asOf,
    });
    const byDevice = new Map<string, typeof listed.records>();
    for (const heartbeat of listed.records) {
      const list = byDevice.get(heartbeat.device.id);
      if (list === undefined) byDevice.set(heartbeat.device.id, [heartbeat]);
      else list.push(heartbeat);
    }
    return { byDevice, completeness: listed.completeness };
  });
}
