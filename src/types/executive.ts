export interface UtilityRegion {
  id: string;
  name: string;

  substations: number;
  feeders: number;
  transformers: number;

  customers: number;

  prepaidMeters: number;
  postpaidMeters: number;
  postpaidCustomers: number;

  revenueBilled: number;
  revenueCollected: number;

  collectionEfficiency: number;

  technicalLosses: number;
  commercialLosses: number;
  atccLosses: number;

  saidi: number;
  saifi: number;
}

export interface ExecutiveEvent {
  id: string;

  region: string;

  substation: string;

  feeder: string;

  status:
    | "OUTAGE"
    | "RESTORED"
    | "FAULT"
    | "WARNING";

  timestamp: string;

  customersAffected: number;
}
