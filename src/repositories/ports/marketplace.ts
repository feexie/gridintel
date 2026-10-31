import type { DataSource, MeterApplication, MeterJourneyRecord, MeterPledge } from "@/domain";

/* What the metering marketplace holds: funders' pledges, the meter applications DisCos have
   approved, and the sources of those records. The adapter returns the records as held; it never
   totals or matches them. */
export interface MarketplaceRepository {
  pledges(): Promise<readonly MeterPledge[]>;
  applications(): Promise<readonly MeterApplication[]>;
  /** Households followed from application to repayment. */
  journeys(): Promise<readonly MeterJourneyRecord[]>;
  sources(): Promise<readonly DataSource[]>;
}
