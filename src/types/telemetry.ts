import type { Status, Timestamp } from "./common";

export interface ElectricalTelemetry extends Timestamp {
  voltage: number;

  current: number;

  powerKw: number;

  energyKwh: number;

  frequency: number;

  powerFactor: number;

  demandKw: number;

  status: Status;
}

export interface CommunicationTelemetry {
  communicationStatus: Status;

  signalStrength?: number;

  latencyMs?: number;

  lastCommunication: string;
}

export interface EdgeTelemetry {
  edgeDeviceOnline: boolean;

  firmwareVersion?: string;

  batteryVoltage?: number;

  lastHeartbeat?: string;
}

export interface HealthTelemetry {
  healthScore: number;

  alarmCount: number;

  activeFaults: number;

  maintenanceDue: boolean;

  predictedFailure: boolean;
}
