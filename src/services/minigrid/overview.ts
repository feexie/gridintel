import type { AttentionItemView, AttentionTone, MinigridOverviewView, WorkspaceLinkView } from "../overview/views.ts";
import type { MinigridPortfolioView } from "./views.ts";

/* ==========================================================
   SERVICES — MINI-GRID OVERVIEW

   "What needs attention here?" for the Mini-grid sector. It is the
   portfolio read model's own "what stands out", line for line and
   in the same order, in the shape every sector's overview has. It
   finds nothing itself and adds no figure.
========================================================== */

export const MINIGRID_WORKSPACE_LINKS: WorkspaceLinkView[] = [
  { workspace: "minigrid.sites", label: "Sites", question: "Which sites are underperforming and why, and do their reports match the records?" },
];

/** A report that differs from the records is the finding a funder's check exists for; the others are operating facts. */
const TONE: Record<string, AttentionTone> = { report_differs: "alert", fuel_per_kwh: "watch", pv_held_back: "watch", uncollected: "watch", class_pays_least: "note" };

export function minigridOverviewView(portfolio: MinigridPortfolioView): MinigridOverviewView {
  const attention: AttentionItemView[] = portfolio.findings.map((found) => {
    const [figure, ...more] = found.figures;
    return {
      id: `${found.rule}:${found.site?.id ?? "portfolio"}`,
      rule: found.rule,
      tone: TONE[found.rule] ?? "note",
      kind: found.title,
      statement: found.statement,
      figure: figure ?? null,
      figureSigned: false,
      figureNote: null,
      more,
      comparisons: found.comparisons,
      ruleText: found.ruleText,
      target: found.site === null ? { type: "workspace", workspace: "minigrid.sites" } : { type: "site", id: found.site.id },
      targetLabel: found.site === null ? "Open Sites" : `Open ${found.site.name}`,
    };
  });

  return {
    sector: "minigrid",
    title: "Mini-grid Intelligence",
    organization: portfolio.operator,
    completeness: portfolio.completeness,
    attention,
    attentionNote:
      portfolio.completeness === "not_available"
        ? "No source of mini-grid sites is connected, so there is nothing to show."
        : portfolio.completeness === "partial"
          ? "The list of sites is not complete: a site may exist that is not shown here."
          : attention.length === 0
            ? "None of the five rules lists anything for this period."
            : null,
    headline: [],
    sites: portfolio.sites.map((site) => ({
      id: site.id,
      name: site.name,
      plant: site.plant,
      renewableFraction: site.renewableFraction,
      availability: site.availability,
      collectionEfficiency: site.collectionEfficiency,
    })),
    workspaces: MINIGRID_WORKSPACE_LINKS,
    sourcing: portfolio.sourcing,
  };
}
