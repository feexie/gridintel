import type { MinigridSiteView } from "../minigrid/views.ts";
import type { OperationsRuntime } from "../operations/levels.ts";
import type { ReportBody } from "./body.ts";
import type { ReportBlock, ReportSection, ReportTableRow } from "./views.ts";
import { minigridPortfolioView, minigridSiteIds, minigridSiteView } from "../minigrid/view.ts";
import { mergeSourcing, registryCount } from "../operations/metric.ts";
import { calculated, counted, figure, text, time } from "./cells.ts";
import { periodWords } from "./period.ts";
import { COMMERCIAL_NOT_FOR_A_DAY } from "./sitePerformance.ts";

/* ==========================================================
   SERVICES — MINI-GRID COMPLIANCE AND RESULTS REPORT

   For a mini-grid regulator and a programme funder: is supply
   available, for how many hours, to how many connections, at what
   tariff, and does each site's own report agree with its records?
   Built from the read models of the Sites screens for the report's
   period: the same figures, the same words. Nothing is calculated
   here.

   Energy sold, billing and collection are given for a month and not
   for a day, for the reason the site performance report gives.

   The mini-grid operator's records only: nothing of the utility's is
   read (ADR 0015).
========================================================== */

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

function find(site: MinigridSiteView, label: string) {
  return [...site.availability.figures, ...site.commercial.figures].find((metric) => metric.label === label);
}

/** A figure a site's read model holds under this label; "not available" when it holds none, never zero. */
function siteFigure(site: MinigridSiteView, label: string) {
  const metric = find(site, label);
  return figure(
    metric ?? { ...calculated(`${label}, ${site.name}`, null, "count", null), status: "not_available", note: "The site's read model holds no such figure." },
  );
}

