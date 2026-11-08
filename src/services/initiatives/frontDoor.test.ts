import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Citation, DataSource, PendingMeterApplications, ReportedNationalMetering } from "@/domain";
import type { MarketplaceRepository } from "../../repositories/ports/marketplace.ts";
import type { PublishedFiguresRepository } from "../../repositories/ports/published.ts";
import type { MinigridPortfolioView, SiteCardView } from "../minigrid/views.ts";
import { chargingHubs, initiativeFigures, minigridSummary, nationalMeteringRate, pendingApplications, sitesAgreeing } from "./figures.ts";
import { initialsOf, publicCards, railItemPage, rolePage, rolePicker, workspaceFrame, workspaceHome, workspaceInitiative, type WorkspaceRecord } from "./frontDoor.ts";

const CITATION: Citation = { id: "nerc-q2-2026", title: "NERC, Second Quarter 2026 Report", url: null, published: "2026-09-29", standing: "primary" };
const NATIONAL: ReportedNationalMetering = { asOf: "2026-06-30", period: "30 June 2026", meteringRatePercent: 61.51, activeCustomers: 1, meteredCustomers: 1, unmeteredCustomers: null, citationId: "nerc-q2-2026" };

const published = (reports: ReportedNationalMetering[], citations: Citation[] = [CITATION]) =>
  ({ nationalReports: async () => reports, citations: async () => citations }) as unknown as PublishedFiguresRepository;

const SYNTHETIC: DataSource = { id: "synthetic-x", name: "Synthetic", kind: "synthetic" } as DataSource;
const marketplace = (pending: PendingMeterApplications[], sources: DataSource[] = [SYNTHETIC]) =>
  ({ pending: async () => pending, sources: async () => sources }) as unknown as MarketplaceRepository;

const site = (claims: number, differ: number) => ({ report: { claims, agree: claims - differ, differ, notComparable: 0, document: null } }) as unknown as SiteCardView;
const portfolio = (sites: SiteCardView[], completeness: MinigridPortfolioView["completeness"] = "complete") =>
  ({ sites, completeness, agreementTolerance: 0.05, sourcing: { synthetic: true, sources: [] } }) as unknown as MinigridPortfolioView;

const WORKSPACES: WorkspaceRecord[] = [
  { id: "demo-utility", name: "Savanna Electricity Distribution (synthetic)", type: "utility", logo: null, demo: true, synthetic: true },
  { id: "demo-regulator", name: "Demonstration Regulator (synthetic)", type: "regulator", logo: null, demo: true, synthetic: true },
  { id: "demo-financier", name: "Demonstration Financier (synthetic)", type: "financier", logo: null, demo: true, synthetic: true },
];

describe("the figures on the initiative cards", () => {
  it("takes NERC's reported national metering rate, with its source and a share for the bar", async () => {
    const rate = await nationalMeteringRate(published([NATIONAL]));
    assert.equal(rate.value, "61.51%");
    assert.equal(rate.origin, "reported");
    assert.equal(rate.synthetic, false);
    assert.equal(rate.share, 0.6151);
    assert.match(rate.basis, /^NERC, Second Quarter 2026 Report, 29 September 2026, Table 15, p\. 56: .* 30 June 2026\.$/);
  });

  it("says the rate is not available, never 0, when NERC's figure is missing", async () => {
    for (const repo of [published([]), published([{ ...NATIONAL, meteringRatePercent: null }]), published([NATIONAL], [])]) {
      const rate = await nationalMeteringRate(repo);
      assert.equal(rate.status, "not_available");
      assert.equal(rate.value, null);
      assert.equal(rate.share, null);
    }
  });

  it("adds up the pending applications and marks them synthetic", async () => {
    const pending = await pendingApplications(
      marketplace([
        { disco: "ibadan", step: "submitted", count: 120, sourceId: "synthetic-x" },
        { disco: "kano", step: "assigned", count: 1_005, sourceId: "synthetic-x" },
      ]),
    );
    assert.equal(pending.value, "1,125");
    assert.equal(pending.origin, "calculated");
    assert.equal(pending.synthetic, true);
  });

  it("does not mark pending applications synthetic when their source is not", async () => {
    const pending = await pendingApplications(marketplace([{ disco: "ibadan", step: "submitted", count: 3, sourceId: "real" }], [{ id: "real", name: "Real", kind: "billing_system" } as DataSource]));
    assert.equal(pending.synthetic, false);
  });

  it("shows charging hubs as not yet available, with what is missing", () => {
    const hubs = chargingHubs();
    assert.equal(hubs.status, "not_available");
    assert.equal(hubs.value, null);
    assert.match(hubs.basis, /^Not yet available/);
  });

  it("counts the mini-grid sites whose report agrees with their records", () => {
    const agreeing = sitesAgreeing(portfolio([site(6, 0), site(5, 2), site(0, 0)]));
    assert.equal(agreeing.value, "1 of 3");
    assert.equal(agreeing.share, 1 / 3);
    assert.equal(agreeing.synthetic, true);
    assert.doesNotMatch(agreeing.basis, /incomplete/);
    assert.match(sitesAgreeing(portfolio([site(1, 0)], "partial")).basis, /may be incomplete/);
    assert.equal(sitesAgreeing(portfolio([])).status, "not_available");
  });

  it("gives the public mini-grid summary as counts only", () => {
    const summary = minigridSummary(portfolio([site(6, 0), site(5, 2)]));
    assert.deepEqual(
      summary.figures.map((figure) => [figure.label, figure.value]),
      [
        ["Sites listed", "2"],
        ["Sites whose report agrees with their records", "1 of 2"],
        ["Reported figures checked against the records", "11"],
        ["Reported figures that differ from the records", "2"],
      ],
    );
    assert.equal(summary.synthetic, true);
  });

  it("resolves every figure the catalogue names", async () => {
    const figures = await initiativeFigures({ published: published([NATIONAL]), marketplace: marketplace([]), minigrid: async () => portfolio([site(1, 0)]) });
    assert.deepEqual(Object.keys(figures).sort(), ["charging.hubs", "metering.national-rate", "metering.pending-applications", "minigrid.sites-agreeing"]);
  });
});

