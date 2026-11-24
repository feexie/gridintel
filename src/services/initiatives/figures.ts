import type { Citation } from "@/domain";
import type { InitiativeFigureId } from "../../constants/initiatives.ts";
import type { MarketplaceRepository } from "../../repositories/ports/marketplace.ts";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import type { MinigridPortfolioView } from "../minigrid/views.ts";
import type { InitiativeFigureView, MinigridSummaryView } from "./views.ts";

/* ==========================================================
   SERVICES — THE FIGURES ON THE INITIATIVE CARDS

   The initiative catalogue names its figures by id; they are
   resolved here, each with its status, origin and source. A figure
   no source supports is "not available" with what is missing, and
   never 0.

   - Customers metered nationally: the rate NERC publishes for the
     11 DisCos together (reported), the same figure the Metering
     screens show beside their own calculation.
   - Applications pending: designed (synthetic) counts of meter
     applications waiting at a DisCo, added up.
   - Charging hubs: no source yet (E-mobility comes later).
   - Mini-grid verification: the Sites screen's report checks,
     counted (calculated, on synthetic records).
========================================================== */

/** The national figure the Metering screens use: NERC's Second Quarter 2026 Report, Table 15. */
const NATIONAL_CITATION = "nerc-q2-2026";
const NATIONAL_LOCATOR = "Table 15, p. 56";

const count = (value: number) => new Intl.NumberFormat("en-NG").format(value);

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const notAvailable = (id: InitiativeFigureId, label: string, basis: string): InitiativeFigureView => ({ id, label, value: null, status: "not_available", origin: null, synthetic: false, basis, share: null });

export async function nationalMeteringRate(published: PublishedFiguresRepository): Promise<InitiativeFigureView> {
  const id: InitiativeFigureId = "metering.national-rate";
  const label = "Customers metered nationally";
  const [reports, citations] = await Promise.all([published.nationalReports(), published.citations()]);
  const report = reports.find((one) => one.citationId === NATIONAL_CITATION);
  const citation: Citation | undefined = citations.find((one) => one.id === NATIONAL_CITATION);
  if (report === undefined || report.meteringRatePercent === null || citation === undefined) {
    return notAvailable(id, label, "NERC's national metering rate was not found among the published figures.");
  }
  const published_ = citation.published ? `, ${formatDate(citation.published)}` : "";
  return {
    id,
    label,
    value: `${report.meteringRatePercent}%`,
    status: "ok",
    origin: "reported",
    synthetic: false,
    basis: `${citation.title}${published_}, ${NATIONAL_LOCATOR}: metered customers of the 11 DisCos at ${formatDate(report.asOf)}.`,
    share: report.meteringRatePercent / 100,
  };
}

/** Whose queue a figure counts: every DisCo's (the public Home), or one DisCo's (its own workspace, ADR 0021). */
export type QueueScope = { kind: "all" } | { kind: "disco"; disco: string };

export async function pendingApplications(marketplace: MarketplaceRepository, scope: QueueScope = { kind: "all" }): Promise<InitiativeFigureView> {
  const [all, sources] = await Promise.all([marketplace.pending(), marketplace.sources()]);
  const pending = scope.kind === "all" ? all : all.filter((row) => row.disco === scope.disco);
  const synthetic = pending.some((row) => sources.find((source) => source.id === row.sourceId)?.kind === "synthetic");
  const total = pending.reduce((sum, row) => sum + row.count, 0);
  const across = scope.kind === "all" ? "added up across the DisCos' queues" : "in this DisCo's own queue only";
  return {
    id: "metering.pending-applications",
    label: scope.kind === "all" ? "Applications pending" : "Applications pending at this DisCo",
    value: count(total),
    status: "ok",
    origin: "calculated",
    synthetic,
    basis: `Meter applications submitted, under review, verified or assigned a DT and feeder, and not yet approved, ${across}. Designed records: none is a real customer's application.`,
    share: null,
  };
}

export function chargingHubs(): InitiativeFigureView {
  return notAvailable("charging.hubs", "Charging and swap hubs", "GridIntel holds no charging hub records yet. They come with the E-mobility planner.");
}

