import type { Citation, DataSource, Hub, HubOperator, HubPledge, HubSwapDay } from "@/domain";

/* What the e-mobility planner holds: hubs (candidate, planned and installed), their operators,
   funders' pledges to hubs, the swaps installed hubs record, the citations hub records name (the
   solar resource), and the sources of the records. The adapter returns the records as held; it
   never totals, matches or scores them. */
export interface EmobilityRepository {
  hubs(): Promise<readonly Hub[]>;
  operators(): Promise<readonly HubOperator[]>;
  pledges(): Promise<readonly HubPledge[]>;
  swapDays(): Promise<readonly HubSwapDay[]>;
  citations(): Promise<readonly Citation[]>;
  sources(): Promise<readonly DataSource[]>;
}
