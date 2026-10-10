"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MetricView } from "@/services/operations/views";
import type { AreaOutlinesView, FeatureView, IncidentView, LayerSummaryView, LegendTone, MapLayerView, MapView } from "@/services/spatial/views";
import { OriginTag, StatusBadge } from "@/components/system/Metric";
import { formatMetric, formatTime } from "@/components/system/format";
import { entityHref } from "./links";

/* The shared map of the design system. One component for every module and every screen: a
   module adds layers by registering them with the spatial platform, and this component shows
   whatever layers the read model it is given holds.

   It shows and it remembers what the reader has switched on or selected. It computes no figure
   and decides no class: every number is a MetricView from a service, shown with its status and
   origin, and every colour is the legend class the service gave.

   What must be said on a map is always on screen while it applies: that a route is schematic,
   whose boundaries are drawn and that they are not survey-grade, and the credit their licence
   requires. There is no basemap: the network is drawn on a plain ground. */

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <p className="p-3 text-xs text-ink-4">Drawing the map…</p>,
});

const key = (feature: FeatureView) => `${feature.entity.kind}:${feature.entity.id}`;

const TONE_WORD: Record<LegendTone, string> = { alert: "largest mark", watch: "larger mark", good: "small mark", neutral: "mark", no_data: "smallest, hollow mark" };

function Figure({ metric }: { metric: MetricView }) {
  return (
    <div className="border-b border-line/60 py-1.5 last:border-b-0" data-figure={metric.label}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-caption text-ink-4">{metric.label}</span>
        <span className="whitespace-nowrap font-mono text-sm tabular-nums text-ink">{formatMetric(metric)}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={metric.status} />
        {metric.status === "not_available" ? null : <OriginTag origin={metric.origin} />}
        {metric.method ? <span className="text-micro text-ink-5">{metric.method.name}</span> : null}
      </div>
      {metric.note ? <p className="mt-0.5 text-caption leading-snug text-ink-4">{metric.note}</p> : null}
    </div>
  );
}

function Selected({ features, layers }: { features: { layer: MapLayerView; feature: FeatureView }[]; layers: ReadonlySet<string> }) {
  const { entity } = features[0].feature;
  const own = features.find(({ feature }) => feature.trace !== null || feature.details.length > 0)?.feature;
  const href = entityHref(entity.kind, entity.id);
  // What the layers that are on say about it: the theme it is coloured by, an interruption, an alarm.
  const shown = features.filter(({ layer, feature }) => layers.has(layer.id) && feature.metric !== null);
  return (
    <div data-selected={`${entity.kind}:${entity.id}`}>
      <p className="text-micro font-semibold uppercase tracking-eyebrow text-link/80">
        {entity.kindLabel} · {entity.id}
      </p>
      <p className="text-sm font-semibold text-ink">{entity.name}</p>
      {href ? (
        <Link href={href} className="text-caption text-link hover:text-link-hover hover:underline">
          Open in Operations: every figure with its full source and method ▸
        </Link>
      ) : null}
      {entity.basis === "schematic" ? <p className="mt-1 text-caption text-caution-ink/90">Its route is schematic: straight lines between transformers, not where the line runs.</p> : null}
      {entity.basis === "inherited" ? <p className="mt-1 text-caption text-ink-4">It has no location of its own and is shown at its substation.</p> : null}

      {own?.trace ? (
        <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-y-1 text-caption" data-trace>
          <dt className="text-ink-5">Supplied from</dt>
          <dd className="text-ink-2">
            {own.trace.upstream.length === 0
              ? "Nothing above it is held"
              : own.trace.upstream.map((above, i) => (
                  <span key={`${above.kind}:${above.id}`}>
                    {i > 0 ? <span className="text-ink-5"> ‹ </span> : null}
                    {entityHref(above.kind, above.id) ? (
                      <Link href={entityHref(above.kind, above.id) as string} className="text-link hover:underline">
                        {above.name}
                      </Link>
                    ) : (
                      above.name
                    )}
                  </span>
                ))}
          </dd>
          <dt className="text-ink-5">In</dt>
          <dd className="text-ink-2">{own.trace.areas.length === 0 ? "No single district (it crosses a boundary, or none is held)" : own.trace.areas.map((area) => area.name).join(", ")}</dd>
          <dt className="text-ink-5">Supplies</dt>
          <dd className="text-ink-2">
            {!own.trace.downstreamKnown
              ? "Not recorded in the registry"
              : own.trace.downstream.length === 0
                ? "Nothing further"
                : own.trace.downstream.map((group) => `${group.count} ${group.kindLabel.toLowerCase()}${group.count === 1 ? "" : "s"}`).join(", ")}
          </dd>
        </dl>
      ) : null}

      <div className="mt-2">
        {(own?.trace?.facts ?? []).map((fact) => (
          <Figure key={fact.label} metric={fact} />
        ))}
        {shown
          .filter(({ feature }) => !(own?.details ?? []).some((detail) => detail.label === feature.metric?.label))
          .map(({ layer, feature }) => (
            <Figure key={layer.id} metric={feature.metric as MetricView} />
          ))}
        {(own?.details ?? []).map((detail) => (
          <Figure key={detail.label} metric={detail} />
        ))}
      </div>
    </div>
  );
}