/** A site whose report states figures and all of them agree with its records, within the tolerance. */
const agrees = (site: MinigridPortfolioView["sites"][number]) => site.report.claims > 0 && site.report.differ === 0;

export function sitesAgreeing(portfolio: MinigridPortfolioView): InitiativeFigureView {
  const id: InitiativeFigureId = "minigrid.sites-agreeing";
  const label = "Sites whose report agrees with their records";
  const sites = portfolio.sites.length;
  if (sites === 0 || portfolio.completeness === "not_available") return notAvailable(id, label, "No mini-grid sites are listed.");
  const agreeing = portfolio.sites.filter(agrees).length;
  const partial = portfolio.completeness === "complete" ? "" : " The list of sites may be incomplete.";
  return {
    id,
    label,
    value: `${count(agreeing)} of ${count(sites)}`,
    status: "ok",
    origin: "calculated",
    synthetic: portfolio.sourcing.synthetic,
    basis: `A site agrees when every figure its report states is within ${Math.round(portfolio.agreementTolerance * 100)}% of the same figure calculated from its records, on the report's basis.${partial}`,
    share: agreeing / sites,
  };
}

/** The public summary of mini-grid verification: counts only, no site's detail. */
export function minigridSummary(portfolio: MinigridPortfolioView): MinigridSummaryView {
  const synthetic = portfolio.sourcing.synthetic;
  const claims = portfolio.sites.reduce((sum, site) => sum + site.report.claims, 0);
  const differ = portfolio.sites.reduce((sum, site) => sum + site.report.differ, 0);
  const listed: InitiativeFigureView = {
    id: "minigrid.sites-listed",
    label: "Sites listed",
    value: count(portfolio.sites.length),
    status: "ok",
    origin: "calculated",
    synthetic,
    basis: portfolio.completeness === "complete" ? "Every site in the operator's register." : "The sites in the register; the list may be incomplete.",
    share: null,
  };
  const checked: InitiativeFigureView = { ...listed, id: "minigrid.claims-checked", label: "Reported figures checked against the records", value: count(claims), basis: "Figures the sites' reports state that a calculation from the records exists for.", share: null };
  const different: InitiativeFigureView = {
    ...listed,
    id: "minigrid.claims-differing",
    label: "Reported figures that differ from the records",
    value: count(differ),
    basis: `Of those, the figures more than ${Math.round(portfolio.agreementTolerance * 100)}% away from the calculation on the same basis.`,
    share: null,
  };
  return { figures: [listed, sitesAgreeing(portfolio), checked, different], synthetic };
}

type FigureInputs = {
  published: PublishedFiguresRepository;
  marketplace: MarketplaceRepository;
  minigrid: () => Promise<MinigridPortfolioView>;
};

/** Every figure the initiative catalogue names, resolved, as the public Home shows them: every DisCo's queue. */
export async function initiativeFigures(inputs: FigureInputs): Promise<Record<InitiativeFigureId, InitiativeFigureView>> {
  const [rate, pending, portfolio] = await Promise.all([nationalMeteringRate(inputs.published), pendingApplications(inputs.marketplace), inputs.minigrid()]);
  return {
    "metering.national-rate": rate,
    "metering.pending-applications": pending,
    "charging.hubs": chargingHubs(),
    "minigrid.sites-agreeing": sitesAgreeing(portfolio),
  };
}

/**
 * The same figures as a workspace sees them (ADR 0021; brief 3c.3). A DisCo's workspace counts
 * its own queue only; the national rate is labelled as national, so it is never read as the
 * workspace's own. Every other figure is the public one.
 */
export async function workspaceFigures(
  publicFigures: Record<InitiativeFigureId, InitiativeFigureView>,
  marketplace: MarketplaceRepository,
  queue: QueueScope,
): Promise<Record<InitiativeFigureId, InitiativeFigureView>> {
  const rate = publicFigures["metering.national-rate"];
  return {
    ...publicFigures,
    "metering.national-rate": { ...rate, label: "National (NERC)" },
    "metering.pending-applications": queue.kind === "all" ? publicFigures["metering.pending-applications"] : await pendingApplications(marketplace, queue),
  };
}
