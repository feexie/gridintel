import type { AttentionItemView, PlatformOverviewView, SectorOverviewView } from "../overview/views.ts";
import { byLargestDifference } from "../operations/comparison.ts";
import { mergeSourcing } from "../operations/metric.ts";

/* ==========================================================
   SERVICES — PLATFORM OVERVIEW

   What a first-time visitor is shown of each sector: a few lines of
   that sector's own Overview. Nothing is found, ranked or calculated
   here. Which lines are shown is decided by one printed rule, so the
   screen cuts nothing itself.

   A report that differs from the records is what GridIntel exists to
   show, so a sector's largest such difference is always among its
   lines when it has one; the sector's own Overview puts the largest
   first.
========================================================== */

/** How many lines of each sector the Platform Overview shows. */
export const PLATFORM_FINDINGS_PER_SECTOR = 3;

/** The rule whose lines set a report against the records, in every sector. */
export const REPORT_RULE = "report_differs";

export const PLATFORM_SELECTION_RULE = `For each sector, up to ${PLATFORM_FINDINGS_PER_SECTOR} lines of its Overview, in the Overview's own order: its largest difference between a report and the records, when there is one, and the first line of each other rule. The sector's Overview holds them all.`;

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

/**
 * The line of the report rule whose difference is largest, when there is one, and the first line
 * of each other rule, up to the limit, in the order given. A report line leads with its largest
 * difference, so lines are compared by their first comparison.
 */
export function platformLines(attention: readonly AttentionItemView[], limit: number): AttentionItemView[] {
  const reports = attention.filter((item) => item.rule === REPORT_RULE && item.comparisons.length > 0);
  const [report] = [...reports].sort((a, b) => byLargestDifference(a.comparisons[0], b.comparisons[0]));
  const others = firstOfEachRule(
    attention.filter((item) => item.rule !== REPORT_RULE),
    report === undefined ? limit : limit - 1,
  );
  const chosen = new Set([...(report === undefined ? [] : [report]), ...others]);
  return attention.filter((item) => chosen.has(item));
}

export function platformOverviewView(sectors: readonly SectorOverviewView[]): PlatformOverviewView {
  return {
    sectors: sectors.map((sector) => {
      const findings = platformLines(sector.attention, PLATFORM_FINDINGS_PER_SECTOR);
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
