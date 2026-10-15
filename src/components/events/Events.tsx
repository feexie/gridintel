import Link from "next/link";
import type { ReactNode } from "react";
import type { EventsWorkspaceView, OpenInterruptionRow, PlaceView } from "@/services/events/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, SectionNav, Sources } from "@/components/system/Fold";
import { MetricCell, OriginTag, Panel } from "@/components/system/Metric";
import { AlarmsPanel, SEVERITY_STYLE, SubjectLink } from "@/components/system/Panels";
import { HeadRow, Note, Row, Table, Td, Th } from "@/components/system/Table";
import { formatNumber, formatTime, levelHref } from "@/components/system/format";

/* Events / Alarms: what is wrong now, where, and who is affected. Interruptions in progress come
   first and largest; then the source alarms standing and the conditions GridIntel derived, each in
   its own list of cards, never merged; then where; then the two full lists. Everything is laid
   out from the read model; nothing is counted or ranked here. */

const SECTIONS = [
  { id: "now", label: "Wrong now" },
  { id: "where", label: "Where" },
  { id: "full-lists", label: "Full lists" },
];

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

/** A labelled fact on a card. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line/60 py-1">
      <dt className="text-caption text-ink-5">{label}</dt>
      <dd className="text-right text-xs text-ink-2">{children}</dd>
    </div>
  );
}

function ListHead({ title, count, origin, children }: { title: string; count: number; origin: "measured" | "calculated"; children: ReactNode }) {
  return (
    <header className="mb-2">
      <h3 className="flex flex-wrap items-center gap-2 text-caption font-semibold uppercase tracking-wide text-ink-2">
        {title} ({formatNumber(count)}) <OriginTag origin={origin} />
      </h3>
      <p className="mt-0.5 text-caption leading-snug text-ink-4">{children}</p>
    </header>
  );
}

/** One interruption whose customers, or some of them, had not got supply back at the as-of time. */
function InterruptionCard({ row, large }: { row: OpenInterruptionRow; large: boolean }) {
  return (
    <li
      className={`rounded-tile border border-l-[3px] px-3 py-2.5 ${large ? "border-line border-l-alert-line bg-alert-surface/60" : "border-line border-l-caution-line bg-caution-surface/40"}`}
      data-row={row.outageId}
    >
      <p className={`text-micro font-semibold uppercase tracking-wide ${large ? "text-alert" : "text-caution"}`}>
        {large ? "▲ In progress" : "◆ Restoration not recorded"} · {row.cause}
        {row.planned === null ? "" : row.planned ? " · planned" : " · unplanned"}
      </p>
      <p className={`mt-1 leading-snug text-ink ${large ? "text-base font-semibold" : "text-sm"}`}>
        <SubjectLink subject={row.beganAt} />: {row.affectedWords} still without supply.
      </p>
      <p className={`mt-1 flex flex-wrap items-baseline gap-x-2 ${large ? "text-lg" : "text-sm"}`}>
        <MetricCell metric={row.customers} />
        <span className="font-sans text-caption text-ink-4">customers affected, as the outage record gives them</span>
      </p>
      <dl className="mt-1.5">
        <Fact label="Where">
          <Place place={row.place} />
        </Fact>
        <Fact label="Interrupted">{formatTime(row.interruptedAt)}</Fact>
        <Fact label="Restored">{row.restoredAt === null ? "No restoration time recorded" : formatTime(row.restoredAt)}</Fact>
        <Fact label="Status in the source">{row.status === null ? "Not stated" : row.status === "open" ? "Open" : "Closed"}</Fact>
        <Fact label="Outage record">
          <span className="font-mono text-micro">{row.outageId}</span>
        </Fact>
      </dl>
      <Fold label={`What is still off (${row.affected.length})`} name="affected">
        <p>{row.affected.map((subject) => subject.label).join(", ")}</p>
      </Fold>
    </li>
  );
}

