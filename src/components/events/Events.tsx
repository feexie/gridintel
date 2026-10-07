import Link from "next/link";
import type { EventsWorkspaceView, OpenInterruptionRow, PlaceView } from "@/services/events/views";
import { Legend, MetricCell, OriginTag, Panel } from "@/components/system/Metric";
import { AlarmsPanel, SEVERITY_STYLE, SubjectLink } from "@/components/system/Panels";
import { HeadRow, Note, PageHead, Row, SubHead, Table, Td, Th } from "@/components/system/Table";
import { formatNumber, formatTime, levelHref } from "@/components/system/format";

/** The substation and feeder above a subject, each a link into the drill-down. */
function Place({ place }: { place: PlaceView }) {
  if (place.path.length === 0) return <span className="text-ink-5">Not placed in the network</span>;
  return (
    <>
      {place.path.map((step, i) => (
        <span key={`${step.kind}:${step.id}`}>
          {i > 0 ? <span className="text-ink-5"> › </span> : null}
          <Link href={levelHref(step.kind, step.id)} className="text-link hover:text-link-hover hover:underline">
            {step.name}
          </Link>
        </span>
      ))}
    </>
  );
}

function Interruptions({ rows, name }: { rows: OpenInterruptionRow[]; name: string }) {
  return (
    <Table name={name}>
      <HeadRow>
        <Th>Lost supply</Th>
        <Th>Where</Th>
        <Th>Began at</Th>
        <Th>Cause</Th>
        <Th>Interrupted</Th>
        <Th>Restored</Th>
        <Th right>Customers affected</Th>
      </HeadRow>
      <tbody>
        {rows.map((row) => (
          <Row key={row.key} id={row.key}>
            <Td>
              <SubjectLink subject={row.affected} />
              <span className="block font-mono text-micro text-ink-5">{row.outageId}</span>
            </Td>
            <Td>
              <Place place={row.place} />
            </Td>
            <Td>{row.beganAt.label}</Td>
            <Td>
              {row.cause}
              {row.planned === null ? null : <span className="block text-micro text-ink-5">{row.planned ? "planned" : "unplanned"}</span>}
            </Td>
            <Td className="whitespace-nowrap">{formatTime(row.interruptedAt)}</Td>
            <Td className="whitespace-nowrap">{row.restoredAt === null ? "No restoration time recorded" : formatTime(row.restoredAt)}</Td>
            <Td right>
              <MetricCell metric={row.customers} />
            </Td>
          </Row>
        ))}
      </tbody>
    </Table>
  );
}

