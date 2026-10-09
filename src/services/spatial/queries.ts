import type { AreaKind, Coordinates, LocatedRef } from "@/domain";
import type { Completeness } from "../../repositories/ports/index.ts";
import type { AllocatedTotal } from "../../analytics/index.ts";
import type { Sourcing } from "../analytics/sourcing.ts";
import type { MetricView } from "../operations/views.ts";
import type { ScopedModel } from "./model.ts";
import type { SpatialEntity, SpatialModule, SpatialRegistry, SpatialRuntime } from "./module.ts";
import type { ViewerContext } from "./viewer.ts";
import type { AreaOutlinesView, AreaTotalsView, BehindView, CoverageView, EntityGroupView, EntityView, HereView, IncidentView, IncidentsView, InsideView } from "./views.ts";
import { SPATIAL_REFERENCE, allocateToAreas, distanceToGeometryMetres, geometryTouchesArea, geometryWithinArea, methodologyRef, pointInArea } from "../../analytics/index.ts";
import { NO_CACHE } from "../analytics/cache.ts";
import { SourceTrail } from "../analytics/sourcing.ts";
import { methodView, sourcingView } from "../operations/metric.ts";
import { areaView, areasOfKind, entityView, findArea, relates, scopeModel } from "./model.ts";
import { entityKey } from "./module.ts";
import { viewerScopeKey } from "./viewer.ts";

/* ==========================================================
   SERVICES — SPATIAL QUESTIONS

   Four questions, asked of every registered module at once and
   answered for one viewer:

     whatIsHere     what lies within a distance of a point
     whatIsInside   what lies inside a named area
     whatIsBehind   what supplies an entity, and what it supplies
     totalsByArea   a module's figure, totalled by area

   None of them names a kind of asset. Each starts from the model as
   its viewer may see it (`scopeModel`), so an entity outside the
   viewer's territory is in no list, no count and no total, and
   asking about one by name gives the same answer as asking about
   something that does not exist.

   Each result is cached under the viewer's scope as well as the
   question, the period and the as-of time.
========================================================== */

/** Who is asking what of which modules. */
export interface SpatialContext {
  runtime: SpatialRuntime;
  registry: SpatialRegistry;
  viewer: ViewerContext;
}

/** A group longer than this is counted and not listed, unless its kind is asked for by name. */
export const LIST_LIMIT = 200;
/** The widest search a "what is here" question may make. */
export const MAX_SEARCH_METRES = 50_000;

function cached<T>(context: SpatialContext, question: string, compute: (scoped: ScopedModel) => Promise<T>): Promise<T> {
  const { runtime, registry, viewer } = context;
  const key = `spatial:${question}|${viewerScopeKey(viewer)}|${runtime.period.start}|${runtime.period.end}|${runtime.now}`;
  return (runtime.cache ?? NO_CACHE).get(key, async () => compute(await scopeModel(runtime, registry, viewer)));
}

const RANK: Record<Completeness, number> = { complete: 0, partial: 1, not_available: 2 };

/** The least complete of the lists a result was drawn from. */
function coverageOf(scoped: ScopedModel): CoverageView {
  return scoped.modules.reduce<CoverageView>((worst, held) => (RANK[held.completeness] > RANK[worst] ? held.completeness : worst), "complete");
}

async function sourcingOf(context: SpatialContext, parts: readonly Sourcing[]): Promise<Sourcing> {
  const trail = new SourceTrail();
  for (const part of parts) trail.addSourcing(part);
  return trail.resolve(context.runtime.repos.sources);
}

function located(scoped: ScopedModel, kinds?: readonly string[]): { module: SpatialModule; entity: SpatialEntity }[] {
  const wanted = kinds === undefined ? null : new Set(kinds);
  return scoped.modules.flatMap((held) =>
    held.entities.filter((entity) => entity.location !== null && (wanted === null || wanted.has(entity.ref.kind))).map((entity) => ({ module: held.module, entity })),
  );
}

/** Entities by kind, in the order the kinds first appear; a long group is counted and not listed. */
function groups(entities: readonly { module: SpatialModule; entity: SpatialEntity }[], list: readonly string[] = []): EntityGroupView[] {
  const byKind = new Map<string, { kindLabel: string; views: EntityView[] }>();
  for (const { module: spatialModule, entity } of entities) {
    const group = byKind.get(entity.ref.kind);
    if (group === undefined) byKind.set(entity.ref.kind, { kindLabel: entity.kindLabel, views: [entityView(spatialModule, entity)] });
    else group.views.push(entityView(spatialModule, entity));
  }
  return [...byKind].map(([kind, group]) => ({
    kind,
    kindLabel: group.kindLabel,
    count: group.views.length,
    entities: group.views.length > LIST_LIMIT && !list.includes(kind) ? null : group.views,
  }));
}

