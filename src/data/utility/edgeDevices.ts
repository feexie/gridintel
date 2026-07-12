import type { EdgeDevice } from "@/types/utility";

export const edgeDevices: EdgeDevice[] = [
  {
    id: "EDGE-001",

    assetId: "ADM-SS-001",

    assetType: "substation",

    firmwareVersion: "1.3.2",

    signalStrength: 98,

    latencyMs: 18,

    batteryVoltage: 12.4,

    online: true,

    lastHeartbeat: "2026-07-11T09:45:12Z",
  },

  {
    id: "EDGE-002",

    assetId: "ADM-FD-001",

    assetType: "feeder",

    firmwareVersion: "1.2.8",

    signalStrength: 92,

    latencyMs: 24,

    online: true,

    lastHeartbeat: "2026-07-11T09:44:58Z",
  },

  {
    id: "EDGE-003",

    assetId: "ADM-TR-001",

    assetType: "transformer",

    firmwareVersion: "1.2.6",

    signalStrength: 61,

    latencyMs: 95,

    batteryVoltage: 11.8,

    online: false,

    lastHeartbeat: "2026-07-11T09:37:10Z",
  },
];
