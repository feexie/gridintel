import type { OperationsRuntime } from "../operations/levels.ts";
import type { AlarmRowView, MetricView, ReportedComparisonView } from "../operations/views.ts";
import type { AssetRowView } from "../assets/views.ts";
import type { OpenInterruptionRow } from "../events/views.ts";
import type { ReportBody } from "./body.ts";
import type { ReportBlock, ReportSection, ReportTableRow } from "./views.ts";
import { assetsWorkspaceView } from "../assets/view.ts";
import { eventsWorkspaceView } from "../events/view.ts";
import { executiveView } from "../executive/view.ts";
import { attributedIndex } from "../operations/levels.ts";
import { mergeSourcing } from "../operations/metric.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { revenueWorkspaceView } from "../revenue/view.ts";
import { calculated, counted, figure, relabel, text, time } from "./cells.ts";
import { periodWords, samePeriod } from "./period.ts";

/* ==========================================================
   SERVICES — DISCO OPERATIONS REPORT

   For a DisCo's management: where energy and money are lost, who is
   not paying, how the network served its customers, which assets
   need attention, and what was wrong at the end of the period.
   Built from the read models of the Executive, Revenue, Reliability,
   Assets and Events / Alarms screens, for the report's period. It
   calculates nothing.

   The loss account and the money are given for a month and not for
   a day: bills for a month's supply are not issued on the day the
   energy is delivered, and payments arrive on days of their own, so
   a single day's energy, billing and collection are not on one
   basis. A day's report says so in place of those figures; it never
   prints a day's ratio as if it meant what the month's does.
========================================================== */

/** Words that stand in place of the loss account and the money on a day's report. */
export const MONEY_NOT_FOR_A_DAY =
  "Not available for a day. A loss account and collection efficiency compare energy delivered, energy billed and money collected over one span. " +
  "Bills for a month's supply are not issued on the day the energy is delivered, and payments arrive on days of their own, so for a single day these are not on one basis. They are given in the month's report.";

const ASSET_CLASS: Record<AssetRowView["assetClass"], string> = {
  power_transformer: "Power transformer",
  feeder: "11 kV feeder",
  distribution_transformer: "Distribution transformer",
};

/** Reported figures for this period, compared; others named. The same rule as the reliability report. */
function comparisonBlocks(rows: ReportedComparisonView[], period: { start: string; end: string }, offset: string, title: string, note: string | null): ReportBlock[] {
  const forThisPeriod = rows.filter((row) => row.reportedPeriod !== null && samePeriod(row.reportedPeriod, period));
  const others = [...new Set(rows.filter((row) => !forThisPeriod.includes(row)).map((row) => (row.reportedPeriod === null ? "a period they do not state" : periodWords(row.reportedPeriod, offset))))];
  return [
    { kind: "comparisons", title, note: forThisPeriod.length === 0 ? null : note, rows: forThisPeriod, empty: `No reported figure in the records is for ${periodWords(period, offset)}.` },
    ...(others.length === 0
      ? []
      : [
          {
            kind: "statement",
            tone: "note",
            title: "Reports for other periods",
            text: `The records also hold reported figures for ${others.join("; ")}. They are not compared here: a reported figure is compared only with a calculation for the same period.`,
          } satisfies ReportBlock,
        ]),
  ];
}

export function interruptionRows(rows: OpenInterruptionRow[]): ReportTableRow[] {
  return rows.map((row) => ({
    id: row.outageId,
    label: row.beganAt.label,
    detail: row.place.path.map((step) => step.name).join(" · ") || null,
    cells: {
      cause: text(`${row.cause}${row.planned === true ? " (planned)" : ""}`),
      from: time(row.interruptedAt),
      restored: time(row.restoredAt, "No restoration recorded"),
      affected: text(row.affectedWords),
      customers: figure(row.customers),
    },
  }));
}

export const INTERRUPTION_COLUMNS = [
  { key: "cause", label: "Cause" },
  { key: "from", label: "Interrupted" },
  { key: "restored", label: "Restored" },
  { key: "affected", label: "Still off" },
  { key: "customers", label: "Customers still off" },
];

