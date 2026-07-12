import type { Meter } from "@/types/utility";

export const meters: Meter[] = [
  {
    id: "ADM-MTR-001",

    serialNumber: "SN-10021",

    customerName: "Federal Medical Centre",

    status: "online",

    parentAssetType: "transformer",

    parentAssetId: "ADM-TR-001",

    voltage: 233.8,

    current: 14.6,

    frequency: 50.02,

    powerFactor: 0.98,

    powerKw: 3.40,

    reactivePowerKvar: 0.62,

    apparentPowerKva: 3.46,

    energyKwh: 1420,

    signalStrength: 95,

    tamperDetected: false,

    lastReading: "2026-07-10T09:10:00Z",

    lastCommunication: "2026-07-10T09:10:05Z",

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-10T09:10:05Z",

    lastSeen: "2026-07-10T09:10:05Z",
  },

  {
    id: "ADM-MTR-002",

    serialNumber: "SN-10022",

    customerName: "Aisha Musa",

    status: "online",

    parentAssetType: "transformer",

    parentAssetId: "ADM-TR-001",

    voltage: 229.7,

    current: 8.9,

    frequency: 49.98,

    powerFactor: 0.96,

    powerKw: 2.10,

    reactivePowerKvar: 0.54,

    apparentPowerKva: 2.17,

    energyKwh: 1750,

    signalStrength: 90,

    tamperDetected: false,

    lastReading: "2026-07-10T09:11:00Z",

    lastCommunication: "2026-07-10T09:11:08Z",

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-10T09:11:08Z",

    lastSeen: "2026-07-10T09:11:08Z",
  },

  {
    id: "ADM-MTR-003",

    serialNumber: "SN-10023",

    customerName: "Yola Plaza",

    status: "warning",

    parentAssetType: "transformer",

    parentAssetId: "ADM-TR-002",

    voltage: 206.4,

    current: 18.3,

    frequency: 49.72,

    powerFactor: 0.88,

    powerKw: 5.20,

    reactivePowerKvar: 2.80,

    apparentPowerKva: 5.91,

    energyKwh: 890,

    signalStrength: 54,

    tamperDetected: true,

    lastReading: "2026-07-10T08:59:00Z",

    lastCommunication: "2026-07-10T09:00:11Z",

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-10T09:00:11Z",

    lastSeen: "2026-07-10T09:00:11Z",
  },
];
