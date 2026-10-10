"use client";

import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { CircleMarker, MapContainer, Marker, Pane, Polygon, Polyline, ScaleControl, Tooltip } from "react-leaflet";
import { divIcon } from "leaflet";
import type { AreaOutlinesView, FeatureView, GeometryView, LegendTone, MapLayerView, MapView } from "@/services/spatial/views";

/* The drawing surface of the shared map: Leaflet, with no basemap. It draws what it is given
   and decides nothing: which layers are on, which class a feature is in and what is selected
   all arrive as props. Colours come from the design tokens through the classes in globals.css,
   never from values written here.

   Loaded in the browser only (Leaflet needs a window); see NetworkMap. */

const key = (feature: FeatureView) => `${feature.entity.kind}:${feature.entity.id}`;
const at = (point: { latitude: number; longitude: number }): LatLngExpression => [point.latitude, point.longitude];

/** Sizes are part of the meaning, so that a class is never told by colour alone. */
const RADIUS: Record<LegendTone, number> = { alert: 8, watch: 6.5, good: 5, neutral: 5, no_data: 4 };
const KIND_RADIUS: Record<string, number> = { substation: 9, distribution_transformer: 5, service_point: 2.5 };

/** Nigeria, for a map with nothing of its own to fit to. */
const FALLBACK: LatLngBoundsExpression = [
  [4.2, 2.6],
  [13.9, 14.7],
];

export interface MapCanvasProps {
  view: MapView;
  /** The ids of the layers switched on. */
  on: ReadonlySet<string>;
  selected: string | null;
  /** Entities to mark as part of what is being looked at, e.g. what is behind an interruption. */
  highlighted: ReadonlySet<string>;
  /** Area outlines fetched for the layers that ask for them, by kind of area. */
  outlines: Readonly<Record<string, AreaOutlinesView | undefined>>;
  onSelect: (entity: string) => void;
}

/** An icon with nothing in it: the label it carries is all that shows. */
const NO_ICON = divIcon({ className: "", iconSize: [0, 0] });

/** The word on a route, at its far end, where no transformer's mark is beneath it. */
function SchematicLabel({ path, label }: { path: { latitude: number; longitude: number }[]; label: string }) {
  return (
    <Marker position={at(path[path.length - 1])} icon={NO_ICON} interactive={false} keyboard={false}>
      <Tooltip permanent direction="right" offset={[10, 0]} className="gi-label">
        {label}
      </Tooltip>
    </Marker>
  );
}

function Shape({
  feature,
  pane,
  className,
  radius,
  interactive,
  label,
  onSelect,
}: {
  feature: FeatureView;
  pane: string;
  className: string;
  radius: number;
  interactive: boolean;
  /** A label kept on the map, e.g. that a route is schematic. */
  label?: string;
  onSelect: (entity: string) => void;
}) {
  const geometry = feature.entity.geometry as GeometryView;
  const handlers = interactive ? { click: () => onSelect(key(feature)) } : {};
  const tip = interactive ? (
    <Tooltip sticky className="gi-tip">
      {feature.entity.name}
      {label ? ` · ${label} route` : ""}
    </Tooltip>
  ) : null;
  if (geometry.type === "point") {
    return (
      <CircleMarker center={at(geometry.point)} radius={radius} pane={pane} interactive={interactive} className={className} eventHandlers={handlers}>
        {tip}
      </CircleMarker>
    );
  }
  if (geometry.type === "line") {
    return (
      <Polyline positions={geometry.path.map(at)} pane={pane} interactive={interactive} className={className} eventHandlers={handlers}>
        {tip}
        {/* Said on the route itself, so that it is in any picture of the map. */}
        {label ? <SchematicLabel path={geometry.path} label={label} /> : null}
      </Polyline>
    );
  }
  return null;
}