export function alarmRows(rows: { alarm: AlarmRowView; accountsBehind: MetricView }[]): ReportTableRow[] {
  return rows.map(({ alarm, accountsBehind }) => ({
    id: alarm.id,
    label: alarm.subject.label,
    detail: alarm.subject.kindLabel,
    cells: {
      severity: text(alarm.severity),
      message: text(`${alarm.message} (${alarm.code})`),
      // The severity and the alarm in one cell, for a page that must be short (the daily brief).
      severityAndMessage: text(`${alarm.severity}: ${alarm.message} (${alarm.code})`),
      raised: time(alarm.raisedAt),
      acknowledged: time(alarm.acknowledgedAt, "Not acknowledged"),
      accounts: figure(accountsBehind),
    },
  }));
}

export const ALARM_COLUMNS = [
  { key: "severity", label: "Severity" },
  { key: "message", label: "Alarm" },
  { key: "raised", label: "Raised" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "accounts", label: "Accounts behind it" },
];

/** The same alarms in four columns, for the compact daily brief. */
export const ALARM_COLUMNS_SHORT = [
  { key: "severityAndMessage", label: "Alarm" },
  { key: "raised", label: "Raised" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "accounts", label: "Accounts behind it" },
];

export const SOURCE_ALARM_WORDS = { agrees: "A source alarm agrees", none_raised: "No source alarm raised", cannot_tell: "Cannot tell" } as const;