function LayerRow({ layer, held, checked, type, name, onChange }: { layer: LayerSummaryView; held: MapLayerView; checked: boolean; type: "checkbox" | "radio"; name?: string; onChange: () => void }) {
  // A layer whose module has no source connected cannot be switched on; it says so.
  const empty = held.coverage === "not_available";
  return (
    <label className={`flex items-start gap-2 py-0.5 text-xs ${empty ? "text-ink-5" : "text-ink-2"}`} title={layer.description} data-layer={layer.id}>
      <input type={type} name={name} checked={checked} disabled={empty} onChange={onChange} className="mt-0.5 accent-[var(--color-link)]" />
      <span>
        {layer.title}
        {empty ? <span className="block text-caption text-ink-5">{layer.description}</span> : null}
      </span>
    </label>
  );
}

export function NetworkMap({
  view,
  incidents = [],
  compact = false,
  select,
}: {
  view: MapView;
  /** What is in progress, each with what is behind it; choosing one marks it on the map. */
  incidents?: IncidentView[];
  /** A smaller map for inside another screen. */
  compact?: boolean;
  /** The entity selected when the map opens, as "<kind>:<id>". */
  select?: string;
}) {
  const themes = view.layers.filter((layer) => layer.exclusiveGroup !== null);
  const [on, setOn] = useState<ReadonlySet<string>>(
    // A map inside another screen was given exactly the layers that screen is about: all of them are on.
    () => new Set(view.layers.filter((layer) => (compact || layer.onByDefault) && layer.exclusiveGroup === null).map((layer) => layer.id)),
  );
  const [theme, setTheme] = useState<string | null>(() => themes.find((layer) => layer.onByDefault)?.id ?? null);
  const [selected, setSelected] = useState<string | null>(select ?? null);
  const [incident, setIncident] = useState<string | null>(null);
  const [outlines, setOutlines] = useState<Record<string, AreaOutlinesView | undefined>>({});
  const [failed, setFailed] = useState<string | null>(null);

  const shown = useMemo(() => new Set([...on, ...(theme === null ? [] : [theme])]), [on, theme]);
  const layersOn = view.layers.filter((layer) => shown.has(layer.id));

  // Outlines that are fetched on request: asked for once, when their layer is first on.
  const wanted = layersOn.flatMap((layer) => (layer.outlinesOnRequest === null ? [] : [layer.outlinesOnRequest])).join(",");
  useEffect(() => {
    let current = true;
    for (const kind of wanted === "" ? [] : wanted.split(",")) {
      if (outlines[kind] !== undefined) continue;
      fetch(`/api/areas/${kind}`)
        .then((response) => (response.ok ? (response.json() as Promise<AreaOutlinesView>) : Promise.reject(new Error(String(response.status)))))
        .then((loaded) => {
          if (current) setOutlines((held) => ({ ...held, [kind]: loaded }));
        })
        .catch(() => {
          if (current) setFailed(kind);
        });
    }
    return () => {
      current = false;
    };
    // `outlines` is left out on purpose: a kind already held is skipped, and adding one must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  const toggle = (id: string) =>
    setOn((held) => {
      const next = new Set(held);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = incidents.find((one) => one.id === incident);
  const highlighted = useMemo(() => {
    const behind = chosen?.behind;
    if (!behind) return new Set<string>();
    return new Set([`${behind.subject.kind}:${behind.subject.id}`, ...behind.downstream.flatMap((group) => (group.entities ?? []).map((entity) => `${entity.kind}:${entity.id}`))]);
  }, [chosen]);

  const selectedFeatures = selected === null ? [] : view.layers.flatMap((layer) => layer.features.filter((feature) => key(feature) === selected).map((feature) => ({ layer, feature })));
  // What can be selected by name: the assets of the layers that give key figures.
  const selectable = view.layers.filter((layer) => layer.features.some((feature) => feature.trace !== null)).flatMap((layer) => layer.features);
  const notes = [...new Set(layersOn.flatMap((layer) => layer.notes))];
  const credits = [...new Set(layersOn.flatMap((layer) => layer.credits))];
  const legends = layersOn.filter((layer) => layer.legend.length > 0);

  return (
    <div className={`grid gap-3 ${compact ? "" : "xl:grid-cols-[minmax(0,1fr)_21rem]"}`} data-map>
      <div className="min-w-0 space-y-2">
        <div className={`relative border border-line bg-well ${compact ? "h-72" : "h-[62vh] max-h-[46rem] min-h-80"}`}>
          <MapCanvas view={view} on={shown} selected={selected} highlighted={highlighted} outlines={outlines} onSelect={setSelected} />
          {/* On the map itself, so that they are in any picture taken of it. */}
          <div className="pointer-events-none absolute bottom-1 right-1 z-[500] max-w-[75%] space-y-0.5 text-right text-micro leading-tight text-ink-3" data-map-credits>
            {credits.map((credit) => (
              <p key={credit} className="bg-app/85 px-1">
                {credit}
              </p>
            ))}
            <p className="bg-app/85 px-1 text-ink-5">No basemap: positions on a plain ground</p>
          </div>
        </div>

        <ul className="space-y-0.5 text-caption leading-snug text-ink-4" data-map-notes>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {view.scopeLimited ? <li>Limited to your organization&apos;s territory. Nothing outside it is shown or counted.</li> : null}
          {failed ? <li className="text-alert">The {failed === "lga" ? "LGA" : failed} boundaries could not be loaded. Nothing is drawn for them.</li> : null}
        </ul>
      </div>

      <div className={`min-w-0 space-y-3 ${compact ? "grid gap-3 space-y-0 md:grid-cols-2" : ""}`}>
        <section className="border border-line bg-panel p-3" aria-label="Selected asset">
          <label className="block text-caption text-ink-5">
            Select an asset
            <select
              value={selected ?? ""}
              onChange={(event) => setSelected(event.target.value === "" ? null : event.target.value)}
              className="mt-0.5 block w-full border border-line-strong bg-app px-1.5 py-1 text-xs text-ink"
              data-select-asset
            >
              <option value="">Click the map, or choose here</option>
              {selectable.map((feature) => (
                <option key={key(feature)} value={key(feature)}>
                  {feature.entity.id} · {feature.entity.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2">
            {selectedFeatures.length > 0 ? <Selected features={selectedFeatures} layers={shown} /> : <p className="text-caption text-ink-4">Nothing is selected. An asset&apos;s key figures appear here, each with its status and origin.</p>}
          </div>
        </section>

        <div className="space-y-3">
          {incidents.length > 0 ? (
            <section className="border border-line bg-panel p-3" aria-label="In progress now">
              <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">In progress now ({incidents.length})</h3>
              {incidents.map((one) => (
                <div key={one.id} data-incident={one.id} className="text-xs">
                  <label className="flex items-start gap-2 text-ink-2">
                    <input type="checkbox" checked={incident === one.id} onChange={() => setIncident(incident === one.id ? null : one.id)} className="mt-0.5 accent-[var(--color-link)]" />
                    <span>
                      {one.title}, since {formatTime(one.since)}. Began at {one.beganAt}. <span className="text-ink-5">Mark what is behind it.</span>
                    </span>
                  </label>
                  {one.behind ? (
                    <p className="mt-1 text-caption text-ink-4">
                      Behind it: {one.behind.downstream.map((group) => `${group.count} ${group.kindLabel.toLowerCase()}s`).join(", ")}.
                    </p>
                  ) : null}
                  {[...one.facts, ...(one.behind?.facts ?? [])].map((fact) => (
                    <Figure key={fact.label} metric={fact} />
                  ))}
                </div>
              ))}
            </section>
          ) : null}

          <section className="border border-line bg-panel p-3" aria-label="Layers">
            <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">Layers</h3>
            {view.modules.map((spatialModule) => {
              const held = spatialModule.layers.flatMap((layer) => view.layers.find((candidate) => candidate.id === layer.id) ?? []);
              if (held.length === 0) return null;
              return (
                <fieldset key={spatialModule.id} className="mb-2 last:mb-0">
                  <legend className="text-micro uppercase tracking-wide text-ink-5">{spatialModule.title}</legend>
                  {held
                    .filter((layer) => layer.exclusiveGroup === null)
                    .map((layer) => (
                      <LayerRow key={layer.id} layer={layer} held={layer} checked={on.has(layer.id)} type="checkbox" onChange={() => toggle(layer.id)} />
                    ))}
                  {held.some((layer) => layer.exclusiveGroup !== null) ? (
                    <div className="mt-1 border-t border-line/60 pt-1">
                      <p className="text-caption text-ink-5">Colour by, one at a time</p>
                      {held
                        .filter((layer) => layer.exclusiveGroup !== null)
                        .map((layer) => (
                          <LayerRow key={layer.id} layer={layer} held={layer} checked={theme === layer.id} type="radio" name={`theme-${spatialModule.id}`} onChange={() => setTheme(layer.id)} />
                        ))}
                      <label className="flex items-start gap-2 py-0.5 text-xs text-ink-2">
                        <input type="radio" name={`theme-${spatialModule.id}`} checked={theme === null} onChange={() => setTheme(null)} className="mt-0.5 accent-[var(--color-link)]" />
                        No colouring
                      </label>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}
          </section>

          {legends.length > 0 ? (
            <section className="border border-line bg-panel p-3" aria-label="Legend" data-legend>
              {legends.map((layer) => (
                <div key={layer.id} className="mb-2 last:mb-0">
                  <h3 className="mb-1 text-caption uppercase tracking-wide text-ink-4">{layer.title}</h3>
                  <ul className="space-y-0.5">
                    {layer.legend.map((entry) => (
                      <li key={entry.key} className="flex items-center gap-2 text-xs text-ink-2">
                        <span aria-hidden className={`gi-swatch gi-swatch-${entry.tone} ${layer.shape === "area" ? "gi-swatch-area" : ""}`} />
                        <span>
                          {entry.label} <span className="text-ink-5">({TONE_WORD[entry.tone]})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
