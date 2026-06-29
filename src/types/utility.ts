import type { Coordinates, Status } from "./common";

export interface Substation {
  id: string;
  name: string;
  status: Status;
  location: Coordinates;
  transformers: number;
  feeders: number;
}

export interface Feeder {
  id: string;
  name: string;
  status: Status;
  loadMw: number;
  customers: number;
}

export interface Transformer {
  id: string;
  name: string;
  status: Status;
  ratingMva: number;
  loadPercent: number;
}

export interface Meter {
  id: string;
  serialNumber: string;
  status: Status;
  consumptionKwh: number;
}

export interface Alarm {
  id: string;
  title: string;
  status: Status;
  severity: "critical" | "warning" | "info";
  source: string;
}

export interface RevenueRecord {
  id: string;
  period: string;
  amount: number;
  collectionRate: number;
}