export async function complianceReport(runtime: OperationsRuntime, offset: string, periodKind: "day" | "month" | "year"): Promise<ReportBody> {
  const portfolio = await minigridPortfolioView(runtime);
  const ids = await minigridSiteIds(runtime);
  const sites = (await Promise.all(ids.map((id) => minigridSiteView(runtime, id)))).filter((site): site is MinigridSiteView => site !== null).sort(byName);
  const cards = new Map(portfolio.sites.map((card) => [card.id, card]));
  const period = periodWords(runtime.period, offset);
  const forMonth = periodKind !== "day";
  const notForADay: ReportBlock = { kind: "statement", tone: "unavailable", title: null, text: COMMERCIAL_NOT_FOR_A_DAY };
  const completeness =
    portfolio.completeness === "complete" ? null : "The list of sites is not complete: a site may exist that is not in this report.";

  /* 1. Supply */
  const supplyRows: ReportTableRow[] = sites.map((site) => ({
    id: site.id,
    label: site.name,
    detail: site.commissioned === null ? null : `Commissioned ${site.commissioned.slice(0, 10)}`,
    cells: {
      availability: siteFigure(site, "Availability"),
      unplanned: figure(site.availability.withoutPlanned),
      hours: siteFigure(site, "Hours of supply per day"),
      interruptions: siteFigure(site, "Interruptions per connection"),
    },
  }));
  const provisional = sites.filter((site) => site.availability.provisional).map((site) => site.name);
  const supplySection: ReportSection = {
    id: "supply",
    number: 1,
    title: "Supply: availability and hours of supply",
    purpose: "Whether each site's customers had power, and for how many hours a day.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "Availability and hours of supply, by site",
        caption: "Availability is customer-weighted, with every recorded interruption counted; it is shown again with planned interruptions left out.",
        columns: [
          { key: "availability", label: "Availability" },
          { key: "unplanned", label: "Without planned" },
          { key: "hours", label: "Hours of supply a day" },
          { key: "interruptions", label: "Interruptions per connection" },
        ],
        rows: supplyRows,
        empty: "The register holds no site.",
        notes: [
          ...(completeness === null ? [] : [completeness]),
          ...(provisional.length === 0 ? [] : [`Provisional for ${provisional.join(", ")}: an interruption was still open at the end of the period and is counted to its end.`]),
          ...sites.flatMap((site) =>
            site.availability.excludedExposures > 0 ? [`${site.name}: ${site.availability.excludedExposures} interruption record(s) were left out because a time or a customer count is missing.`] : [],
          ),
        ],
      },
      {
        kind: "table",
        title: "Interruptions",
        caption: "Every interruption recorded at a site in the period, by site and in order.",
        columns: [
          { key: "from", label: "From" },
          { key: "to", label: "To" },
          { key: "hours", label: "Hours" },
          { key: "cause", label: "Cause" },
          { key: "planned", label: "Planned" },
          { key: "customers", label: "Customers affected" },
        ],
        rows: sites.flatMap((site) =>
          site.availability.interruptions.map((row, i) => ({
            id: `${site.id}:${row.id}:${i}`,
            label: site.name,
            detail: row.note,
            cells: {
              from: time(row.from),
              to: time(row.to, "Not restored by the end of the period"),
              hours: figure(calculated(`Duration, ${site.name}`, row.hours, "hours", null, { derivation: "Restored less interrupted, from the outage record." })),
              cause: text(row.cause),
              planned: text(row.planned === null ? "Not recorded" : row.planned ? "Yes" : "No"),
              customers: figure(counted(`Customers affected, ${site.name}`, row.customersAffected, "As the outage record states.")),
            },
          })),
        ),
        empty: `No interruption is recorded at any site for ${period}.`,
        notes: [],
      },
    ],
  };

  /* 2. Connections */
  const connectionRows: ReportTableRow[] = sites.map((site) => {
    const coverage = site.energy.deliveredCoverage;
    return {
      id: site.id,
      label: site.name,
      detail: cards.get(site.id)?.plant ?? null,
      cells: {
        connections: figure(registryCount(`Connections in the register, ${site.name}`, coverage.connections)),
        active: siteFigure(site, "Active connections"),
        ...(forMonth ? { sold: siteFigure(site, "Energy sold per connection") } : {}),
        consumed: siteFigure(site, "Consumption per connection"),
        metered: text(`${coverage.recorded} of ${coverage.connections} recorded for the whole period; ${coverage.unmetered} unmetered; ${coverage.incomplete} incomplete`),
      },
    };
  });
  const connectionSection: ReportSection = {
    id: "connections",
    number: 2,
    title: "Connections and consumption",
    purpose: forMonth ? "How many customers each site connects, how many bought or used energy, and how much." : "How many customers each site connects, how many used energy, and how much.",
    newPage: false,
    blocks: [
      {
        kind: "table",
        title: "Connections, by site",
        caption: forMonth
          ? "Connections in the register, and those with an active account. Per-connection figures are over active connections. Consumption is from customer meters; energy sold is energy billed."
          : "Connections in the register, and those with an active account. Consumption per connection is over active connections, from customer meters. Energy sold is energy billed, and is not given for a day.",
        columns: [
          { key: "connections", label: "Connections" },
          { key: "active", label: "Active" },
          ...(forMonth ? [{ key: "sold", label: "Energy sold per connection" }] : []),
          { key: "consumed", label: "Consumption per connection" },
          { key: "metered", label: "Customer meters" },
        ],
        rows: connectionRows,
        empty: "The register holds no site.",
        notes: completeness === null ? [] : [completeness],
      },
    ],
  };

  /* 3. Generation */
  const generationSection: ReportSection = {
    id: "generation",
    number: 3,
    title: "Generation",
    purpose: "How much of each site's energy was renewable, and how its plant performed.",
    newPage: false,
    blocks: [
      {
        kind: "table",
        title: "Renewable fraction and plant, by site",
        caption: "Renewable fraction is the share of energy generated that came from PV. A site without a generator or a PV array has no figure for it.",
        columns: [
          { key: "renewable", label: "Renewable fraction" },
          { key: "fuel", label: "Fuel per kWh" },
          { key: "pr", label: "Performance ratio" },
          { key: "loss", label: "Site loss" },
        ],
        rows: sites.map((site) => {
          const card = cards.get(site.id);
          return {
            id: site.id,
            label: site.name,
            detail: null,
            cells: {
              renewable: figure(site.energy.renewableFraction),
              fuel: card?.fuelPerKwh ? figure(card.fuelPerKwh) : text("No generator"),
              pr: card?.performanceRatio ? figure(card.performanceRatio) : text("No PV array"),
              loss: figure(site.energy.siteLoss),
            },
          };
        }),
        empty: "The register holds no site.",
        notes: [],
      },
    ],
  };

  /* 4. Tariffs */
  const currency = portfolio.currency;
  const tierMethod = sites[0]?.commercial.collectionEfficiency.method ?? null;
  const tariffSection: ReportSection = {
    id: "tariffs",
    number: 4,
    title: "Tariffs: an assumption",
    purpose: forMonth ? "What customers were charged, and on what basis that is known." : "On what basis the tariffs are known. What customers were charged is given for a month.",
    newPage: true,
    blocks: [
      {
        kind: "statement",
        tone: "caveat",
        title: "The tariff is an assumption",
        text:
          `${portfolio.tariffCaveat ?? "The tariffs are as the operator's billing records apply them."} The records hold no tariff of their own: each tier's rate is an assumption used to price its bills, ` +
          `and it is not a published or approved rate.${forMonth ? " Each tier's billed revenue and energy sold are shown below; no rate is worked out from them here." : ""}`,
      },
      forMonth ? {
        kind: "table",
        title: "Billing by tariff tier, by site",
        caption: "As billed in the period. Energy sold to a prepaid account is energy purchased, not energy used.",
        columns: [
          { key: "accounts", label: "Accounts" },
          { key: "active", label: "Active" },
          { key: "energy", label: "Energy sold (kWh)" },
          { key: "billed", label: "Revenue billed" },
          { key: "collected", label: "Revenue collected" },
        ],
        rows: sites.flatMap((site) =>
          site.commercial.byTier.map((tier) => ({
            id: `${site.id}:${tier.tier}`,
            label: tier.tier,
            detail: site.name,
            cells: {
              accounts: figure(counted(`Accounts, ${site.name}, ${tier.tier}`, tier.accounts, "Counted from the register.")),
              active: figure(counted(`Active accounts, ${site.name}, ${tier.tier}`, tier.activeAccounts, "Accounts whose status in the register is active.")),
              energy: figure(calculated(`Energy sold, ${site.name}, ${tier.tier}`, tier.energySoldKwh, "kWh", tierMethod, { missing: "A charge of the tier states no energy." })),
              billed: figure(calculated(`Revenue billed, ${site.name}, ${tier.tier}`, tier.revenueBilled, "currency", tierMethod, { currency })),
              collected: figure(calculated(`Revenue collected, ${site.name}, ${tier.tier}`, tier.revenueCollected, "currency", tierMethod, { currency, note: "Cash basis." })),
            },
          })),
        ),
        empty: `No bill is recorded at any site for ${period}.`,
        notes: [],
      } : notForADay,
    ],
  };

  /* 5. Revenue and collection */
  const revenueSection: ReportSection = {
    id: "revenue",
    number: 5,
    title: "Revenue and collection",
    purpose: "What each site billed and what it collected.",
    newPage: false,
    blocks: forMonth ? [
      {
        kind: "table",
        title: "Revenue and collection, by site",
        caption: "Cash basis: money received in the period against bills issued in the period.",
        columns: [
          { key: "billed", label: "Revenue billed" },
          { key: "collected", label: "Revenue collected" },
          { key: "efficiency", label: "Collection efficiency" },
          { key: "perConnection", label: "Revenue per connection" },
        ],
        rows: sites.map((site) => ({
          id: site.id,
          label: site.name,
          detail: null,
          cells: {
            billed: siteFigure(site, "Revenue billed"),
            collected: siteFigure(site, "Revenue collected"),
            efficiency: figure(site.commercial.collectionEfficiency),
            perConnection: siteFigure(site, "Revenue per connection"),
          },
        })),
        empty: "The register holds no site.",
        notes: [],
      },
    ] : [notForADay],
  };

  /* 6. Each site's report against its records */
  const standing: ReportTableRow[] = sites.map((site) => ({
    id: site.id,
    label: site.name,
    detail: site.report.document,
    cells: {
      claims: figure(counted(`Claims with a calculation, ${site.name}`, site.report.claims, "Figures the site's report states that a calculation exists for.")),
      agree: figure(counted(`Claims that agree, ${site.name}`, site.report.agree, "On the same basis and within the tolerance.")),
      differ: figure(counted(`Claims that differ, ${site.name}`, site.report.differ, "On the same basis and outside the tolerance.")),
      notComparable: figure(counted(`Claims not comparable, ${site.name}`, site.report.notComparable, "No calculation on the claim's basis, or the claim states none.")),
    },
  }));
  const reportSection: ReportSection = {
    id: "reports",
    number: 6,
    title: "Each site's report against its records",
    purpose: "Whether what each site reported agrees with what its own records show, figure by figure, on the report's basis.",
    newPage: true,
    blocks: [
      {
        kind: "table",
        title: "How each report stands",
        caption: `A claim agrees when it is on the same basis as the calculation and within ${Math.round(portfolio.agreementTolerance * 1000) / 10}% of it.`,
        columns: [
          { key: "claims", label: "Claims" },
          { key: "agree", label: "Agree" },
          { key: "differ", label: "Differ" },
          { key: "notComparable", label: "Not comparable" },
        ],
        rows: standing,
        empty: "The register holds no site.",
        notes: [],
      },
      ...sites.map(
        (site): ReportBlock => ({
          kind: "comparisons",
          title: site.report.document === null ? site.name : `${site.name}: ${site.report.document}`,
          note: site.comparisonNote,
          rows: site.comparisons,
          empty: `No report from ${site.name} in the records states figures for ${period}.`,
        }),
      ),
    ],
  };

  const differs = sites.filter((site) => site.report.differ > 0);
  return {
    organization: portfolio.operator,
    summary: [
      registryCount("Sites in the register", sites.length, completeness),
      ...sites.flatMap((site) => {
        const availability = find(site, "Availability");
        return availability === undefined ? [] : [{ ...availability, label: `Availability, ${site.name}` }];
      }),
    ],
    summaryNotes: [
      ...(forMonth ? [] : [`Energy sold, billing and collection are not given for a day: ${COMMERCIAL_NOT_FOR_A_DAY.replace(/^Not available for a day\. /, "")}`]),
      ...(portfolio.tariffCaveat === null ? [] : [`Tariffs: ${portfolio.tariffCaveat}`]),
      ...differs.map((site) => `${site.name}: the site's report differs from its records on ${site.report.differ} of ${site.report.claims} figure(s); see section 6.`),
      ...(provisional.length === 0 ? [] : [`Provisional for ${provisional.join(", ")}: an interruption was still open at the end of the period.`]),
    ],
    sections: [supplySection, connectionSection, generationSection, tariffSection, revenueSection, reportSection],
    sourcing: sites.reduce((all, site) => mergeSourcing(all, site.sourcing), portfolio.sourcing),
  };
}
