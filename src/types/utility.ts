import type {
  Coordinates,
  Severity,
  Status,
  Timestamp,
} from "./common";

/* ===========================================================
   REGION
=========================================================== */

export interface Region extends Timestamp {
  id: string;

  name: string;

  status: Status;

  substations: number;

  feeders: number;

  transformers: number;

  customers: number;

  activeOutages: number;

  activeAlarms: number;

  saidi: number;

  saifi: number;

  atccLosses: number;

  collectionEfficiency: number;
}

/* ===========================================================
   SUBSTATION
=========================================================== */

export interface Substation extends Timestamp {
  id: string;

  regionId: string;

  name: string;

  status: Status;

  location: Coordinates;

  voltageLevel: string;

  installedCapacityMva: number;

  availableCapacityMva: number;

  currentLoadMw: number;

  transformers: number;

  feeders: number;

  voltageKv: number;

  currentAmp: number;

  frequencyHz: number;

  powerFactor: number;

  communicationStatus: Status;

  edgeDeviceOnline: boolean;
}

/* ===========================================================
   FEEDER
=========================================================== */

export interface Feeder extends Timestamp {
  id: string;

  regionId: string;

  substationId: string;

  name: string;

  feederCode: string;

  status: Status;

  allocatedMw: number;

  currentLoadMw: number;

  customers: number;

  transformers: number;

  smartMeters: number;

  outageHours: number;

  saidi: number;

  saifi: number;

  technicalLoss: number;

  commercialLoss: number;

  voltageKv: number;

  currentAmp: number;

  powerFactor: number;

  communicationStatus: Status;
}

/* ===========================================================
   TRANSFORMER
=========================================================== */

export interface Transformer extends Timestamp {
  id: string;

  feederId: string;

  name: string;

  status: Status;

  ratingKva: number;

  loadPercent: number;

  voltageKv: number;

  currentAmp: number;

  temperature: number;

  customers: number;

  smartMeters: number;

  lastMaintenance: string;

  communicationStatus: Status;

  edgeDeviceOnline: boolean;
}

/* ===========================================================
   SMART METER
=========================================================== */

export interface Meter extends Timestamp {
  id: string;

  /*
   * Where is this meter installed?
   */
  assetId: string;

  assetType:
    | "substation"
    | "feeder"
    | "transformer"
    | "customer"
    | "md"
    | "der"
    | "generator"
    | "battery";

  /*
   * Meter Information
   */
  serialNumber: string;

  meterNumber: string;

  manufacturer?: string;

  model?: string;

  /*
   * Customer information
   * Empty when meter belongs to feeder,
   * transformer or substation.
   */
  customerName?: string;

  customerAccount?: string;

  /*
   * Electrical Measurements
   */

  voltage: number;

  current: number;

  frequency: number;

  powerFactor: number;

  powerKw: number;

  reactivePowerKvar: number;

  apparentPowerKva: number;

  demandKw: number;

  energyKwh: number;

  /*
   * Health
   */

  status: Status;

  tamperDetected: boolean;

  signalStrength: number;

  communicationStatus: Status;

  lastCommunication: string;
}
  

/* ===========================================================
   ALARMS
=========================================================== */

export interface Alarm extends Timestamp {
  id: string;

  assetId: string;

  assetType:
    | "substation"
    | "feeder"
    | "transformer"
    | "meter";

  title: string;

  description: string;

  severity: Severity;

  status: Status;

  source: string;

  acknowledged: boolean;
}

/* ===========================================================
   OUTAGES
=========================================================== */

export interface Outage extends Timestamp {
  id: string;

  regionId: string;

  substationId: string;

  feederId: string;

  transformerId?: string;

  planned: boolean;

  cause: string;

  customersAffected: number;

  startTime: string;

  restorationTime?: string;

  durationMinutes: number;

  energyNotSuppliedMwh: number;

  saidiContribution: number;

  saifiContribution: number;
}

/* ===========================================================
   RELIABILITY
=========================================================== */

export interface ReliabilityMetrics {
  reportingPeriod: string;

  saidi: number;

  saifi: number;

  caidi: number;

  caifi: number;

  asai: number;

  availability: number;

  outageHours: number;

  interruptedCustomers: number;

  restoredCustomers: number;
}

/* ===========================================================
   EDGE DEVICE
=========================================================== */

export interface EdgeDevice {
  id: string;

  assetId: string;

  assetType:
    | "substation"
    | "feeder"
    | "transformer"
    | "meter";

  firmwareVersion: string;

  signalStrength: number;

  latencyMs: number;

  batteryVoltage?: number;

  online: boolean;

  lastHeartbeat: string;
}

/* ===========================================================
   REVENUE
=========================================================== */

export interface RevenueRecord {
  id: string;

  period: string;

  amount: number;

  collectionRate: number;
}
