import type { OperationsRuntime } from "../operations/levels.ts";
import type { ReportBody } from "./body.ts";
import type { ReportBlock, ReportSection } from "./views.ts";
import { assetsWorkspaceView } from "../assets/view.ts";
import { eventsWorkspaceView } from "../events/view.ts";
import { attributedIndex } from "../operations/levels.ts";
import { mergeSourcing } from "../operations/metric.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { calculated, counted, figure, relabel, text } from "./cells.ts";
import { ALARM_COLUMNS, INTERRUPTION_COLUMNS, SOURCE_ALARM_WORDS, alarmRows, interruptionRows } from "./operations.ts";
import { periodWords } from "./period.ts";

/* ==========================================================
   SERVICES — DAILY OPERATIONS BRIEF

   One page for one day, for the control room and the DisCo's
   management: how the network served its customers that day, and
   what was wrong when the day closed. Built from the read models of
   the Reliability, Events / Alarms and Assets screens, for the day,
   with "now" the end of the day. It calculates nothing.

   It is for a day only (catalogue.ts): a brief of a month is the
   DisCo operations report.
========================================================== */

/** Each note once, with the feeders it is about; a note about every feeder is said once, plainly. */
function feederNotes(feeders: { name: string; supply: { note: string | null } }[]): string[] {
  const byNote = new Map<string, string[]>();
  for (const feeder of feeders) if (feeder.supply.note !== null) byNote.set(feeder.supply.note, [...(byNote.get(feeder.supply.note) ?? []), feeder.name]);
  return [...byNote].map(([note, names]) => (names.length === feeders.length ? note : `${names.join(", ")}: ${note}`));
}