/* ---------------- What is here ---------------- */

export function whatIsHere(context: SpatialContext, query: { point: Coordinates; withinMetres: number; kinds?: readonly string[] }): Promise<HereView> {
  const { point, withinMetres } = query;
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
    throw new RangeError("The point is not on the globe.");
  }
  if (!Number.isFinite(withinMetres) || withinMetres <= 0 || withinMetres > MAX_SEARCH_METRES) {
    throw new RangeError(`The distance must be above 0 and at most ${MAX_SEARCH_METRES} m.`);
  }
  const kinds = query.kinds === undefined ? "*" : [...query.kinds].sort().join(",");
  return cached(context, `here|${point.latitude},${point.longitude}|${withinMetres}|${kinds}`, async (scoped) => {
    const near = located(scoped, query.kinds)
      .map((held) => ({ ...held, distanceMetres: distanceToGeometryMetres(point, (held.entity.location as NonNullable<SpatialEntity["location"]>).geometry) }))
      .filter((held) => held.distanceMetres <= withinMetres)
      .sort((a, b) => a.distanceMetres - b.distanceMetres || (entityKey(a.entity.ref) < entityKey(b.entity.ref) ? -1 : 1));
    const areas = scoped.areas.filter((area) => pointInArea(point, area.geometry));
    const modules = new Set(near.map((held) => held.module.id));
    return {
      point: { latitude: point.latitude, longitude: point.longitude },
      withinMetres,
      entities: near.map((held) => ({ ...entityView(held.module, held.entity), distanceMetres: held.distanceMetres })),
      areas: areas.map(areaView),
      coverage: coverageOf(scoped),
      scopeLimited: scoped.limited,
      sourcing: sourcingView(
        await sourcingOf(context, [...scoped.modules.filter((held) => modules.has(held.module.id)).map((held) => held.sourcing), ...(areas.length > 0 ? [scoped.areaSourcing] : [])]),
      ),
    };
  });
}

/* ---------------- What is inside an area ---------------- */

const WITHHELD_FROM_REAL_AREA =
  "The entities held are synthetic demonstration data and this is a real area, so none is listed as inside it. A synthetic network is not in any real place.";
const WITHHELD_FROM_SYNTHETIC_AREA = "This is a synthetic area, drawn for the demonstration, so no entity from real data is listed as inside it.";

/** null when the area is not one the viewer may see, which is also the answer for an area that does not exist. */
export function whatIsInside(context: SpatialContext, areaId: string, options: { kinds?: readonly string[]; list?: readonly string[] } = {}): Promise<InsideView | null> {
  const asked = `${options.kinds === undefined ? "*" : [...options.kinds].sort().join(",")}|${[...(options.list ?? [])].sort().join(",")}`;
  return cached(context, `inside|${areaId}|${asked}`, async (scoped) => {
    const area = await findArea(context.runtime, scoped, areaId);
    if (area === undefined) return null;
    const inside: { module: SpatialModule; entity: SpatialEntity }[] = [];
    const crossing: EntityView[] = [];
    let withheld = false;
    for (const held of located(scoped, options.kinds)) {
      const location = held.entity.location as NonNullable<SpatialEntity["location"]>;
      // A synthetic entity is not listed as inside a real area, wherever its coordinates fall.
      if (!relates(scoped, area, location)) {
        withheld = true;
        continue;
      }
      const geometry = location.geometry;
      if (geometryWithinArea(geometry, area.geometry)) inside.push(held);
      else if (geometryTouchesArea(geometry, area.geometry)) crossing.push(entityView(held.module, held.entity));
    }
    return {
      area: areaView(area),
      inside: groups(inside, options.list),
      crossing,
      withheld: !withheld ? null : scoped.syntheticSources.has(area.provenance.sourceSystem) ? WITHHELD_FROM_SYNTHETIC_AREA : WITHHELD_FROM_REAL_AREA,
      coverage: coverageOf(scoped),
      method: methodView(methodologyRef(SPATIAL_REFERENCE)),
      scopeLimited: scoped.limited,
      sourcing: sourcingView(await sourcingOf(context, [...scoped.modules.map((held) => held.sourcing), scoped.areaSourcing])),
    };
  });
}

/* ---------------- What is behind an entity ---------------- */