/** `map` is the shared map with what is wrong now marked on it; the page supplies it. */
export function Events({ view, map }: { view: EventsWorkspaceView; map?: ReactNode }) {
  const { now } = view;
  const { interruptions } = now;
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Events / Alarms">
        {view.organization ?? "Organization not recorded"} · what is wrong now, where, and who is affected.
      </SectorBand>
      <SectionNav sections={SECTIONS} />
      <KeyFold />

      <Panel id="now" title="What is wrong now" aside={`As of ${formatTime(view.asOf)} · three separate lists, never merged`}>
        <div data-now="interruptions">
          <ListHead title="Interruptions in progress" count={interruptions.inProgress.length} origin="measured">
            From the outage log: supply lost before the as-of time, and not back.
          </ListHead>
          {interruptions.note ? <Note tone="caution">{interruptions.note}</Note> : null}
          {interruptions.completeness === "not_available" ? null : interruptions.inProgress.length === 0 ? (
            <p className="py-1 text-xs text-ink-4">
              {interruptions.completeness === "complete" ? "The outage log records no interruption in progress at the as-of time." : "No interruption in progress is listed."}
            </p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2" data-list="in-progress">
              {interruptions.inProgress.map((row) => (
                <InterruptionCard key={row.outageId} row={row} large />
              ))}
            </ul>
          )}
          {interruptions.restorationNotRecorded.length > 0 ? (
            <div className="mt-3" data-now="restoration-not-recorded">
              <h4 className="mb-1 text-caption uppercase tracking-wide text-ink-4">Restoration not recorded ({formatNumber(interruptions.restorationNotRecorded.length)})</h4>
              <ul className="grid gap-2 lg:grid-cols-2" data-list="restoration-not-recorded">
                {interruptions.restorationNotRecorded.map((row) => (
                  <InterruptionCard key={row.outageId} row={row} large={false} />
                ))}
              </ul>
              <Note tone="caution">A data-quality item. These are not counted as in progress.</Note>
            </div>
          ) : null}
          {interruptions.startNotRecorded > 0 ? (
            <Note tone="caution">{formatNumber(interruptions.startNotRecorded)} exposure(s) in the outage log have no start time, so their state at the as-of time cannot be told.</Note>
          ) : null}
          <div className="mt-1">
            <Fold label="When an interruption is in progress" name="in-progress-rule">
              <p>Supply was lost before the as-of time, and the source says the outage is open or records a restoration after it.</p>
              {interruptions.restorationNotRecorded.length > 0 ? (
                <p>
                  A record is apart as a data-quality item when supply was lost before the as-of time, the outage log holds no restoration time, and the source does not say
                  the outage is open.
                </p>
              ) : null}
            </Fold>
          </div>
        </div>

        <div className="grid gap-4 border-t border-line pt-3 xl:grid-cols-2">
          <div className="min-w-0" data-now="alarms">
            <ListHead title="Source alarms standing" count={now.alarms.length} origin="measured">
              Raised by the utility&apos;s own systems and not cleared. GridIntel reports them; it does not decide whether they are true.
            </ListHead>
            {now.alarms.length === 0 ? (
              <p className="py-1 text-xs text-ink-4">
                {view.alarms.recorded.completeness === "complete" ? "No source alarm is standing at the as-of time." : (view.alarms.recorded.note ?? "No source alarm is listed.")}
              </p>
            ) : (
              <ul className="space-y-2" data-list="standing-alarms">
                {now.alarms.map(({ alarm, place, accountsBehind }) => (
                  <li key={alarm.id} className="rounded-tile border border-line bg-well/30 px-3 py-2" data-row={alarm.id}>
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className={`rounded-[3px] border px-1.5 py-px text-micro font-medium uppercase tracking-wide ${SEVERITY_STYLE[alarm.severity]}`}>{alarm.severity}</span>
                      <span className="text-sm text-ink">{alarm.message}</span>
                      <span className="font-mono text-micro text-ink-5">{alarm.code}</span>
                    </p>
                    <dl className="mt-1">
                      <Fact label="On">
                        <SubjectLink subject={alarm.subject} />
                      </Fact>
                      <Fact label="Where">
                        <Place place={place} />
                      </Fact>
                      <Fact label="Raised">{alarm.raisedAt ? formatTime(alarm.raisedAt) : "—"}</Fact>
                      <Fact label="Acknowledged">{alarm.acknowledgedAt ? formatTime(alarm.acknowledgedAt) : <span className="text-caution">Not acknowledged</span>}</Fact>
                      <Fact label="Active accounts behind it">
                        <MetricCell metric={accountsBehind} />
                      </Fact>
                    </dl>
                    <p className="mt-1 text-micro text-ink-5">
                      {alarm.kindName ? `Kind: ${alarm.kindName}` : "Kind not mapped from the source's code"}
                      {alarm.agreedBy.map((condition) => ` · a derived condition agrees (${condition.ruleName})`).join("")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {now.undatedAlarms > 0 ? (
              <Note tone="caution">
                {formatNumber(now.undatedAlarms)} more alarm(s) have no raise time in the source, so whether they are standing cannot be told. They are in the full list below and are
                not counted here.
              </Note>
            ) : null}
          </div>

          <div className="min-w-0" data-now="conditions">
            <ListHead title="Derived conditions that hold" count={now.conditions.length} origin="calculated">
              Worked out by GridIntel from telemetry under a named rule. They are not alarms.
            </ListHead>
            {now.conditions.length === 0 ? (
              <p className="py-1 text-xs text-ink-4">No derived condition holds at the as-of time.</p>
            ) : (
              <ul className="space-y-2" data-list="holding-conditions">
                {now.conditions.map(({ condition, place, accountsBehind }) => (
                  <li key={condition.key} className="rounded-tile border border-line bg-well/30 px-3 py-2" data-row={condition.key}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="rounded-[3px] border border-line-bold px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-2">Rule</span>
                      <span className="text-sm text-ink">{condition.ruleName}</span>
                    </p>
                    <dl className="mt-1">
                      <Fact label="On">
                        <SubjectLink subject={condition.subject} />
                      </Fact>
                      <Fact label="Where">
                        <Place place={place} />
                      </Fact>
                      <Fact label={condition.figure.label}>
                        <MetricCell metric={condition.figure} />
                      </Fact>
                      <Fact label="Source alarm of the matching kind">
                        {condition.sourceAlarm.status === "agrees"
                          ? `Agrees: ${condition.sourceAlarm.alarms.map((alarm) => alarm.code).join(", ")}`
                          : condition.sourceAlarm.status === "none_raised"
                            ? "None raised; the source's alarm record is complete"
                            : `Cannot be told: ${condition.sourceAlarm.reason}`}
                      </Fact>
                      <Fact label="Active accounts behind it">
                        <MetricCell metric={accountsBehind} />
                      </Fact>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
            {now.conditionsNotHolding > 0 ? (
              <Note>
                {formatNumber(now.conditionsNotHolding)} more condition(s) were found in the period and do not hold at the as-of time, or their state at it is not known. They are in
                the full list below.
              </Note>
            ) : null}
          </div>
        </div>
        <Fold label="What “active accounts behind it” counts" name="accounts-behind">
          <p>
            &ldquo;Active accounts behind it&rdquo; counts the accounts connected behind the asset an alarm or a condition names, from the registry. It is not a count of customers
            without supply: an alarm does not say that supply was lost. Customers affected are given only for interruptions, as the outage record gives them.
          </p>
        </Fold>
      </Panel>

      {map}

      <Panel id="where" title="Where" aside="Each substation and feeder, with what is under it">
        <Table name="places" wide>
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
        <Fold label="How the places are counted" name="places-notes">
          <p>
            A substation&apos;s row includes its feeders. An alarm on the substation itself, on a power transformer or on the substation&apos;s remote unit is in the substation&apos;s
            row and in no feeder&apos;s. Each name opens the level in the Operations drill-down, which lists the same alarms and conditions.
          </p>
        </Fold>
      </Panel>

      <AlarmsPanel id="full-lists" alarms={view.alarms} />
      <Sources sourcing={view.sourcing} />
    </div>
  );
}
