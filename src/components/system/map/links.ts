import type { LevelKind } from "@/services/operations/views";
import { levelHref } from "@/components/system/format";

/* Where a located entity's own screen is. An entity of a kind that has no screen has no link. */

const LEVELS: readonly string[] = ["region", "substation", "feeder", "distribution_transformer", "service_point"] satisfies LevelKind[];

export const MINIGRID_HOME = "/dashboard/minigrid";

export function siteHref(id: string): string {
  return `${MINIGRID_HOME}/sites/${encodeURIComponent(id)}`;
}

export function entityHref(kind: string, id: string): string | null {
  if (kind === "minigrid_site") return siteHref(id);
  return LEVELS.includes(kind) ? levelHref(kind as LevelKind, id) : null;
}