/** null when the entity is not one the viewer may see, which is also the answer for one that does not exist. */
export function whatIsBehind(context: SpatialContext, ref: LocatedRef, options: { list?: readonly string[] } = {}): Promise<BehindView | null> {
  return cached(context, `behind|${entityKey(ref)}|${[...(options.list ?? [])].sort().join(",")}`, async (scoped) => {
    const subject = scoped.byKey.get(entityKey(ref));
    if (subject === undefined) return null;
    const trace = await subject.module.trace(context.runtime, ref, scoped.sees);
    if (trace === null) return null;
    // The module names what is connected; only what this viewer sees of it goes any further.
    const seen = (refs: readonly LocatedRef[]) => refs.flatMap((other) => scoped.byKey.get(entityKey(other)) ?? []);
    const location = subject.entity.location;
    return {
      subject: entityView(subject.module, subject.entity),
      upstream: seen(trace.upstream).map((held) => entityView(held.module, held.entity)),
      downstream: groups(seen(trace.downstream), options.list),
      downstreamKnown: trace.downstreamKnown,
      facts: trace.facts,
      // The areas the subject is in; a synthetic subject is in no real area.
      areas: location === null ? [] : scoped.areas.filter((area) => relates(scoped, area, location) && geometryWithinArea(location.geometry, area.geometry)).map(areaView),
      scopeLimited: scoped.limited,
      sourcing: sourcingView(await sourcingOf(context, [scoped.modules.find((held) => held.module.id === subject.module.id)?.sourcing ?? scoped.areaSourcing])),
    };
  });
}

/* ---------------- Totals by area ---------------- */

/** null when no module has registered the measure. */
export function totalsByArea(context: SpatialContext, measureId: string, options: { areaKind?: AreaKind } = {}): Promise<AreaTotalsView | null> {
  const registered = context.registry.measure(measureId);
  if (registered === null) return Promise.resolve(null);
  const { module: spatialModule, measure } = registered;
  return cached(context, `totals|${measureId}|${options.areaKind ?? "*"}`, async (scoped) => {
    const entities = (scoped.modules.find((held) => held.module.id === spatialModule.id)?.entities ?? []).filter((entity) => entity.ref.kind === measure.entityKind);
    const kindLabel = entities[0]?.kindLabel ?? measure.entityKind.replaceAll("_", " ");
    const { result, sourcing } = await measure.contributions(context.runtime, entities);
    const candidates = options.areaKind === undefined ? scoped.areas : (await areasOfKind(context.runtime, scoped, options.areaKind)).records;
    // A synthetic figure is never totalled by a real area, nor a real figure by a synthetic one.
    const areas = candidates.filter((area) => scoped.syntheticSources.has(area.provenance.sourceSystem) === sourcing.synthetic);
    const notTotalled = candidates.length - areas.length;
    // The figure for the whole is everyone's, so a viewer limited to a territory is never given it or what is left of it.
    const whole = scoped.limited || measure.whole === undefined ? undefined : await measure.whole.value(context.runtime);
    const allocation = allocateToAreas({
      areas,
      locations: entities.flatMap((entity) => entity.location ?? []),
      contributions: result.contributions,
      whole,
      context: { computedAt: context.runtime.now },
    });

    const method = methodView(allocation.methodology);
    const metric = (label: string, total: AllocatedTotal, where: string): MetricView => ({
      label,
      value: total.value,
      unit: measure.unit,
      currency: measure.unit === "currency" ? result.currency : null,
      status: total.status,
      origin: "calculated",
      derivation: `Sum of "${measure.label}" at ${total.entities} ${kindLabel.toLowerCase()}(s) ${where}. Each figure is given whole to one area; none is divided.`,
      method,
      inputs: [],
      estimatedInputs: total.estimated > 0 ? [{ name: `${total.estimated} of ${total.entities} figures were calculated with estimates`, share: null }] : [],
      missingInputs: total.missing > 0 ? [`${measure.label} at ${total.missing} of ${total.entities} ${kindLabel.toLowerCase()}(s)`] : [],
      warnings: allocation.warnings.map((warning) => warning.message),
      note: null,
    });

    return {
      measure: { id: measure.id, label: measure.label, module: spatialModule.id, entityKindLabel: kindLabel },
      rows: allocation.totals.map(({ areaId, total }) => {
        const area = areas.find((candidate) => candidate.id === areaId) as (typeof areas)[number];
        return { area: areaView(area), total: metric(measure.label, total, `in ${area.name}`), entities: total.entities };
      }),
      outsideEveryArea: metric(`${measure.label}, outside every area`, allocation.outsideEveryArea, "that lie in none of the areas"),
      notLocated: metric(`${measure.label}, not located`, allocation.notLocated, "that have no location"),
      remainder:
        whole === undefined
          ? null
          : {
              label: `${measure.label}, carried by no ${kindLabel.toLowerCase()}`,
              value: allocation.remainder,
              unit: measure.unit,
              currency: measure.unit === "currency" ? result.currency : null,
              status: allocation.remainder === null ? "insufficient_data" : "ok",
              origin: "derived",
              derivation: `The figure for the whole less the figure of every ${kindLabel.toLowerCase()}.`,
              method,
              inputs: [],
              estimatedInputs: [],
              missingInputs: allocation.remainder === null ? [`${measure.label} for the whole, or at every ${kindLabel.toLowerCase()}`] : [],
              warnings: [],
              note: measure.whole?.remainderNote ?? null,
            },
      remainderNote: whole === undefined ? null : (measure.whole?.remainderNote ?? null),
      definition: measure.definition,
      areaCoverage: scoped.areaCompleteness,
      areasNotTotalled:
        notTotalled === 0
          ? null
          : sourcing.synthetic
            ? `${notTotalled} real area(s) are not totalled: the figures are synthetic demonstration data, and a synthetic figure is never totalled by a real area.`
            : `${notTotalled} synthetic area(s) are not totalled: a real figure is never totalled by a synthetic area.`,
      method,
      scopeLimited: scoped.limited,
      sourcing: sourcingView(await sourcingOf(context, [sourcing, scoped.areaSourcing])),
    };
  });
}

