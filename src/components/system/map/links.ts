import type { LevelKind } from "@/services/operations/views";
import { levelHref } from "@/components/system/format";
import { hrefOf } from "@/constants/views";

/* Where a located entity's own screen is. An entity of a kind that has no screen has no link. */

const LEVELS: readonly string[] = ["region", "substation", "feeder", "distribution_transformer", "service_point"] satisfies LevelKind[];

export const MINIGRID_HOME = hrefOf("minigrid.overview");

export function siteHref(id: string): string {
  return hrefOf("minigrid.sites", id);
}

export function entityHref(kind: string, id: string): string | null {
  if (kind === "minigrid_site") return siteHref(id);
  return LEVELS.includes(kind) ? levelHref(kind as LevelKind, id) : null;
}