export function Events({ view }: { view: EventsWorkspaceView }) {
  const { now } = view;
  const { interruptions } = now;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <PageHead eyebrow="Utility Intelligence" title="Events / Alarms">
          {view.organization ?? "Organization not recorded"} · what is wrong now, where, and who is affected.
        </PageHead>
        <Legend />
      </div>

      <Panel title="What is wrong now" aside={`As of ${formatTime(view.asOf)} · three separate lists, never merged`}>
        <div data-now="alarms">
          <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
            Source alarms standing ({formatNumber(now.alarms.length)}) <OriginTag origin="measured" />
          </h3>
          <p className="mb-1 mt-0.5 text-caption leading-snug text-ink-4">Raised by the utility&apos;s own systems and not cleared. GridIntel reports them; it does not decide whether they are true.</p>
          {now.alarms.length === 0 ? (
            <p className="py-1 text-xs text-ink-4">
              {view.alarms.recorded.completeness === "complete" ? "No source alarm is standing at the as-of time." : (view.alarms.recorded.note ?? "No source alarm is listed.")}
            </p>
          ) : (
            <Table name="standing-alarms">
              <HeadRow>
                <Th>Severity</Th>
                <Th>Alarm</Th>
                <Th>On</Th>
                <Th>Where</Th>
                <Th>Raised</Th>
                <Th>Acknowledged</Th>
                <Th right>Active accounts behind it</Th>
              </HeadRow>
              <tbody>
                {now.alarms.map(({ alarm, place, accountsBehind }) => (
                  <Row key={alarm.id} id={alarm.id}>
                    <Td>
                      <span className={`border px-1.5 py-px text-micro font-medium uppercase tracking-wide ${SEVERITY_STYLE[alarm.severity]}`}>{alarm.severity}</span>
                    </Td>
                    <Td>
                      {alarm.message} <span className="font-mono text-micro text-ink-5">{alarm.code}</span>
                      <span className="block text-micro text-ink-5">
                        {alarm.kindName ? `Kind: ${alarm.kindName}` : "Kind not mapped from the source's code"}
                        {alarm.agreedBy.map((condition) => ` · a derived condition agrees (${condition.ruleName})`).join("")}
                      </span>
                    </Td>
                    <Td>
                      <SubjectLink subject={alarm.subject} />
                    </Td>
                    <Td>
                      <Place place={place} />
                    </Td>
                    <Td className="whitespace-nowrap">{alarm.raisedAt ? formatTime(alarm.raisedAt) : "—"}</Td>
                    <Td className="whitespace-nowrap">{alarm.acknowledgedAt ? formatTime(alarm.acknowledgedAt) : <span className="text-caution">Not acknowledged</span>}</Td>
                    <Td right>
                      <MetricCell metric={accountsBehind} />
                    </Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
          {now.undatedAlarms > 0 ? (
            <Note tone="caution">
              {formatNumber(now.undatedAlarms)} more alarm(s) have no raise time in the source, so whether they are standing cannot be told. They are in the full list below and are not
              counted here.
            </Note>
          ) : null}
        </div>

        <div data-now="conditions">
          <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
            Derived conditions that hold ({formatNumber(now.conditions.length)}) <OriginTag origin="calculated" />
          </h3>
          <p className="mb-1 mt-0.5 text-caption leading-snug text-ink-4">Worked out by GridIntel from telemetry under a named rule. They are not alarms.</p>
          {now.conditions.length === 0 ? (
            <p className="py-1 text-xs text-ink-4">No derived condition holds at the as-of time.</p>
          ) : (
            <Table name="holding-conditions">
              <HeadRow>
                <Th>Rule</Th>
                <Th>On</Th>
                <Th>Where</Th>
                <Th right>Figure</Th>
                <Th>Source alarm of the matching kind</Th>
                <Th right>Active accounts behind it</Th>
              </HeadRow>
              <tbody>
                {now.conditions.map(({ condition, place, accountsBehind }) => (
                  <Row key={condition.key} id={condition.key}>
                    <Td>{condition.ruleName}</Td>
                    <Td>
                      <SubjectLink subject={condition.subject} />
                    </Td>
                    <Td>
                      <Place place={place} />
                    </Td>
                    <Td right>
                      <MetricCell metric={condition.figure} />
                      <span className="block text-micro text-ink-5">{condition.figure.label}</span>
                    </Td>
                    <Td>
                      {condition.sourceAlarm.status === "agrees"
                        ? `Agrees: ${condition.sourceAlarm.alarms.map((alarm) => alarm.code).join(", ")}`
                        : condition.sourceAlarm.status === "none_raised"
                          ? "None raised; the source's alarm record is complete"
                          : `Cannot be told: ${condition.sourceAlarm.reason}`}
                    </Td>
                    <Td right>
                      <MetricCell metric={accountsBehind} />
                    </Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          )}
          {now.conditionsNotHolding > 0 ? (
            <Note>
              {formatNumber(now.conditionsNotHolding)} more condition(s) were found in the period and do not hold at the as-of time, or their state at it is not known. They are in the full
              list below.
            </Note>
          ) : null}
        </div>

        <div data-now="interruptions">
          <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
            Interruptions in progress ({formatNumber(interruptions.inProgress.length)}) <OriginTag origin="measured" />
          </h3>
          <p className="mb-1 mt-0.5 text-caption leading-snug text-ink-4">From the outage log: supply was lost before the as-of time and the record says it came back after it.</p>
          {interruptions.note ? <Note tone="caution">{interruptions.note}</Note> : null}
          {interruptions.completeness === "not_available" ? null : interruptions.inProgress.length === 0 ? (
            <p className="py-1 text-xs text-ink-4">
              {interruptions.completeness === "complete" ? "The outage log records no interruption in progress at the as-of time." : "No interruption in progress is listed."}
            </p>
          ) : (
            <Interruptions rows={interruptions.inProgress} name="in-progress" />
          )}
          {interruptions.restorationNotRecorded.length > 0 ? (
            <div className="mt-2" data-now="restoration-not-recorded">
              <SubHead>Restoration not recorded ({formatNumber(interruptions.restorationNotRecorded.length)})</SubHead>
              <Interruptions rows={interruptions.restorationNotRecorded} name="restoration-not-recorded" />
              <Note tone="caution">
                Supply was lost before the as-of time and the outage log holds no restoration time. That is either an interruption still in progress or a restoration nobody wrote down;
                the record cannot say which, so these are not counted as in progress.
              </Note>
            </div>
          ) : null}
          {interruptions.startNotRecorded > 0 ? (
            <Note tone="caution">{formatNumber(interruptions.startNotRecorded)} exposure(s) in the outage log have no start time, so their state at the as-of time cannot be told.</Note>
          ) : null}
        </div>
        <Note>
          &ldquo;Active accounts behind it&rdquo; counts the accounts connected behind the asset an alarm or a condition names, from the registry. It is not a count of customers without
          supply: an alarm does not say that supply was lost. Customers affected are given only for interruptions, as the outage record gives them.
        </Note>
      </Panel>

      <Panel title="Where" aside="Each substation and feeder, with what is under it">
        <Table name="places">
          <HeadRow>
            <Th>Substation or feeder</Th>
            <Th right>Alarms standing</Th>
            <Th right>Alarms, time not recorded</Th>
            <Th right>Alarms cleared in the period</Th>
            <Th right>Conditions found</Th>
            <Th right>Conditions that hold</Th>
            <Th right>Interruptions in progress</Th>
            <Th right>Active accounts</Th>
          </HeadRow>
          <tbody>
            {view.places.map((place) => (
              <Row key={`${place.kind}:${place.id}`} id={place.id}>
                <Td className={place.kind === "feeder" ? "pl-4" : "font-semibold"}>
                  <Link href={levelHref(place.kind, place.id)} className="text-link hover:text-link-hover hover:underline">
                    {place.name}
                  </Link>
                </Td>
                <Td figure>{formatNumber(place.activeAlarms)}</Td>
                <Td figure>{formatNumber(place.undatedAlarms)}</Td>
                <Td figure>{formatNumber(place.clearedAlarms)}</Td>
                <Td figure>{formatNumber(place.conditions)}</Td>
                <Td figure>{formatNumber(place.conditionsHolding)}</Td>
                <Td figure>{formatNumber(place.interruptionsInProgress)}</Td>
                <Td right>
                  <MetricCell metric={place.accounts} />
                </Td>
              </Row>
            ))}
          </tbody>
        </Table>
        <Note>
          A substation&apos;s row includes its feeders. An alarm on the substation itself, on a power transformer or on the substation&apos;s remote unit is in the substation&apos;s row and in
          no feeder&apos;s. Each name opens the level in the Operations drill-down, which lists the same alarms and conditions.
        </Note>
      </Panel>

      <AlarmsPanel alarms={view.alarms} />

      <p className="text-micro text-ink-5">Data sources: {view.sourcing.sources.map((source) => `${source.name} [${source.kind}]`).join("; ") || "none"}</p>
    </div>
  );
}