/* ---------------- Area outlines ---------------- */

/**
 * The outlines of every area of one kind the viewer may see, for drawing as orientation, with
 * the credit their licence requires and what must be said about them. Outlines only: no entity
 * and no figure is related to them here.
 */
export function areaOutlines(context: SpatialContext, kind: AreaKind): Promise<AreaOutlinesView> {
  return cached(context, `outlines|${kind}`, async (scoped) => {
    const { records, completeness } = await areasOfKind(context.runtime, scoped, kind);
    const sourcing = await new SourceTrail().add(records).resolve(context.runtime.repos.sources);
    // The parent's name, where the parent is an area this viewer sees.
    const names = new Map(scoped.areas.map((area) => [area.id, area.name]));
    const ring = (points: readonly { latitude: number; longitude: number }[]) => points.map((point) => [point.latitude, point.longitude]);
    return {
      kind,
      areas: records.map((area) => ({
        id: area.id,
        name: area.name,
        parent: area.parentAreaId === undefined ? null : { id: area.parentAreaId, name: names.get(area.parentAreaId) ?? null, basis: area.parentBasis ?? "recorded" },
        polygons: area.geometry.polygons.map((polygon) => [ring(polygon.outer), ...(polygon.holes ?? []).map(ring)]),
      })),
      credits: [...new Set(sourcing.sources.flatMap((source) => source.attribution ?? []))],
      notes: [
        ...new Set(
          sourcing.sources.flatMap((source) => source.notice ?? (source.kind === "synthetic" ? ["Synthetic areas, drawn for the demonstration. They are no administrative boundary."] : [])),
        ),
      ],
      coverage: completeness,
      scopeLimited: scoped.limited,
      sourcing: sourcingView(sourcing),
    };
  });
}

/* ---------------- What is in progress ---------------- */

/**
 * What every module holds as in progress now (an open interruption), each with what is behind
 * the entity it began at. An incident that began at an entity the viewer cannot see is not
 * given at all: its existence would say something about a place that is not the viewer's.
 */
export function incidentsNow(context: SpatialContext): Promise<IncidentsView> {
  return cached(context, "incidents", async (scoped) => {
    const incidents: IncidentView[] = [];
    const used: Sourcing[] = [];
    let coverage: CoverageView = "complete";
    for (const held of scoped.modules) {
      if (held.module.incidents === undefined) continue;
      const { result, sourcing } = await held.module.incidents(context.runtime);
      if (RANK[result.completeness] > RANK[coverage]) coverage = result.completeness;
      for (const incident of result.incidents) {
        if (scoped.limited && (incident.origin === null || !scoped.sees(incident.origin))) continue;
        used.push(sourcing);
        incidents.push({
          id: incident.id,
          module: held.module.id,
          title: incident.title,
          since: incident.since,
          beganAt: incident.beganAt,
          facts: incident.facts,
          behind: incident.origin === null ? null : await whatIsBehind(context, incident.origin),
        });
      }
    }
    return { incidents, coverage, scopeLimited: scoped.limited, sourcing: sourcingView(await sourcingOf(context, used)) };
  });
}