export default function MapCanvas({ view, on, selected, highlighted, outlines, onSelect }: MapCanvasProps) {
  const layers = view.layers.filter((layer) => on.has(layer.id));
  const bounds: LatLngBoundsExpression = view.bounds
    ? [
        [view.bounds.south, view.bounds.west],
        [view.bounds.north, view.bounds.east],
      ]
    : FALLBACK;
  const themed = new Set(layers.filter((layer) => layer.exclusiveGroup !== null).flatMap((layer) => layer.features.map(key)));
  const tone = (layer: MapLayerView, classKey: string | null): LegendTone => layer.legend.find((entry) => entry.key === classKey)?.tone ?? "neutral";
  const state = (feature: FeatureView) => `${selected === key(feature) ? " gi-selected" : ""}${highlighted.has(key(feature)) ? " gi-highlighted" : ""}`;

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [28, 28] }} zoomSnap={0.25} attributionControl={false} scrollWheelZoom className="gi-map h-full w-full">
      <ScaleControl imperial={false} />

      {/* Areas: a module's totals by area, then outlines for orientation. Never above an asset. */}
      <Pane name="gi-areas" style={{ zIndex: 310 }}>
        {layers.flatMap((layer) =>
          layer.areaFeatures.map((feature) =>
            feature.area.geometry.type !== "area" ? null : (
              <Polygon
                key={`${layer.id}:${feature.area.id}:${feature.classKey}`}
                positions={feature.area.geometry.polygons.map((polygon) => [polygon.outer.map(at), ...polygon.holes.map((hole) => hole.map(at))])}
                pane="gi-areas"
                className={`gi-area gi-tone-${tone(layer, feature.classKey)}`}
              >
                <Tooltip sticky className="gi-tip">
                  {feature.area.name}
                </Tooltip>
              </Polygon>
            ),
          ),
        )}
      </Pane>
      <Pane name="gi-outlines" style={{ zIndex: 320 }}>
        {layers.flatMap((layer) =>
          layer.outlinesOnRequest === null
            ? []
            : (outlines[layer.outlinesOnRequest]?.areas ?? []).map((area) => (
                <Polygon
                  key={`${layer.id}:${area.id}`}
                  positions={area.polygons as LatLngExpression[][][]}
                  pane="gi-outlines"
                  className={`gi-outline gi-outline-${layer.outlinesOnRequest}`}
                >
                  <Tooltip sticky className="gi-tip">
                    {area.name}
                    {area.parent?.name ? `, ${area.parent.name}` : ""}
                  </Tooltip>
                </Polygon>
              )),
        )}
      </Pane>

      <Pane name="gi-lines" style={{ zIndex: 330 }}>
        {layers
          .filter((layer) => layer.exclusiveGroup === null && !layer.legend.length)
          .flatMap((layer) =>
            layer.features
              .filter((feature) => feature.entity.geometry?.type === "line")
              .map((feature) => (
                <Shape
                  key={`${layer.id}:${key(feature)}:${state(feature)}`}
                  feature={feature}
                  pane="gi-lines"
                  className={`gi-line${feature.entity.basis === "schematic" ? " gi-schematic" : ""}${state(feature)}`}
                  radius={0}
                  interactive
                  label={feature.entity.basis === "schematic" ? "schematic" : undefined}
                  onSelect={onSelect}
                />
              )),
          )}
      </Pane>

      <Pane name="gi-points" style={{ zIndex: 340 }}>
        {/* The network's own points; a transformer coloured by a theme is drawn by the theme instead. */}
        {layers
          .filter((layer) => layer.exclusiveGroup === null && !layer.legend.length)
          .flatMap((layer) =>
            layer.features
              .filter((feature) => feature.entity.geometry?.type === "point" && !themed.has(key(feature)))
              .map((feature) => (
                <Shape
                  key={`${layer.id}:${key(feature)}:${state(feature)}`}
                  feature={feature}
                  pane="gi-points"
                  className={`gi-point gi-kind-${feature.entity.kind}${state(feature)}`}
                  radius={KIND_RADIUS[feature.entity.kind] ?? 5}
                  interactive
                  onSelect={onSelect}
                />
              )),
          )}
        {layers
          .filter((layer) => layer.exclusiveGroup !== null)
          .flatMap((layer) =>
            layer.features.map((feature) => (
              <Shape
                key={`${layer.id}:${key(feature)}:${state(feature)}`}
                feature={feature}
                pane="gi-points"
                className={`gi-point gi-tone-${tone(layer, feature.classKey)}${state(feature)}`}
                radius={RADIUS[tone(layer, feature.classKey)]}
                interactive
                onSelect={onSelect}
              />
            )),
          )}
      </Pane>

      {/* Overlays mark what they concern with a ring or a second line; the asset beneath stays the thing that is selected. */}
      <Pane name="gi-marks" style={{ zIndex: 350, pointerEvents: "none" }}>
        {layers
          .filter((layer) => layer.exclusiveGroup === null && layer.legend.length > 0 && layer.areaFeatures.length === 0)
          .flatMap((layer) =>
            layer.features.map((feature) => (
              <Shape
                key={`${layer.id}:${key(feature)}`}
                feature={feature}
                pane="gi-marks"
                className={`gi-mark gi-tone-${tone(layer, feature.classKey)}`}
                radius={(KIND_RADIUS[feature.entity.kind] ?? 5) + (tone(layer, feature.classKey) === "alert" ? 5 : 8)}
                interactive={false}
                onSelect={onSelect}
              />
            )),
          )}
      </Pane>
    </MapContainer>
  );
}
