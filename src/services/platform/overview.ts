import type { AttentionItemView, PlatformOverviewView, SectorOverviewView } from "../overview/views.ts";
import { mergeSourcing } from "../operations/metric.ts";

/* ==========================================================
   SERVICES — PLATFORM OVERVIEW

   What a first-time visitor is shown of each sector: the first few
   lines of that sector's own Overview. Nothing is found, ranked or
   calculated here. Which lines are shown is decided by one printed
   rule, so the screen cuts nothing itself.
========================================================== */

/** How many lines of each sector the Platform Overview shows. */
export const PLATFORM_FINDINGS_PER_SECTOR = 3;

export const PLATFORM_SELECTION_RULE = `For each sector: the first line of each rule of its Overview, in the Overview's own order, up to ${PLATFORM_FINDINGS_PER_SECTOR}. The sector's Overview holds them all.`;

/** The first line of each rule, in the order given, up to the limit. */
export function firstOfEachRule(attention: readonly AttentionItemView[], limit: number): AttentionItemView[] {
  const seen = new Set<string>();
  const chosen: AttentionItemView[] = [];
  for (const item of attention) {
    if (seen.has(item.rule)) continue;
    seen.add(item.rule);
    chosen.push(item);
    if (chosen.length === limit) break;
  }
  return chosen;
}

export function platformOverviewView(sectors: readonly SectorOverviewView[]): PlatformOverviewView {
  return {
    sectors: sectors.map((sector) => {
      const findings = firstOfEachRule(sector.attention, PLATFORM_FINDINGS_PER_SECTOR);
      return {
        sector: sector.sector,
        title: sector.title,
        organization: sector.organization,
        findings,
        findingsTotal: sector.attention.length,
        findingsMore: sector.attention.length - findings.length,
        headline: sector.headline,
      };
    }),
    selectionRule: PLATFORM_SELECTION_RULE,
    sourcing: sectors.map((sector) => sector.sourcing).reduce(mergeSourcing, { synthetic: false, sources: [] }),
  };
}