describe("the front door's view models", async () => {
  const figures = await initiativeFigures({ published: published([NATIONAL]), marketplace: marketplace([{ disco: "ibadan", step: "submitted", count: 7, sourceId: "synthetic-x" }]), minigrid: async () => portfolio([site(1, 0)]) });

  it("gives the public Home three cards, each with its headline and the meter card its bar and pending count", () => {
    const cards = publicCards(figures);
    assert.deepEqual(cards.map((one) => one.href), ["/preview/initiatives/meter-every-customer", "/preview/initiatives/charging-hubs", "/preview/initiatives/minigrid-verification"]);
    assert.equal(cards[0].headline.value, "61.51%");
    assert.equal(cards[0].progress?.share, 0.6151);
    assert.equal(cards[0].secondary?.value, "7");
    assert.equal(cards[1].headline.status, "not_available");
    assert.equal(cards[1].progress, null);
  });

  it("lists an initiative's roles, and answers null for an unknown one", () => {
    const picker = rolePicker("meter-every-customer");
    assert.deepEqual(picker?.roles.map((role) => [role.id, role.audience]), [
      ["customer", "public"],
      ["utility", "organization"],
      ["der", "organization"],
      ["financier", "organization"],
    ]);
    assert.equal(rolePicker("nowhere"), null);
  });

  it("sends a public role to its view, and an organization role to the hand-off with its demo workspace", () => {
    assert.deepEqual(rolePage("meter-every-customer", "customer", WORKSPACES, null), {
      kind: "public",
      view: { initiativeId: "meter-every-customer", initiativeTitle: "Meter every customer", roleLabel: "Customer", view: "meter-application" },
    });
    const handoff = rolePage("minigrid-verification", "regulator", WORKSPACES, "https://tenant.example/login");
    assert.equal(handoff?.kind, "sign-in");
    if (handoff?.kind !== "sign-in") return;
    assert.equal(handoff.view.signInHref, "https://tenant.example/login");
    assert.equal(handoff.view.demoName, "Demonstration Regulator (synthetic)");
    assert.equal(handoff.view.demoHref, "/preview/workspace/demo-regulator/initiatives/minigrid-verification");
    assert.equal(rolePage("meter-every-customer", "nobody", WORKSPACES, null), null);
  });

  it("frames a workspace: its header, the others to switch to, its rail and its reports", () => {
    const frame = workspaceFrame("demo-regulator", WORKSPACES);
    assert.equal(frame?.current.name, "Demonstration Regulator (synthetic)");
    assert.equal(frame?.current.initials, "DR");
    assert.equal(frame?.current.demo, true);
    assert.deepEqual(frame?.others.map((one) => one.id), ["demo-utility", "demo-financier"]);
    assert.deepEqual(frame?.rail.map((item) => item.href), ["/preview/workspace/demo-regulator", "/preview/workspace/demo-regulator/oversight"]);
    assert.equal(frame?.reportsHref, "/dashboard/reports");
    assert.equal(workspaceFrame("someone-else", WORKSPACES), null);
  });

  it("takes initials from the name, leaving out the bracket", () => {
    assert.equal(initialsOf("Savanna Electricity Distribution (synthetic)"), "SE");
    assert.equal(initialsOf("(synthetic)"), "GI");
  });

  it("shows a workspace its own initiatives, and an initiative's views for its type", () => {
    const utility = WORKSPACES[0];
    assert.deepEqual(workspaceHome(utility, figures).cards.map((one) => one.href), ["/preview/workspace/demo-utility/initiatives/meter-every-customer", "/preview/workspace/demo-utility/initiatives/charging-hubs"]);
    const meter = workspaceInitiative(utility, "meter-every-customer", figures);
    assert.equal(meter?.views[0].label, "Applications");
    assert.equal(meter?.views[0].planned, true);
    assert.equal(meter?.card.secondary?.value, "7");
    assert.equal(workspaceInitiative(utility, "minigrid-verification", figures), null);
  });

  it("gives a rail item its views and the one filled in NAV-A; Home and an item the type lacks are null", () => {
    const oversight = railItemPage(WORKSPACES[1], "oversight");
    assert.equal(oversight?.filled, "oversight.monitoring");
    assert.deepEqual(oversight?.views.map((view) => view.label), ["Monitoring", "Regulator view"]);
    assert.equal(railItemPage(WORKSPACES[1], "finance"), null);
    assert.equal(railItemPage(WORKSPACES[1], "home"), null);
  });
});
