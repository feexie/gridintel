import type { MinigridSiteView } from "../minigrid/views.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { ReportBody } from "./body.ts";
import type { ReportBlock, ReportSection } from "./views.ts";
import { minigridPortfolioView, minigridSiteIds, minigridSiteView } from "../minigrid/view.ts";
import { mergeSourcing, registryCount } from "../operations/metric.ts";
import { calculated, counted, figure, relabel, text, time } from "./cells.ts";

/* ==========================================================
   SERVICES — MINI-GRID SITE PERFORMANCE REPORT

   For a mini-grid operator: each site's energy, plant, supply and
   money, and the portfolio side by side. Built from the read models
   of the Sites screens for the report's period: the same figures,
   the same words. It calculates nothing.

   Billing and collection are given for a month and not for a day,
   for the reason the DisCo operations report gives.

   The mini-grid operator's records only: nothing of the utility's is
   read (ADR 0015).
========================================================== */

export const COMMERCIAL_NOT_FOR_A_DAY =
  "Not available for a day. Collection efficiency and revenue per connection compare money billed and money collected over one span. " +
  "Bills for a month's supply are not issued on the day the energy is used, and payments arrive on days of their own, so for a single day they are not on one basis. They are given in the month's report.";

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

const ROLE_WORDS = { source: "Adds", less: "Less", equals: "Equals" } as const;

/** The portfolio's findings about money: left out of a day's report, which gives no money. */
const MONEY_FINDINGS = new Set(["uncollected", "class_pays_least"]);

