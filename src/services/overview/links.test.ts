import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AttentionItemView, PlatformOverviewView, SectorOverviewView } from "./views.ts";
import { cutPlatformOverview, cutSectorOverview, targetKey } from "./links.ts";

/* A viewer is never shown a link they would be refused at (ADR 0018, Phase 8A): the overviews'
   links are cut to the grant, and their lines are kept. */

const SOURCING = { synthetic: true, sources: [] } as unknown as SectorOverviewView["sourcing"];

const line = (id: string, target: AttentionItemView["target"]): AttentionItemView =>
  ({ id, rule: "r", tone: "note", kind: "k", statement: "s", figure: null, figureSigned: false, figureNote: null, more: [], comparisons: [], ruleText: "t", target, targetLabel: "Open" }) as AttentionItemView;

const UTILITY: SectorOverviewView = {
  sector: "utility",
  title: "Utility Intelligence",
  organization: "Savanna (synthetic)",
  attention: [line("a", { type: "workspace", workspace: "utility.revenue" }), line("b", { type: "level", kind: "feeder", id: "FD-OLD" }), line("c", { type: "section", id: "x" })],
  attentionNote: null,
  headline: [],
  workspaces: [
    { workspace: "utility.revenue", label: "Revenue", question: "?" },
    { workspace: "utility.events", label: "Events", question: "?" },
  ],
  sourcing: SOURCING,
};

/** The revenue department of ADR 0018. */
const REVENUE = new Set(["utility.overview", "utility.map", "utility.revenue"]);
const opens = (key: string) => REVENUE.has(key);

describe("links cut to the viewer's grant", () => {
  it("names the screen each kind of line leads to", () => {
    assert.equal(targetKey({ type: "level", kind: "feeder", id: "F" }), "utility.operations");
    assert.equal(targetKey({ type: "site", id: "S" }), "minigrid.sites");
    assert.equal(targetKey({ type: "section", id: "x" }), null);
  });

  it("keeps every line, without a link where its screen is not open, and leaves out the ways in that are not", () => {
    const cut = cutSectorOverview(UTILITY, opens);
    assert.deepEqual(cut.attention.map((item) => item.target.type), ["workspace", "none", "section"]);
    assert.deepEqual(cut.workspaces.map((link) => link.workspace), ["utility.revenue"]);
    assert.deepEqual(cut.waysIn, { map: true, assistant: false });
  });

  it("marks a sector whose Overview is not open, and names the sectors that may be entered", () => {
    const platform: PlatformOverviewView = {
      sectors: [{ sector: "utility", title: "Utility Intelligence", organization: null, findings: UTILITY.attention, findingsTotal: 3, findingsMore: 0, headline: [] }],
      selectionRule: "rule",
      sourcing: SOURCING,
    };
    const cut = cutPlatformOverview(platform, (key) => key === "utility.revenue", ["utility"]);
    assert.equal(cut.sectors[0].overviewOpen, false);
    assert.deepEqual(cut.openSectors, ["utility"]);
    assert.deepEqual(cut.sectors[0].findings.map((item) => item.target.type), ["workspace", "none", "section"]);
  });
});
