import Link from "next/link";
import type { ReferenceAttributionView, ReferenceClaimView, ReferenceSitesView, ReferenceSiteView, ReferenceStanding } from "@/services/minigrid/referenceViews";
import { SectorBand } from "@/components/system/Brand";
import { Fold } from "@/components/system/Fold";
import { Panel } from "@/components/system/Metric";
import { HeadRow, Note, Row, Table, Td, Th } from "@/components/system/Table";
import { hrefOf } from "@/constants/views";

/* Reference sites: real mini-grids whose records their owners published (Phase MG-REAL).
   Shown beside the operator's sites, never among them, and always with the dataset's credit,
   which its licence requires wherever the data is shown. Presentation only: every figure
   arrives formatted from the service. */

const STANDING_TEXT: Record<ReferenceStanding, string> = { agrees: "agrees", differs: "differs", not_calculable: "not calculable" };
const STANDING_TONE: Record<ReferenceStanding, string> = { agrees: "text-ok", differs: "font-semibold text-caution", not_calculable: "text-ink-4" };

function Standing({ standing }: { standing: ReferenceStanding | null }) {
  if (standing === null) return <span className="text-ink-5">—</span>;
  return (
    <span className={STANDING_TONE[standing]} data-standing={standing}>
      {STANDING_TEXT[standing]}
    </span>
  );
}

/** A mark: published data, real, not synthetic and not part of this portfolio. */
export function PublishedMark() {
  return (
    <span className="inline-flex rounded-[3px] border border-line-strong px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-3" data-published-mark>
      Published data
    </span>
  );
}

/** The credit the dataset's licence requires, wherever its data is shown. */
export function ReferenceAttribution({ attribution }: { attribution: ReferenceAttributionView }) {
  return (
    <p className="text-caption leading-snug text-ink-4" data-reference-attribution>
      Data:{" "}
      <a href={attribution.url} className="text-link hover:text-link-hover hover:underline" rel="noreferrer">
        {attribution.citation}
      </a>
      . Licence:{" "}
      <a href={attribution.licenceUrl} className="text-link hover:text-link-hover hover:underline" rel="license noreferrer" data-licence-link>
        {attribution.licence}
      </a>
      . {attribution.changes}
    </p>
  );
}

function ClaimTable({ rows, name }: { rows: ReferenceClaimView[]; name: string }) {
  return (
    <Table name={name} wide>
      <HeadRow>
        <Th>Figure</Th>
        <Th right>As published</Th>
        <Th right>Calculated</Th>
        <Th>Against each other</Th>
      </HeadRow>
      <tbody>
        {rows.map((row) => (
          <Row key={row.label} id={row.label}>
            <Td>
              {row.label}
              <p className="mt-0.5 text-micro leading-snug text-ink-5">{row.basis}</p>
            </Td>
            <Td figure>{row.stated}</Td>
            <Td figure>{row.calculated ?? "—"}</Td>
            <Td>
              <Standing standing={row.standing} />
            </Td>
          </Row>
        ))}
      </tbody>
    </Table>
  );
}