export async function operationsReport(runtime: OperationsRuntime, offset: string, periodKind: "day" | "month" | "year"): Promise<ReportBody> {
  const [executive, revenue, reliability, assets, events] = await Promise.all([
    executiveView(runtime, "all"),
    revenueWorkspaceView(runtime, "all"),
    reliabilityWorkspaceView(runtime),
    assetsWorkspaceView(runtime, "all"),
    eventsWorkspaceView(runtime),
  ]);
  const forMonth = periodKind !== "day";
  const period = periodWords(runtime.period, offset);
  const notForADay: ReportBlock = { kind: "statement", tone: "unavailable", title: null, text: MONEY_NOT_FOR_A_DAY };

  /* 1. Losses */
  const losses = executive.losses;
  const lossBlocks: ReportBlock[] =
    losses === null
      ? [{ kind: "statement", tone: "unavailable", title: null, text: executive.lossesNote ?? "No loss account can be drawn for the period." }]
      : [
          { kind: "figures", title: null, metrics: [losses.atcc, losses.parts.technical, losses.parts.commercial, losses.parts.collection, losses.billingEfficiency, losses.collectionEfficiency] },
          {
            kind: "table",
            title: "The energy account",
            caption: "From energy received at the DisCo's boundary to energy billed, top to bottom. Each line keeps its own origin: a technical loss from a loss study is an estimate, unbilled energy a residual.",
            columns: [{ key: "value", label: "Energy" }],
            rows: losses.chain.map((metric) => ({ id: metric.label, label: metric.label, detail: metric.derivation, cells: { value: figure(metric) } })),
            empty: "No energy account is held for the period.",
            notes: [],
          },
          {
            kind: "table",
            title: "Losses by feeder",
            caption: "Each feeder's losses as shares of the energy it received. The parts add up to its ATC&C.",
            columns: [
              { key: "atcc", label: "ATC&C" },
              { key: "technical", label: "Technical" },
              { key: "commercial", label: "Commercial" },
              { key: "collection", label: "Collection" },
              { key: "billing", label: "Billing efficiency" },
            ],
            rows: revenue.feeders.map((row) => ({
              id: row.id,
              label: row.name,
              detail: row.band === null ? null : `Band ${row.band}`,
              cells: {
                atcc: figure(relabel(row.losses.atcc, `ATC&C, ${row.name}`)),
                technical: figure(relabel(row.losses.parts.technical, `Technical loss, ${row.name}`)),
                commercial: figure(relabel(row.losses.parts.commercial, `Commercial loss, ${row.name}`)),
                collection: figure(relabel(row.losses.parts.collection, `Collection loss, ${row.name}`)),
                billing: figure(relabel(row.losses.billingEfficiency, `Billing efficiency, ${row.name}`)),
              },
            })),
            empty: "The registry holds no feeder.",
            notes: [],
          },
          ...comparisonBlocks(losses.reported, runtime.period, offset, "The DisCo's reported loss and collection figures", losses.reportedNote),
        ];
  const lossSection: ReportSection = {
    id: "losses",
    number: 1,
    title: "Losses: ATC&C and its parts",
    purpose: "How much of the energy the DisCo received was not turned into money, and in which part of the chain it was lost.",
    newPage: true,
    blocks: forMonth ? lossBlocks : [notForADay],
  };

  /* 2. Revenue not realised */
  const gap = revenue.gap;
  const gapSection: ReportSection = {
    id: "revenue-gap",
    number: 2,
    title: "Revenue not realised",
    purpose: "What the commercial and the collection losses are worth, in money, and on which feeders.",
    newPage: false,
    blocks: forMonth
      ? [
          { kind: "figures", title: null, metrics: [gap.commercial, gap.collection, gap.notRealised] },
          { kind: "statement", tone: "note", title: "What the figure is", text: `${gap.definition} ${gap.periodNote}` },
          ...[gap.caveat, gap.negativeNote, gap.unknownDemandClassNote].filter((one): one is string => one !== null).map((one): ReportBlock => ({ kind: "statement", tone: "caveat", title: null, text: one })),
          {
            kind: "table",
            title: "By feeder",
            caption: "Each feeder's commercial and collection gap. A negative part is shown as it is and not netted.",
            columns: [
              { key: "commercial", label: "Commercial gap" },
              { key: "collection", label: "Collection gap" },
              { key: "notRealised", label: "Not realised" },
            ],
            rows: revenue.gapByFeeder.map((row) => ({
              id: row.id,
              label: row.name,
              detail: null,
              cells: { commercial: figure(relabel(row.commercial, `Commercial gap, ${row.name}`)), collection: figure(relabel(row.collection, `Collection gap, ${row.name}`)), notRealised: figure(relabel(row.notRealised, `Not realised, ${row.name}`)) },
            })),
            empty: "The registry holds no feeder.",
            notes: [],
          },
        ]
      : [notForADay],
  };

  /* 3. Billing and collection by customer class */
  const currency = gap.currency;
  const classSection: ReportSection = {
    id: "collection",
    number: 3,
    title: "Billing and collection by customer class",
    purpose: "Who was billed, who paid, and who left the most uncollected.",
    newPage: false,
    blocks: forMonth
      ? [
          { kind: "figures", title: null, metrics: [revenue.revenueBilled, revenue.revenueCollected, revenue.collectionEfficiency] },
          {
            kind: "table",
            title: "By customer class",
            caption: "Cash basis: money received in the period against bills issued in the period. Largest shortfall first.",
            columns: [
              { key: "accounts", label: "Accounts" },
              { key: "billed", label: "Billed" },
              { key: "collected", label: "Collected" },
              { key: "notCollected", label: "Not collected" },
              { key: "efficiency", label: "Collection efficiency" },
            ],
            rows: revenue.byCustomerClass.map((row) => ({
              id: row.category,
              label: row.label,
              detail: null,
              cells: {
                accounts: figure(counted(`Accounts, ${row.label}`, row.accounts, "Accounts of the class billed in the period.")),
                billed: figure(calculated(`Revenue billed, ${row.label}`, row.revenueBilled, "currency", revenue.collectionEfficiency.method, { currency })),
                collected: figure(calculated(`Revenue collected, ${row.label}`, row.revenueCollected, "currency", revenue.collectionEfficiency.method, { currency, note: "Cash basis." })),
                notCollected: figure(calculated(`Not collected, ${row.label}`, row.notCollected, "currency", revenue.collectionEfficiency.method, { currency, derivation: "Billed less collected; negative when the class paid off more than it was billed." })),
                efficiency: figure(relabel(row.collection, `Collection efficiency, ${row.label}`)),
              },
            })),
            empty: `No bill is recorded for ${period}.`,
            notes: [],
          },
        ]
      : [notForADay],
  };

  /* 4. Reliability and supply */
  const portfolio = reliability.portfolio;
  const reliabilitySection: ReportSection = {
    id: "reliability",
    number: 4,
    title: "Reliability and hours of supply",
    purpose: "How often, and for how long, customers were without supply, and whether each feeder gave the hours its band commits to.",
    newPage: true,
    blocks: [
      { kind: "figures", title: null, metrics: [portfolio.saidi, portfolio.saifi, portfolio.caidi, relabel(attributedIndex(portfolio, "network", "saidi"), "SAIDI attributed to the distribution network")] },
      ...(portfolio.provisional === null ? [] : [{ kind: "statement", tone: "caveat", title: null, text: portfolio.provisional } satisfies ReportBlock]),
      {
        kind: "table",
        title: "Hours of supply against the band, by feeder",
        caption: "Each day is tested against the band minimum on its own; the average over the period is shown beside it.",
        columns: [
          { key: "band", label: "Band" },
          { key: "minimum", label: "Band minimum" },
          { key: "average", label: "Average supplied" },
          { key: "met", label: "Days met" },
          { key: "failed", label: "Days below" },
        ],
        rows: executive.bandCompliance.map((row) => ({
          id: row.feederId,
          label: row.feederName,
          detail: null,
          cells: {
            band: text(row.band === null ? "No band recorded" : `Band ${row.band}`),
            minimum: figure(calculated(`Band minimum, ${row.feederName}`, row.minimumHours, "hours_per_day", row.averageHours.method, { derivation: "The minimum average hours of supply a day the feeder's NERC service band commits to." })),
            average: figure(row.averageHours),
            met: figure(counted(`Days at or above the band minimum, ${row.feederName}`, row.daysMet, "Counted from the feeder's hours of supply on each day.")),
            failed: figure(counted(`Days below the band minimum, ${row.feederName}`, row.daysFailed, "Counted from the feeder's hours of supply on each day.")),
          },
        })),
        empty: "The registry holds no feeder.",
        notes: [],
      },
      { kind: "statement", tone: "note", title: null, text: "The indices by substation and feeder, where interruptions began and the DisCo's reported reliability figures are in the Reliability and service standards report for the same period." },
    ],
  };

  /* 5. Assets requiring attention */
  const assetSection: ReportSection = {
    id: "assets",
    number: 5,
    title: "Assets requiring attention",
    purpose: "Which assets had a source alarm, a derived condition or an interruption on them, each fact with its own origin.",
    newPage: true,
    blocks: [
      { kind: "statement", tone: "note", title: "Why an asset is listed", text: assets.attentionRule },
      {
        kind: "table",
        title: "The assets",
        caption: "In the order the rule gives. Loading is apparent power against rating, from telemetry; alarms are as source systems recorded them; conditions are GridIntel's, by rule.",
        columns: [
          { key: "class", label: "Class" },
          { key: "peak", label: "Peak loading" },
          { key: "over", label: "Readings above rating" },
          { key: "alarms", label: "Source alarms standing" },
          { key: "conditions", label: "Derived conditions" },
          { key: "began", label: "Interruptions that began here" },
        ],
        rows: assets.attention.map((row) => ({
          id: `${row.assetClass}:${row.id}`,
          label: row.name,
          detail: row.place,
          cells: {
            class: text(ASSET_CLASS[row.assetClass]),
            peak: figure(relabel(row.peak, `Peak loading, ${row.name}`)),
            over:
              row.readingsOverRating === null
                ? text("No loading calculated")
                : figure(counted(`Readings above rating, ${row.name}`, row.readingsOverRating, `Of ${row.readingsObserved ?? "an unknown number of"} readings in the period.`)),
            alarms: text(row.alarms.length === 0 ? (assets.alarmRecord === "complete" ? "None" : "Not known: the alarm record is not complete") : row.alarms.map((alarm) => `${alarm.severity}: ${alarm.message}${alarm.onMonitor ? " (on its monitor)" : ""}`).join("; ")),
            conditions: text(row.conditions.length === 0 ? "None" : row.conditions.map((condition) => `${condition.ruleName}${condition.activeNow === true ? ", holding at the end of the period" : ""}; ${SOURCE_ALARM_WORDS[condition.sourceAlarm].toLowerCase()}`).join("; ")),
            began:
              row.interruptionsBegan === null
                ? text("Not known: the outage log is not complete")
                : figure(counted(`Interruptions that began at ${row.name}`, row.interruptionsBegan, "Attributed to the distribution network, counted from the outage records.")),
          },
        })),
        empty: `No asset had a standing alarm, a derived condition or an interruption that began at it in ${period}.`,
        notes: [
          ...(assets.alarmsElsewhere > 0 ? [`${assets.alarmsElsewhere} standing source alarm(s) name no single asset of these classes (for example a substation as a whole); they are in section 6.`] : []),
          ...[...new Set(assets.attention.map((row) => row.loadingCaveat).filter((one): one is string => one !== null))],
          ...assets.notHeld.map((item) => `${item.name}: ${item.note}`),
        ],
      },
    ],
  };

  /* 6. Outages and alarms at the end of the period */
  const now = events.now;
  const eventSection: ReportSection = {
    id: "events",
    number: 6,
    title: "Outages and alarms at the end of the period",
    purpose: "What was wrong when the period closed: interruptions still in progress, alarms standing, and conditions holding.",
    newPage: true,
    blocks: [
      ...(now.interruptions.note === null ? [] : [{ kind: "statement", tone: "caveat", title: null, text: now.interruptions.note } satisfies ReportBlock]),
      {
        kind: "table",
        title: "Interruptions in progress",
        caption: "Outages whose customers, or some of them, had not got supply back at the end of the period, largest first.",
        columns: INTERRUPTION_COLUMNS,
        rows: interruptionRows(now.interruptions.inProgress),
        empty: now.interruptions.completeness === "complete" ? "None: every interruption in the outage log had been restored by the end of the period." : "None is in the outage log, which is not complete.",
        notes: now.interruptions.startNotRecorded > 0 ? [`${now.interruptions.startNotRecorded} exposure(s) have no recorded start and are not listed.`] : [],
      },
      {
        kind: "table",
        title: "Restoration not recorded",
        caption: "Outages with no restoration time whose source does not say they are open: a gap in the record, not a finding that supply is still off.",
        columns: INTERRUPTION_COLUMNS,
        rows: interruptionRows(now.interruptions.restorationNotRecorded),
        empty: "None.",
        notes: [],
      },
      {
        kind: "table",
        title: "Source alarms standing",
        caption: "As source systems recorded them, most severe first. Accounts behind an alarm are those connected there, not a count of customers without supply.",
        columns: ALARM_COLUMNS,
        rows: alarmRows(now.alarms),
        empty: events.alarms.recorded.completeness === "complete" ? "None was standing at the end of the period." : "None is in the alarm record, which is not complete.",
        notes: [
          ...(events.alarms.recorded.note === null ? [] : [events.alarms.recorded.note]),
          ...(now.undatedAlarms > 0 ? [`${now.undatedAlarms} alarm(s) have no recorded raise time, so whether they were standing cannot be told.`] : []),
          `${events.alarms.recorded.clearedTotal} alarm(s) raised were cleared by the end of the period.`,
        ],
      },
      {
        kind: "table",
        title: "Derived conditions",
        caption: "Found by GridIntel from telemetry under fixed rules, for the period. They are calculated, and are not alarms from any source system.",
        columns: [
          { key: "rule", label: "Rule" },
          { key: "figure", label: "Figure" },
          { key: "holding", label: "At the end of the period" },
          { key: "source", label: "Source alarm" },
        ],
        rows: events.alarms.derived.conditions.map((row) => ({
          id: row.key,
          label: row.subject.label,
          detail: row.subject.kindLabel,
          cells: {
            rule: text(row.ruleName),
            figure: figure(row.figure),
            holding: text(row.activeNow === null ? "Cannot be told" : row.activeNow ? "Holding" : "Not holding"),
            source: text(SOURCE_ALARM_WORDS[row.sourceAlarm.status]),
          },
        })),
        empty: "No condition was found in the period.",
        notes: [...(events.alarms.derived.note === null ? [] : [events.alarms.derived.note]), ...events.alarms.derived.rules.map((rule) => `${rule.name}: ${rule.statement}`)],
      },
    ],
  };

  return {
    organization: executive.organization,
    summary: forMonth
      ? [losses?.atcc, gap.notRealised, revenue.collectionEfficiency, portfolio.saidi, portfolio.saifi].filter((metric): metric is MetricView => metric !== undefined)
      : [portfolio.saidi, portfolio.saifi, portfolio.caidi, relabel(attributedIndex(portfolio, "network", "saidi"), "SAIDI attributed to the distribution network")],
    summaryNotes: [
      ...(forMonth ? [] : [`The loss account and the money are not given for a day: ${MONEY_NOT_FOR_A_DAY.replace(/^Not available for a day\. /, "")}`]),
      ...(portfolio.provisional === null ? [] : [portfolio.provisional]),
      ...(now.interruptions.inProgress.length === 0 ? [] : [`${now.interruptions.inProgress.length} interruption(s) were still in progress at the end of the period; see section 6.`]),
    ],
    sections: [lossSection, gapSection, classSection, reliabilitySection, assetSection, eventSection],
    sourcing: [revenue.sourcing, reliability.sourcing, assets.sourcing, events.sourcing].reduce(mergeSourcing),
  };
}
