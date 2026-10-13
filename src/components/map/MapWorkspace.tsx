import type { IncidentsView, MapView } from "@/services/spatial/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { MetricCell, Panel } from "@/components/system/Metric";
import { HeadRow, Note, Row, Table, Td, Th } from "@/components/system/Table";
import { NetworkMap } from "@/components/system/map/NetworkMap";
import { formatPeriod, formatTime } from "@/components/system/format";

/* A sector's GIS Map: the spatial view of the part of the energy system that sector operates.
   The map is the platform's one shared component (ADR 0014); this screen gives it one sector's
   layers (ADR 0017) and shows whatever those layers hold. Nothing here is written per sector. */

export function MapWorkspace({ sector, lead, map, incidents, open }: { sector: string; lead: string; map: MapView; incidents: IncidentsView; open: readonly string[] }) {
  const totalled = map.layers.filter((layer) => layer.areaFeatures.some((feature) => feature.metric !== null));
  const real = map.sourcing.sources.filter((source) => source.licence !== undefined);
  return (
    <div className="space-y-4">
      <SectorBand eyebrow={sector} title="GIS Map">
        {lead} Every figure comes from the screen that owns it.
      </SectorBand>

      <NetworkMap view={map} incidents={incidents.incidents} open={open} />
      <KeyFold />
      {incidents.coverage !== "complete" ? <Note tone="caution">The outage log is not complete, so an interruption that is not listed may still be in progress.</Note> : null}

      {totalled.map((layer) => (
        <Panel key={layer.id} title={layer.title} aside="Switch the layer on to see it on the map">
          <Table name={`areas-${layer.id}`}>
            <HeadRow>
              <Th>Area</Th>
              <Th right>Transformers</Th>
              <Th right>Total</Th>
            </HeadRow>
            <tbody>
              {layer.areaFeatures.map((feature) => (
                <Row key={feature.area.id} id={feature.area.id}>
                  <Td>{feature.area.name}</Td>
                  <Td figure>{feature.entities ?? "—"}</Td>
                  <Td right>
                    <MetricCell metric={feature.metric ?? undefined} />
                  </Td>
                </Row>
              ))}
              {/* What belongs to no area is a row of its own, never spread over the areas. */}
              {layer.unallocated.map((metric) => (
                <Row key={metric.label} id={metric.label}>
                  <Td className="text-ink-4">
                    {metric.label}
                    {metric.note ? <span className="block text-caption text-ink-5">{metric.note}</span> : null}
                  </Td>
                  <Td figure>—</Td>
                  <Td right>
                    <MetricCell metric={metric} />
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
          {layer.notes.map((note) => (
            <Note key={note}>{note}</Note>
          ))}
        </Panel>
      ))}

      <Panel title="What is on this map, and where it came from">
        <ul className="space-y-1 text-xs text-ink-3">
          <li>
            <span className="text-ink-5">What is drawn: </span>
            {map.sourcing.synthetic ? "synthetic demonstration data. It describes no real asset, and it is in no real place: it is not listed in, or totalled by, any real state or LGA." : "the organization's own records."} {formatPeriod(map.period)}, as of {formatTime(map.asOf)}.
          </li>
          {real.map((source) => (
            <li key={source.id} data-source={source.id}>
              <span className="text-ink-5">{source.name}: </span>
              real administrative boundaries, for orientation only. {source.licence}. {source.dated}. {source.attribution}. Not survey-grade.
            </li>
          ))}
          <li>
            <span className="text-ink-5">Basemap: </span>
            none. Positions are drawn on a plain ground, with a scale.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
