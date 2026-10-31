import type { DataSource, MeterApplication, MeterPledge } from "@/domain";

/* What the metering marketplace holds: funders' pledges, the meter applications DisCos have
   approved, and the sources of those records. The adapter returns the records as held; it never
   totals or matches them. */
export interface MarketplaceRepository {
  pledges(): Promise<readonly MeterPledge[]>;
  applications(): Promise<readonly MeterApplication[]>;
  sources(): Promise<readonly DataSource[]>;
}
