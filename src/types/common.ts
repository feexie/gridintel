/* ==========================================================
   COMMON ENUMS
========================================================== */

export type Status =
  | "online"
  | "offline"
  | "warning"
  | "fault"
  | "maintenance"
  | "unknown";

export type Severity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

/* ==========================================================
   LOCATION
========================================================== */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/* ==========================================================
   AUDIT INFORMATION
========================================================== */

export interface Timestamp {
  createdAt: string;
  updatedAt: string;
  lastSeen: string;
}

/* ==========================================================
   COMMUNICATION
========================================================== */

export interface Communication {
  status: Status;

  protocol?: string;

  signalStrength?: number;

  latencyMs?: number;

  ipAddress?: string;

  firmwareVersion?: string;

  lastHeartbeat?: string;
}

/* ==========================================================
   EDGE DEVICE
========================================================== */

export interface EdgeDevice {
  id: string;

  online: boolean;

  firmwareVersion: string;

  serialNumber: string;

  manufacturer?: string;
}