function siteSection(site: MinigridSiteView, number: number, forMonth: boolean): ReportSection {
  const blocks: ReportBlock[] = [];

  /* Energy */
  blocks.push(
    { kind: "figures", title: "Energy", metrics: [relabel(site.energy.renewableFraction, `Renewable fraction, ${site.name}`), relabel(site.energy.siteLoss, `Site loss, ${site.name}`), relabel(site.energy.distributionLoss, `Distribution loss, ${site.name}`)] },
    {
      kind: "table",
      title: `Energy flow, ${site.name}`,
      caption: "From generation to customer meters, top to bottom. Each line keeps its own origin: a residual is shown as one.",
      columns: [
        { key: "role", label: "In the chain" },
        { key: "energy", label: "Energy" },
      ],
      rows: site.energy.flow.map((row, i) => ({ id: `${i}:${row.metric.label}`, label: row.metric.label, detail: row.metric.note, cells: { role: text(ROLE_WORDS[row.role]), energy: figure(relabel(row.metric, `${row.metric.label}, ${site.name}`)) } })),
      empty: "No energy is recorded for the period.",
      notes: [
        `${site.energy.deliveredCoverage.recorded} of ${site.energy.deliveredCoverage.connections} connections have a meter that recorded the whole period; ${site.energy.deliveredCoverage.unmetered} are unmetered and ${site.energy.deliveredCoverage.incomplete} incomplete.`,
      ],
    },
  );

  /* Plant */
  if (site.pv !== null) {
    blocks.push({ kind: "figures", title: "Solar PV", metrics: [site.pv.performanceRatio, site.pv.performanceRatioBeforeCurtailment, site.pv.curtailedShare, ...site.pv.figures].map((metric) => relabel(metric, `${metric.label}, ${site.name}`)) });
  } else blocks.push({ kind: "statement", tone: "note", title: "Solar PV", text: `${site.name} has no PV array in the register.` });
  if (site.storage !== null) {
    blocks.push({ kind: "figures", title: `Battery${site.storage.nameplate ? ` (${site.storage.nameplate})` : ""}`, metrics: site.storage.figures.map((metric) => relabel(metric, `${metric.label}, ${site.name}`)) });
  } else blocks.push({ kind: "statement", tone: "note", title: "Battery", text: `${site.name} has no battery in the register.` });
  if (site.generator !== null) {
    blocks.push({ kind: "figures", title: `Generator${site.generator.nameplate ? ` (${site.generator.nameplate})` : ""}`, metrics: site.generator.figures.map((metric) => relabel(metric, `${metric.label}, ${site.name}`)) });
  } else blocks.push({ kind: "statement", tone: "note", title: "Generator", text: `${site.name} has no generator in the register.` });

  /* Supply */
  blocks.push(
    { kind: "figures", title: "Supply", metrics: [...site.availability.figures, site.availability.withoutPlanned].map((metric) => relabel(metric, `${metric.label}, ${site.name}`)) },
    ...(site.availability.provisional ? [{ kind: "statement", tone: "caveat", title: null, text: `Provisional: an interruption at ${site.name} was still open at the end of the period and is counted to its end.` } satisfies ReportBlock] : []),
    {
      kind: "table",
      title: `Interruptions, ${site.name}`,
      caption: "Every interruption recorded at the site in the period, in order.",
      columns: [
        { key: "from", label: "From" },
        { key: "to", label: "To" },
        { key: "hours", label: "Hours" },
        { key: "cause", label: "Cause" },
        { key: "customers", label: "Customers affected" },
      ],
      rows: site.availability.interruptions.map((row, i) => ({
        id: `${row.id}:${i}`,
        label: row.planned === true ? "Planned" : row.planned === false ? "Unplanned" : "Not recorded whether planned",
        detail: row.note,
        cells: {
          from: time(row.from),
          to: time(row.to, "Not restored by the end of the period"),
          hours: figure(calculated(`Duration, ${site.name}`, row.hours, "hours", null, { derivation: "Restored less interrupted, from the outage record." })),
          cause: text(row.cause),
          customers: figure(counted(`Customers affected, ${site.name}`, row.customersAffected, "As the outage record states.")),
        },
      })),
      empty: `No interruption is recorded at ${site.name} in the period.`,
      notes: site.availability.excludedExposures > 0 ? [`${site.availability.excludedExposures} interruption record(s) were left out because a time or a customer count is missing.`] : [],
    },
  );

  /* Money */
  if (forMonth) {
    const currency = site.commercial.currency;
    const method = site.commercial.collectionEfficiency.method;
    blocks.push(
      { kind: "figures", title: "Sales and collection", metrics: [...site.commercial.figures, site.commercial.collectionEfficiency].map((metric) => relabel(metric, `${metric.label}, ${site.name}`)) },
      ...(site.commercial.tariffCaveat === null ? [] : [{ kind: "statement", tone: "caveat", title: "Tariffs", text: site.commercial.tariffCaveat } satisfies ReportBlock]),
      {
        kind: "table",
        title: `By customer class, ${site.name}`,
        caption: "Cash basis: money received in the period against bills issued in the period.",
        columns: [
          { key: "accounts", label: "Accounts" },
          { key: "billed", label: "Billed" },
          { key: "collected", label: "Collected" },
          { key: "efficiency", label: "Collection efficiency" },
        ],
        rows: site.commercial.byClass.map((row) => ({
          id: row.customerClass,
          label: row.label,
          detail: `${row.prepaidAccounts} prepaid, ${row.postpaidAccounts} postpaid`,
          cells: {
            accounts: figure(counted(`Accounts, ${site.name}, ${row.label}`, row.accounts, "Counted from the register.")),
            billed: figure(calculated(`Revenue billed, ${site.name}, ${row.label}`, row.revenueBilled, "currency", method, { currency })),
            collected: figure(calculated(`Revenue collected, ${site.name}, ${row.label}`, row.revenueCollected, "currency", method, { currency, note: "Cash basis." })),
            efficiency: figure(calculated(`Collection efficiency, ${site.name}, ${row.label}`, row.collectionEfficiency, "fraction", method, { missing: "The class was billed nothing in the period." })),
          },
        })),
        empty: `No bill is recorded at ${site.name} in the period.`,
        notes: [],
      },
    );
  } else blocks.push({ kind: "statement", tone: "unavailable", title: "Sales and collection: not available for a day", text: COMMERCIAL_NOT_FOR_A_DAY });

  return {
    id: `site-${site.id.toLowerCase()}`,
    number,
    title: site.name,
    purpose: `${site.name}'s energy, plant, supply${forMonth ? " and money" : ""}${site.commissioned === null ? "" : `; commissioned ${site.commissioned.slice(0, 10)}`}.`,
    newPage: true,
    blocks,
  };
}

