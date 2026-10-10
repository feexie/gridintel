import type { IncidentsView, MapView } from "@/services/spatial/views";
import { Legend, MetricCell, Panel } from "@/components/system/Metric";
import { HeadRow, Note, PageHead, Row, Table, Td, Th } from "@/components/system/Table";
import { NetworkMap } from "@/components/system/map/NetworkMap";
import { formatPeriod, formatTime } from "@/components/system/format";

/* The Map workspace: the spatial view of the energy system the user operates. It belongs to the
   platform, not to one module: it shows whatever layers the modules have registered. */

export function MapWorkspace({ map, incidents }: { map: MapView; incidents: IncidentsView }) {
  const totalled = map.layers.filter((layer) => layer.areaFeatures.some((feature) => feature.metric !== null));
  const real = map.sourcing.sources.filter((source) => source.licence !== undefined);
  return (
    <div className="space-y-4">
      <PageHead eyebrow="Platform" title="Map">
        Where the network is, what is wrong on it now and where the losses are. {formatPeriod(map.period)} · as of {formatTime(map.asOf)}. Every figure comes from the screen that owns it.
      </PageHead>
      <Legend />

      <NetworkMap view={map} incidents={incidents.incidents} />
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
            <span className="text-ink-5">The network: </span>
            {map.sourcing.synthetic ? "synthetic demonstration data. It describes no real asset, and it is in no real place: it is not listed in, or totalled by, any real state or LGA." : "the organization's own records."}
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