export async function dailyBrief(runtime: OperationsRuntime, offset: string): Promise<ReportBody> {
  const [reliability, events, assets] = await Promise.all([reliabilityWorkspaceView(runtime), eventsWorkspaceView(runtime), assetsWorkspaceView(runtime, "all")]);
  const day = periodWords(runtime.period, offset);
  const portfolio = reliability.portfolio;
  const now = events.now;
  const overloaded = assets.attention.filter((row) => row.readingsOverRating !== null && row.readingsOverRating > 0);
  const belowBand = reliability.feeders.filter((row) => row.supply.days.some((one) => one.compliant === false));

  /* 1. Supply on the day */
  const supplySection: ReportSection = {
    id: "supply",
    number: 1,
    title: "Supply on the day",
    purpose: "How long each feeder's customers had supply, against the hours its band commits to.",
    newPage: false,
    blocks: [
      ...(portfolio.provisional === null ? [] : [{ kind: "statement", tone: "caveat", title: null, text: portfolio.provisional } satisfies ReportBlock]),
      {
        kind: "table",
        title: "Hours of supply, by feeder",
        caption: "Ranked by network-attributable SAIDI for the day, highest first.",
        columns: [
          { key: "band", label: "Band" },
          { key: "hours", label: "Hours supplied" },
          { key: "minimum", label: "Band minimum" },
          { key: "met", label: "Met" },
          { key: "networkSaidi", label: "Network SAIDI (h)" },
        ],
        rows: reliability.feeders.map((row) => {
          const today = row.supply.days[0] ?? null;
          return {
            id: row.id,
            label: row.name,
            detail: row.substationName,
            cells: {
              band: text(row.supply.band === null ? "No band recorded" : `Band ${row.supply.band}`),
              hours: figure(relabel(row.supply.averageHours, `Hours of supply, ${row.name}`)),
              minimum: figure(calculated(`Band minimum, ${row.name}`, row.supply.minimumHours, "hours_per_day", row.supply.averageHours.method, { derivation: "The minimum average hours of supply a day the feeder's NERC service band commits to." })),
              met: text(today === null || today.compliant === null ? "Cannot be told" : today.compliant ? "Yes" : "No"),
              networkSaidi: figure(relabel(row.networkSaidi, `Network SAIDI, ${row.name}`)),
            },
          };
        }),
        empty: "The registry holds no feeder.",
        notes: feederNotes(reliability.feeders),
      },
    ],
  };

  /* 2. Interruptions in progress at the day's end */
  const interruptionSection: ReportSection = {
    id: "interruptions",
    number: 2,
    title: "Interruptions in progress at the end of the day",
    purpose: "Which customers were still without supply when the day closed.",
    newPage: false,
    blocks: [
      ...(now.interruptions.note === null ? [] : [{ kind: "statement", tone: "caveat", title: null, text: now.interruptions.note } satisfies ReportBlock]),
      {
        kind: "table",
        title: "In progress",
        caption: null,
        columns: INTERRUPTION_COLUMNS,
        rows: interruptionRows([...now.interruptions.inProgress, ...now.interruptions.restorationNotRecorded]),
        empty: now.interruptions.completeness === "complete" ? `None: every interruption in the outage log had been restored by the end of ${day}.` : "None is in the outage log, which is not complete.",
        notes: now.interruptions.restorationNotRecorded.length > 0 ? ["An outage with no restoration time whose source does not say it is open is a gap in the record, not a finding that supply is still off; it is listed with its restoration as not recorded."] : [],
      },
    ],
  };

  /* 3. Alarms and conditions at the day's end */
  const alarmSection: ReportSection = {
    id: "alarms",
    number: 3,
    title: "Alarms and conditions at the end of the day",
    purpose: "What source systems were alarming, and what GridIntel found from telemetry, when the day closed. Two lists, never merged.",
    newPage: false,
    blocks: [
      {
        kind: "table",
        title: "Source alarms standing",
        caption: null,
        columns: ALARM_COLUMNS,
        rows: alarmRows(now.alarms),
        empty: events.alarms.recorded.completeness === "complete" ? "None was standing at the end of the day." : "None is in the alarm record, which is not complete.",
        notes: [
          ...(events.alarms.recorded.note === null ? [] : [events.alarms.recorded.note]),
          ...(now.undatedAlarms > 0 ? [`${now.undatedAlarms} alarm(s) have no recorded raise time, so whether they were standing cannot be told.`] : []),
        ],
      },
      {
        kind: "table",
        title: "Derived conditions holding",
        caption: "Calculated by GridIntel under fixed rules; not alarms from any source system.",
        columns: [
          { key: "rule", label: "Rule" },
          { key: "figure", label: "Figure" },
          { key: "source", label: "Source alarm" },
        ],
        rows: now.conditions.map(({ condition }) => ({
          id: condition.key,
          label: condition.subject.label,
          detail: condition.subject.kindLabel,
          cells: { rule: text(condition.ruleName), figure: figure(condition.figure), source: text(SOURCE_ALARM_WORDS[condition.sourceAlarm.status]) },
        })),
        empty: "No derived condition held at the end of the day.",
        notes: events.alarms.derived.note === null ? [] : [events.alarms.derived.note],
      },
    ],
  };

  /* 4. Loading above rating in the day */
  const loadingSection: ReportSection = {
    id: "loading",
    number: 4,
    title: "Loaded above rating in the day",
    purpose: "Which assets carried more than their rating at a reading in the day.",
    newPage: false,
    blocks: [
      {
        kind: "table",
        title: "Assets above rating",
        caption: "Highest peak first. Loading is apparent power against rating, from telemetry.",
        columns: [
          { key: "peak", label: "Peak loading" },
          { key: "over", label: "Readings above rating" },
        ],
        rows: overloaded.map((row) => ({
          id: `${row.assetClass}:${row.id}`,
          label: row.name,
          detail: row.place,
          cells: {
            peak: figure(relabel(row.peak, `Peak loading, ${row.name}`)),
            over: figure(counted(`Readings above rating, ${row.name}`, row.readingsOverRating, `Of ${row.readingsObserved ?? "an unknown number of"} readings in the day.`)),
          },
        })),
        empty: `No asset with telemetry was above its rating at any reading in ${day}.`,
        notes: [...new Set(overloaded.map((row) => row.loadingCaveat).filter((one): one is string => one !== null))],
      },
    ],
  };

  return {
    organization: reliability.organization,
    summary: [
      portfolio.saidi,
      portfolio.saifi,
      relabel(attributedIndex(portfolio, "network", "saidi"), "SAIDI attributed to the distribution network"),
      counted("Feeders below their band minimum", belowBand.length, "Feeders whose hours of supply on the day were below their band's minimum."),
      // A count from a record that is not complete is not a count of everything: it is given as insufficient data, never as a number that could be read as "none".
      counted("Interruptions in progress at the end of the day", now.interruptions.completeness === "complete" ? now.interruptions.inProgress.length : null, "Counted from the outage log.", now.interruptions.completeness === "complete" ? null : "The outage log is not complete."),
      counted("Source alarms standing at the end of the day", events.alarms.recorded.completeness === "complete" ? now.alarms.length : null, "As source systems recorded them.", events.alarms.recorded.completeness === "complete" ? null : "The alarm record is not complete."),
    ],
    summaryNotes: portfolio.provisional === null ? [] : [portfolio.provisional],
    sections: [supplySection, interruptionSection, alarmSection, loadingSection],
    sourcing: [reliability.sourcing, events.sourcing, assets.sourcing].reduce(mergeSourcing),
  };
}