export async function sitePerformanceReport(runtime: OperationsRuntime, _offset: string, periodKind: "day" | "month" | "year"): Promise<ReportBody> {
  const portfolio = await minigridPortfolioView(runtime);
  const ids = await minigridSiteIds(runtime);
  const sites = (await Promise.all(ids.map((id) => minigridSiteView(runtime, id)))).filter((site): site is MinigridSiteView => site !== null).sort(byName);
  const forMonth = periodKind !== "day";
  const completeness = portfolio.completeness === "complete" ? null : "The list of sites is not complete: a site may exist that is not in this report.";
  const cards = [...portfolio.sites].sort(byName);

  const portfolioSection: ReportSection = {
    id: "portfolio",
    number: 1,
    title: "The sites side by side",
    purpose: "How each site's plant, supply and sales compare.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "Plant and energy, by site",
        caption: null,
        columns: [
          { key: "connections", label: "Connections" },
          { key: "renewable", label: "Renewable fraction" },
          { key: "pr", label: "Performance ratio" },
          { key: "curtailed", label: "PV curtailed" },
          { key: "fuel", label: "Fuel per kWh" },
          { key: "availability", label: "Availability" },
        ],
        rows: cards.map((card) => ({
          id: card.id,
          label: card.name,
          detail: card.plant,
          cells: {
            connections: figure(relabel(card.connections, `Connections, ${card.name}`)),
            renewable: figure(relabel(card.renewableFraction, `Renewable fraction, ${card.name}`)),
            pr: card.performanceRatio === null ? text("No PV array") : figure(relabel(card.performanceRatio, `Performance ratio, ${card.name}`)),
            curtailed: card.curtailedShare === null ? text("No PV array") : figure(relabel(card.curtailedShare, `PV curtailed, ${card.name}`)),
            fuel: card.fuelPerKwh === null ? text("No generator") : figure(relabel(card.fuelPerKwh, `Fuel per kWh, ${card.name}`)),
            availability: figure(relabel(card.availability, `Availability, ${card.name}`)),
          },
        })),
        empty: "The register holds no site.",
        notes: completeness === null ? [] : [completeness],
      },
      ...(forMonth
        ? [
            {
              kind: "table",
              title: "Sales and collection, by site",
              caption: "Energy sold is energy billed. Cash basis for collection.",
              columns: [
                { key: "sold", label: "Energy sold per connection" },
                { key: "collection", label: "Collection efficiency" },
              ],
              rows: cards.map((card) => ({
                id: card.id,
                label: card.name,
                detail: null,
                cells: { sold: figure(relabel(card.energySoldPerConnection, `Energy sold per connection, ${card.name}`)), collection: figure(relabel(card.collectionEfficiency, `Collection efficiency, ${card.name}`)) },
              })),
              empty: "The register holds no site.",
              notes: [],
            } satisfies ReportBlock,
          ]
        : [{ kind: "statement", tone: "unavailable", title: "Sales and collection: not available for a day", text: COMMERCIAL_NOT_FOR_A_DAY } satisfies ReportBlock]),
      ...portfolio.findings.filter((finding) => forMonth || !MONEY_FINDINGS.has(finding.rule)).map(
        (finding): ReportBlock => ({ kind: "statement", tone: finding.tone === "alert" ? "caveat" : "note", title: finding.site === null ? finding.title : `${finding.title}: ${finding.site.name}`, text: `${finding.statement} Rule: ${finding.ruleText}` }),
      ),
    ],
  };

  return {
    organization: portfolio.operator,
    summary: [
      registryCount("Sites in the register", sites.length, completeness),
      ...cards.map((card) => relabel(card.availability, `Availability, ${card.name}`)),
      ...cards.map((card) => relabel(card.renewableFraction, `Renewable fraction, ${card.name}`)),
    ],
    summaryNotes: [
      ...(forMonth ? [] : [`Sales and collection are not given for a day: ${COMMERCIAL_NOT_FOR_A_DAY.replace(/^Not available for a day\. /, "")}`]),
      ...sites.filter((site) => site.availability.provisional).map((site) => `Provisional for ${site.name}: an interruption was still open at the end of the period.`),
    ],
    sections: [portfolioSection, ...sites.map((site, i) => siteSection(site, i + 2, forMonth))],
    sourcing: sites.reduce((all, site) => mergeSourcing(all, site.sourcing), portfolio.sourcing),
  };
}