/** The reference sites, below the operator's own on the Sites screen. */
export function ReferenceSites({ view }: { view: ReferenceSitesView }) {
  if (view.sites.length === 0) return null;
  return (
    <Panel title={view.heading} aside={<PublishedMark />}>
      <div data-reference-sites>
        <Note>{view.note}</Note>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {view.sites.map((site) => (
            <section key={site.id} className="min-w-0 rounded-panel border border-line bg-panel" data-reference-site={site.id}>
              <header className="border-b border-line px-3 py-2">
                <h3 className="text-sm font-semibold text-ink">
                  <Link href={site.href} className="text-link hover:text-link-hover hover:underline">
                    {site.name}
                  </Link>
                </h3>
                <p className="text-caption text-ink-4">{site.region}</p>
                <p className="text-caption text-ink-4">{site.plant}</p>
              </header>
              <dl className="space-y-1.5 px-3 py-2 text-xs">
                <div>
                  <dt className="text-ink-3">{site.meterGap.label}</dt>
                  <dd className="text-ink-2">
                    <span className="font-mono tabular-nums text-ink">{site.meterGap.stated}</span> as published; calculated{" "}
                    <span className="font-mono tabular-nums text-ink">{site.meterGap.calculated ?? "—"}</span> (<Standing standing={site.meterGap.standing} />)
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-3">{site.creditBuyers.label}</dt>
                  <dd className="font-mono tabular-nums text-ink">{site.creditBuyers.value}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-3">{site.tariff.label}</dt>
                  <dd className="font-mono tabular-nums text-ink">{site.tariff.value}</dd>
                </div>
              </dl>
              <div className="px-3 pb-2">
                <ReferenceAttribution attribution={site.attribution} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** One reference site in full. */
export function ReferenceSite({ view }: { view: ReferenceSiteView }) {
  return (
    <div className="space-y-4" data-reference-page={view.id}>
      <SectorBand eyebrow="Mini-grid Intelligence · Reference site" title={view.name}>
        {view.region}. {view.standingNote}
      </SectorBand>
      <div className="flex flex-wrap items-center gap-2">
        <PublishedMark />
        <Link href={hrefOf("minigrid.sites")} className="text-sm text-link hover:text-link-hover hover:underline">
          ← The operator&apos;s sites
        </Link>
      </div>
      <ReferenceAttribution attribution={view.attribution} />

      <Panel title="The site, as its documents describe it" aside="Reported by the operator; status words are the publisher's">
        <Table name="reference-facts">
          <tbody>
            {view.facts.map((fact) => (
              <Row key={fact.label} id={fact.label}>
                <Td className="w-40 text-ink-3">{fact.label}</Td>
                <Td>
                  <span className="text-ink">{fact.value}</span>
                  {fact.status ? <span className="ml-2 text-micro uppercase tracking-wide text-ink-5">{fact.status}</span> : null}
                  {fact.note ? <p className="mt-0.5 text-micro leading-snug text-ink-5">{fact.note}</p> : null}
                </Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <Note>{view.locationNote}</Note>
        <Note>Supply: {view.supply}</Note>
      </Panel>

      <Panel title="Customer meters against the site meter" aside="As published, beside GridIntel's calculation">
        <ClaimTable rows={view.meterGap} name="reference-meter-gap" />
        <Note tone="caution">Why the meters record less, in the publisher&apos;s words: {view.meterGapCauses}</Note>
      </Panel>

      <Panel title="Use and customers who bought credit, by year" aside="Calculated from the published daily figures">
        <Table name="reference-years" wide>
          <HeadRow>
            <Th>Year</Th>
            <Th right>Days with meter data</Th>
            <Th right>kWh a day, sum of meters</Th>
            <Th right>Meters reporting</Th>
            <Th right>kWh per reporting meter a day</Th>
            <Th right>Meter-days at 0 kWh</Th>
            <Th right>Bought credit</Th>
            <Th right>Accounts to date</Th>
            <Th right>Bought credit, of accounts</Th>
          </HeadRow>
          <tbody>
            {view.years.map((year) => (
              <Row key={year.year} id={year.year}>
                <Td>
                  {year.year}
                  {year.note ? <p className="mt-0.5 max-w-56 text-micro leading-snug text-ink-5">{year.note}</p> : null}
                </Td>
                <Td figure>{year.daysWithMeterData}</Td>
                <Td figure>{year.kwhPerDay ?? "—"}</Td>
                <Td figure>{year.meanMetersReporting ?? "—"}</Td>
                <Td figure>{year.kwhPerReportingMeterDay ?? "—"}</Td>
                <Td figure>{year.zeroMeterDays ?? "—"}</Td>
                <Td figure>{year.creditBuyers}</Td>
                <Td figure>{year.accountsToDate}</Td>
                <Td figure>{year.buyersShare ?? "—"}</Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <div className="rounded-tile border border-line px-3 py-2" data-repeat-buyers>
          <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-ink-3">{view.repeatBuyers.label}</span>
            <span className="font-mono tabular-nums font-semibold text-ink">{view.repeatBuyers.value}</span>
          </p>
          <p className="text-caption text-ink-4">{view.repeatBuyers.basis}</p>
        </div>
        <Fold label="Customers who bought credit: the dataset's counts beside GridIntel's" name="reference-buyers">
          <ClaimTable rows={view.creditBuyers} name="reference-buyers" />
        </Fold>
        <Note>
          A meter-day at 0 kWh can be no use, a switched-off meter or no supply; the data does not say which. Days with no meter data are left out, never counted as 0.
        </Note>
      </Panel>

      <Panel title="Reliability, December 2020 to November 2021" aside="The operator's fault log and report, beside GridIntel's calculation">
        <Table name="reference-reliability" wide>
          <HeadRow>
            <Th>Month</Th>
            <Th right>Events</Th>
            <Th right>SAIDI reported</Th>
            <Th right>SAIDI calculated</Th>
            <Th>SAIDI</Th>
            <Th right>SAIFI reported / calculated</Th>
            <Th right>ASAI as reported</Th>
            <Th right>ASAI on the month</Th>
            <Th right>ASAI calculated</Th>
          </HeadRow>
          <tbody>
            {view.reliability.map((month) => (
              <Row key={month.month} id={month.month}>
                <Td>
                  {month.month}
                  {month.note ? <p className="mt-0.5 max-w-64 text-micro leading-snug text-ink-5">{month.note}</p> : null}
                </Td>
                <Td figure>{month.events}</Td>
                <Td figure>{month.reported.saidi ?? "—"}</Td>
                <Td figure>{month.calculated.saidi ?? "—"}</Td>
                <Td>
                  <Standing standing={month.standing} />
                </Td>
                <Td figure>
                  {month.reported.saifi ?? "—"} / {month.calculated.saifi ?? "—"}
                </Td>
                <Td figure>{month.reported.asaiAsReported ?? "—"}</Td>
                <Td figure>{month.reported.asaiHoursInMonth ?? "—"}</Td>
                <Td figure>{month.calculated.asai ?? "—"}</Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <Note>{view.reliabilityNote}</Note>
      </Panel>

      <Panel title="Tariffs and events" aside="As the operator reports them">
        <Table name="reference-tariffs">
          <HeadRow>
            <Th>Period</Th>
            <Th>Tariff or event</Th>
          </HeadRow>
          <tbody>
            {[...view.tariffs, ...view.events].map((row) => (
              <Row key={`${row.period}:${row.value}`} id={row.period}>
                <Td className="whitespace-nowrap">{row.period}</Td>
                <Td>
                  <span className="text-ink">{row.value}</span>
                  {row.note ? <p className="mt-0.5 text-micro leading-snug text-ink-5">{row.note}</p> : null}
                </Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <Note tone="caution">{view.tariffNote}</Note>
      </Panel>

      <Panel title="What these figures are not">
        <ul className="list-disc space-y-1 pl-5 text-xs text-ink-2" data-not-claimed>
          {view.notClaimed.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The dataset's caveats" aside={`${view.caveats.length} known gaps and limitations`}>
        <Note>{view.caveatNote}</Note>
        <Fold label="Read the caveats" name="reference-caveats">
          <dl className="space-y-2 text-xs">
            {view.caveats.map((caveat) => (
              <div key={caveat.id} data-caveat={caveat.id}>
                <dt className="font-semibold text-ink">
                  {caveat.id} · {caveat.topic}
                </dt>
                <dd className="leading-snug text-ink-2">{caveat.description}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      </Panel>

      <ReferenceAttribution attribution={view.attribution} />
    </div>
  );
}
