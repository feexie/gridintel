import type { DataQuality } from "@/domain";

/* ==========================================================
   ANALYTICS — DATA QUALITY RANKING

   DataQuality is categorical. Its conceptual severity order is
   defined here, explicitly, and nowhere else. Never compare
   DataQuality values as strings or by declaration order.
========================================================== */

const QUALITY_RANK: Record<DataQuality, number> = {
  measured: 0,
  estimated: 1,
  substituted: 2,
  suspect: 3,
  missing: 4,
};

/** Higher is worse: measured 0, estimated 1, substituted 2, suspect 3, missing 4. */
export function qualityRank(quality: DataQuality): number {
  return QUALITY_RANK[quality];
}

/** The worst quality in the list, or null when the list is empty. */
export function worstQuality(qualities: readonly DataQuality[]): DataQuality | null {
  let worst: DataQuality | null = null;
  for (const quality of qualities) {
    if (worst === null || qualityRank(quality) > qualityRank(worst)) worst = quality;
  }
  return worst;
}
