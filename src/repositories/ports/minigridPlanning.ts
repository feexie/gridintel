import type { Citation, DataSource, PlannedCommunity } from "@/domain";

/* What the mini-grid planner holds of its own: the communities a mini-grid is planned for, the
   citations their records name (the solar resource) and the sources of the records. The
   reference sites a plan rests on come from ReferenceSiteRepository. The adapter returns the
   records as held; it never sizes, totals or scores them. */
export interface PlannedCommunityRepository {
  communities(): Promise<readonly PlannedCommunity[]>;
  citations(): Promise<readonly Citation[]>;
  sources(): Promise<readonly DataSource[]>;
}
