import type { MetricView, ReliabilityView } from "../operations/views.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { ReportBody } from "./body.ts";
import type { ReportBlock, ReportSection, ReportTableRow } from "./views.ts";
import { feedersOfSubstation } from "../../analytics/index.ts";
import { attributedIndex, loadRegistry, reliabilityBlock, timeZoneOf } from "../operations/levels.ts";
import { reliabilityWorkspaceView } from "../reliability/view.ts";
import { calculated, counted, figure, relabel, text } from "./cells.ts";
import { periodWords, samePeriod } from "./period.ts";

/* ==========================================================
   SERVICES — RELIABILITY AND SERVICE STANDARDS REPORT

   For a regulator checking a DisCo's reliability, and for the
   DisCo's own network planning. Built from the read models of the
   Reliability and Operations screens, for the report's period:
   the same blocks, the same figures, the same words. Nothing is
   calculated here; a figure the screens give as a bare number is
   given its status, origin and method (cells.ts).

   A reported figure is compared only with the calculation for the
   same period, on the reported figure's basis. A report for another
   period is named, and not compared.
========================================================== */

const COLUMNS = {
  customers: "Customers",
  saidi: "SAIDI (h)",
  saifi: "SAIFI",
  caidi: "CAIDI (h)",
  networkSaidi: "Network SAIDI (h)",
  networkSaifi: "Network SAIFI",
  upstream: "Upstream SAIDI (h)",
  loadShedding: "Load shedding SAIDI (h)",
};

const columns = (...keys: (keyof typeof COLUMNS)[]) => keys.map((key) => ({ key, label: COLUMNS[key] }));

/** A feeder's or a substation's indices as table cells. */
function indexCells(reliability: ReliabilityView) {
  return {
    customers: figure(reliability.customersServed),
    saidi: figure(reliability.saidi),
    saifi: figure(reliability.saifi),
    caidi: figure(reliability.caidi),
    networkSaidi: figure(attributedIndex(reliability, "network", "saidi")),
    networkSaifi: figure(attributedIndex(reliability, "network", "saifi")),
  };
}

function part(reliability: ReliabilityView, key: "upstream_supply" | "load_management", label: string): MetricView {
  const row = reliability.attribution.find((one) => one.key === key);
  return calculated(label, row?.saidiHours ?? null, "hours", reliability.saidi.method, { derivation: row?.description });
}

