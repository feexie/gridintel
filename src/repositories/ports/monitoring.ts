import type { DataSource, MeteringMonitoringRecord } from "@/domain";

/* What monitoring of the metering programme holds: each DisCo's quarter as recorded (installs,
   verified installs, supply, consumption, escrow, investor repayments), and the sources of those
   records. The adapter returns the records as held; it never totals them. */
export interface MonitoringRepository {
  records(): Promise<readonly MeteringMonitoringRecord[]>;
  sources(): Promise<readonly DataSource[]>;
}
