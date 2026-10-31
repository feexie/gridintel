import type { AttentionItemView, AttentionTarget, PlatformOverviewView, SectorOverviewView } from "./views.ts";

/* ==========================================================
   SERVICES — LINKS CUT TO THE VIEWER'S GRANT (Phase 8A, ADR 0018)

   An overview leads into the screens behind its lines. A viewer is
   never shown a link they would be refused at, so before an
   overview is handed to the screen its links are cut to what the
   viewer may open:

   - the "Go to" ways in: a workspace, the sector's map or its
     assistant the viewer may not open is left out;
   - a line's link: the line is kept, with no link, when the screen
     it leads to is not open to the viewer;
   - the Platform Overview: a sector the viewer holds nothing of is
     left out, and its "open the overview" link when its Overview is
     not open to them.

   `opens` answers for a permission key (constants/access.ts); the
   composition root passes it. Nothing is computed here.
========================================================== */

export type Opens = (key: string) => boolean;

/** The permission key of the screen a line leads to; null for a part of the same screen. */
export function targetKey(target: AttentionTarget): string | null {
  switch (target.type) {
    case "level":
      return "utility.operations";
    case "site":
      return "minigrid.sites";
    case "workspace":
      return target.workspace;
    case "section":
    case "none":
      return null;
  }
}

function cutItem(item: AttentionItemView, opens: Opens): AttentionItemView {
  const key = targetKey(item.target);
  return key === null || opens(key) ? item : { ...item, target: { type: "none" } };
}

export function cutSectorOverview<T extends SectorOverviewView>(view: T, opens: Opens): T {
  return {
    ...view,
    attention: view.attention.map((item) => cutItem(item, opens)),
    workspaces: view.workspaces.filter((link) => opens(link.workspace)),
    waysIn: { map: opens(`${view.sector}.map`), assistant: opens(`${view.sector}.ai`) },
  };
}

export function cutPlatformOverview(view: PlatformOverviewView, opens: Opens, openSectors: readonly string[]): PlatformOverviewView {
  return {
    ...view,
    sectors: view.sectors.map((sector) => ({ ...sector, findings: sector.findings.map((item) => cutItem(item, opens)), overviewOpen: opens(`${sector.sector}.overview`) })),
    openSectors,
  };
}