export async function reliabilityReport(runtime: OperationsRuntime, offset: string): Promise<ReportBody> {
  const view = await reliabilityWorkspaceView(runtime);
  const { snapshot, index } = await loadRegistry(runtime);
  const timeZone = timeZoneOf(snapshot);
  const method = view.portfolio.saidi.method;
  const portfolio = view.portfolio;

  const substations: { name: string; id: string; reliability: ReliabilityView }[] = [];
  const feeders = new Map<string, ReliabilityView>();
  for (const substation of snapshot.substations) {
    substations.push({ id: substation.id, name: substation.name, reliability: await reliabilityBlock(runtime, { kind: "substation", id: substation.id }, timeZone) });
    for (const feeder of feedersOfSubstation(index, substation.id)) feeders.set(feeder.id, await reliabilityBlock(runtime, { kind: "feeder", id: feeder.id }, timeZone));
  }

  /* 1. The portfolio */
  const attribution: ReportTableRow[] = portfolio.attribution.map((row) => ({
    id: row.key,
    label: row.label,
    detail: row.description,
    cells: {
      saidi: figure(calculated(`SAIDI, ${row.label.toLowerCase()}`, row.saidiHours, "hours", method)),
      saifi: figure(calculated(`SAIFI, ${row.label.toLowerCase()}`, row.saifi, "interruptions_per_customer", method)),
      share: figure(calculated(`Share of customer-hours, ${row.label.toLowerCase()}`, row.share, "fraction", method)),
    },
  }));
  const exclusions = [
    portfolio.unattributable > 0 ? `${portfolio.unattributable} interruption exposure(s) recorded above the portfolio or on a name that matches no registry asset are in no index.` : null,
    portfolio.excludedForData > 0 ? `${portfolio.excludedForData} exposure(s) were left out because a time or a customer count the calculation needs is missing.` : null,
    portfolio.momentary > 0 ? `${portfolio.momentary} momentary interruption(s) are not counted in SAIDI or SAIFI, under the methodology's threshold.` : null,
  ].filter((line): line is string => line !== null);

  const portfolioSection: ReportSection = {
    id: "portfolio",
    number: 1,
    title: "The DisCo's indices",
    purpose: "How often, and for how long, the average customer was interrupted, and how much of it was the distribution network's.",
    newPage: true,
    blocks: [
      { kind: "figures", title: null, metrics: [portfolio.saidi, portfolio.saifi, portfolio.caidi, portfolio.asai, portfolio.customersServed] },
      ...(portfolio.provisional === null ? [] : [{ kind: "statement", tone: "caveat", title: null, text: portfolio.provisional } satisfies ReportBlock]),
      {
        kind: "table",
        title: "By attribution: whose interruption it was",
        caption: "Each interruption is attributed by where it began, under the reference methodology. The rows add up to the totals above.",
        columns: [
          { key: "saidi", label: "SAIDI (h)" },
          { key: "saifi", label: "SAIFI" },
          { key: "share", label: "Share of customer-hours" },
        ],
        rows: attribution,
        empty: "No interruption is recorded in the period.",
        notes: exclusions,
      },
    ],
  };

  /* 2. By substation */
  const substationSection: ReportSection = {
    id: "substations",
    number: 2,
    title: "By substation",
    purpose: "The same indices for each injection substation and the customers it serves.",
    newPage: false,
    blocks: [
      {
        kind: "table",
        title: "Indices by substation",
        caption: "All interruptions, then the part attributed to the distribution network.",
        columns: columns("customers", "saidi", "saifi", "caidi", "networkSaidi", "networkSaifi"),
        rows: substations.map((one) => ({ id: one.id, label: one.name, detail: null, cells: indexCells(one.reliability) })),
        empty: "The registry holds no substation.",
        notes: substations.flatMap((one) => (one.reliability.provisional === null ? [] : [`${one.name}: ${one.reliability.provisional}`])),
      },
    ],
  };

  /* 3. By feeder, ranked by what the network did */
  const feederRows: ReportTableRow[] = view.feeders.map((row) => {
    const reliability = feeders.get(row.id)!;
    return {
      id: row.id,
      label: `${row.rank}. ${row.name}`,
      detail: row.substationName,
      cells: {
        ...indexCells(reliability),
        upstream: figure(part(reliability, "upstream_supply", "SAIDI, loss of upstream supply")),
        loadShedding: figure(part(reliability, "load_management", "SAIDI, load shedding")),
      },
    };
  });
  const feederSection: ReportSection = {
    id: "feeders",
    number: 3,
    title: "By feeder",
    purpose: "Which feeders fail their customers, ranked by what the distribution network itself did.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "Indices by 11 kV feeder",
        caption: "Ranked by network-attributable SAIDI, highest first. Loss of upstream supply and load shedding are shown beside it and do not set the rank.",
        columns: columns("customers", "saidi", "saifi", "caidi", "networkSaidi", "upstream", "loadShedding"),
        rows: feederRows,
        empty: "The registry holds no feeder.",
        notes: view.feeders.flatMap((row) => {
          const provisional = feeders.get(row.id)!.provisional;
          return provisional === null ? [] : [`${row.name}: ${provisional}`];
        }),
      },
    ],
  };

  /* 4. Where interruptions began */
  const breakdown = (rows: typeof view.byOriginPoint, what: string): ReportTableRow[] =>
    rows.map((row) => ({
      id: row.key,
      label: row.label,
      detail: row.note,
      cells: {
        saidi: figure(calculated(`SAIDI, ${what} ${row.label}`, row.saidiHours, "hours", method)),
        saifi: figure(calculated(`SAIFI, ${what} ${row.label}`, row.saifi, "interruptions_per_customer", method)),
        share: figure(calculated(`Share of customer-hours, ${what} ${row.label}`, row.share, "fraction", method)),
      },
    }));
  const breakdownColumns = [
    { key: "saidi", label: "SAIDI (h)" },
    { key: "saifi", label: "SAIFI" },
    { key: "share", label: "Share of customer-hours" },
  ];
  const originSection: ReportSection = {
    id: "origins",
    number: 4,
    title: "Where interruptions began",
    purpose: "Attribution by the part of the system each interruption began at, which decides whether it is the distribution network's to fix.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "By origin point",
        caption: "The part of the system the outage record names as where the interruption began, and which side of the boundary it is on.",
        columns: breakdownColumns,
        rows: breakdown(view.byOriginPoint, "began at"),
        empty: "No interruption is recorded in the period.",
        notes: [],
      },
      {
        kind: "table",
        title: "By cause",
        caption: "The cause the outage record gives.",
        columns: breakdownColumns,
        rows: breakdown(view.byCause, "caused by"),
        empty: "No interruption is recorded in the period.",
        notes: [],
      },
      {
        kind: "table",
        title: "The elements interruptions most often began at",
        caption: "Interruptions other than load shedding, most interruptions first.",
        columns: [
          { key: "point", label: "Origin point" },
          { key: "attribution", label: "Attributed to" },
          { key: "interruptions", label: "Interruptions" },
          { key: "saidi", label: "SAIDI (h)" },
        ],
        rows: view.origins.map((row) => ({
          id: row.subject.id,
          label: row.subject.label,
          detail: row.subject.kindLabel,
          cells: {
            point: text(row.originPoint),
            attribution: text(row.attributionLabel),
            interruptions: figure(counted(`Interruptions that began at ${row.subject.label}`, row.interruptions, "Counted from the outage records.")),
            saidi: figure(calculated(`SAIDI added by ${row.subject.label}`, row.saidiHours, "hours", method)),
          },
        })),
        empty: "No interruption other than load shedding is recorded in the period.",
        notes: [view.originsNote],
      },
    ],
  };

  /* 5. Service-band compliance */
  const bandRows: ReportTableRow[] = view.feeders.map((row) => {
    const supply = row.supply;
    return {
      id: row.id,
      label: row.name,
      detail: row.substationName,
      cells: {
        band: text(supply.band === null ? "No band recorded" : `Band ${supply.band}`),
        minimum: figure(calculated(`Band minimum, ${row.name}`, supply.minimumHours, "hours_per_day", supply.averageHours.method, { derivation: "The minimum average hours of supply a day the feeder's NERC service band commits to." })),
        average: figure(supply.averageHours),
        compliant: figure(counted(`Days at or above the band minimum, ${row.name}`, supply.daysCompliant, "Counted from the feeder's hours of supply on each day.")),
        nonCompliant: figure(counted(`Days below the band minimum, ${row.name}`, supply.daysNonCompliant, "Counted from the feeder's hours of supply on each day.")),
      },
    };
  });
  const shortDays: ReportTableRow[] = view.feeders.flatMap((row) =>
    row.supply.days
      .filter((day) => day.compliant === false)
      .map((day) => ({
        id: `${row.id}:${day.date}`,
        label: row.name,
        detail: row.supply.band === null ? null : `Band ${row.supply.band}`,
        cells: {
          date: text(day.date),
          hours: figure(calculated(`Hours of supply, ${row.name}, ${day.date}`, day.hours, "hours", row.supply.averageHours.method)),
          minimum: figure(calculated(`Band minimum, ${row.name}`, row.supply.minimumHours, "hours_per_day", row.supply.averageHours.method)),
        },
      })),
  );
  const bandSection: ReportSection = {
    id: "bands",
    number: 5,
    title: "Service-band compliance",
    purpose: "Whether each feeder gave its customers the hours of supply its service band commits to, day by day.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "Hours of supply against the band, by feeder",
        caption: "Each day is tested against the band minimum on its own; the average over the period is shown beside it and is a separate test.",
        columns: [
          { key: "band", label: "Band" },
          { key: "minimum", label: "Band minimum" },
          { key: "average", label: "Average supplied" },
          { key: "compliant", label: "Days met" },
          { key: "nonCompliant", label: "Days below" },
        ],
        rows: bandRows,
        empty: "The registry holds no feeder.",
        notes: view.feeders.flatMap((row) => (row.supply.note === null ? [] : [`${row.name}: ${row.supply.note}`])),
      },
      {
        kind: "table",
        title: "Days below the band minimum",
        caption: "Every feeder-day that fell short, by feeder.",
        columns: [
          { key: "date", label: "Day" },
          { key: "hours", label: "Hours supplied" },
          { key: "minimum", label: "Band minimum" },
        ],
        rows: shortDays,
        empty: "No feeder fell below its band minimum on any day of the period.",
        notes: [],
      },
    ],
  };

  /* 6. Interruptions still open */
  const openFeeders = view.feeders.filter((row) => feeders.get(row.id)!.provisional !== null);
  const openSection: ReportSection = {
    id: "open",
    number: 6,
    title: "Interruptions still open at the end of the period",
    purpose: "Which figures are provisional because a restoration is not yet recorded.",
    newPage: false,
    blocks: [
      portfolio.provisional === null
        ? { kind: "statement", tone: "note", title: null, text: "No interruption in the records was open at the end of the period. No figure in this report is provisional for that reason." }
        : { kind: "statement", tone: "caveat", title: null, text: portfolio.provisional },
      {
        kind: "table",
        title: "Feeders whose figures are provisional",
        caption: "An interruption still open is counted to the end of the period. The figure is calculated, not estimated, and is not final until the restoration is recorded.",
        columns: [{ key: "note", label: "What is provisional" }],
        rows: openFeeders.map((row) => ({ id: row.id, label: row.name, detail: row.substationName, cells: { note: text(feeders.get(row.id)!.provisional!) } })),
        empty: "None.",
        notes: [],
      },
    ],
  };

  /* 7. Reported against calculated */
  const forThisPeriod = view.comparisons.filter((row) => row.reportedPeriod !== null && samePeriod(row.reportedPeriod, runtime.period));
  const otherPeriods = [...new Set(view.comparisons.filter((row) => !forThisPeriod.includes(row)).map((row) => (row.reportedPeriod === null ? "a period they do not state" : periodWords(row.reportedPeriod, offset))))];
  const comparisonSection: ReportSection = {
    id: "reported",
    number: 7,
    title: "Reported against calculated",
    purpose: "Each figure the DisCo reported for this period, beside GridIntel's calculation on the reported figure's own basis, and what a report's attribution rule changes.",
    newPage: true,
    blocks: [
      {
        kind: "comparisons",
        title: "The DisCo's reported figures",
        note: forThisPeriod.length === 0 ? null : view.comparisonNote,
        rows: forThisPeriod,
        empty: `No reported figure in the records is for ${periodWords(runtime.period, offset)}.`,
      },
      ...(otherPeriods.length === 0
        ? []
        : [
            {
              kind: "statement",
              tone: "note",
              title: "Reports for other periods",
              text: `The records also hold reported figures for ${otherPeriods.join("; ")}. They are not compared here: a reported figure is compared only with a calculation for the same period.`,
            } satisfies ReportBlock,
          ]),
    ],
  };

  const differing = forThisPeriod.filter((row) => row.ruleFinding !== null);
  return {
    organization: view.organization,
    summary: [portfolio.saidi, portfolio.saifi, portfolio.caidi, relabel(attributedIndex(portfolio, "network", "saidi"), "SAIDI attributed to the distribution network"), portfolio.customersServed],
    summaryNotes: [
      ...(portfolio.provisional === null ? [] : [portfolio.provisional]),
      ...(differing.length === 0 ? [] : [`${differing.length} reported figure(s) state an attribution rule other than the reference one; what each rule changes is set out in section 7.`]),
    ],
    sections: [portfolioSection, substationSection, feederSection, originSection, bandSection, openSection, comparisonSection],
    sourcing: view.sourcing,
  };
}
