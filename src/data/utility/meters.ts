import type { Meter } from "@/types/utility";

export const meters: Meter[] = [
  {
    id: "MTR-001",

    assetId: "ADM-TR-001",
    assetType: "transformer",

    serialNumber: "SN-10021",
    meterNumber: "MTR000001",

    manufacturer: "Hexing",
    model: "HXF300",

    customerName: "Federal Medical Centre",
    customerAccount: "ACC-0001",

    voltage: 233.8,
    current: 14.6,
    frequency: 50,
    powerFactor: 0.98,

    powerKw: 3.4,
    reactivePowerKvar: 0.6,
    apparentPowerKva: 3.5,
    demandKw: 3.8,

    energyKwh: 1420,

    status: "online",

    signalStrength: 95,

    communicationStatus: "online",

    tamperDetected: false,

    lastCommunication: "2026-07-10T09:10:05Z",

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-07-10T09:10:05Z",
    lastSeen: "2026-07-10T09:10:05Z",
  },

  {
    id: "MTR-002",

    assetId: "ADM-TR-001",
    assetType: "transformer",

    serialNumber: "SN-10022",
    meterNumber: "MTR000002",

    manufacturer: "Hexing",
    model: "HXF300",

    customerName: "Aisha Musa",
    customerAccount: "ACC-0002",

    voltage: 229.7,
    current: 8.9,
    frequency: 50,
    powerFactor: 0.97,

    powerKw: 2.1,
    reactivePowerKvar: 0.4,
    apparentPowerKva: 2.2,
    demandKw: 2.4,

    energyKwh: 1750,

    status: "online",

    signalStrength: 90,

    communicationStatus: "online",

    tamperDetected: false,

    lastCommunication: "2026-07-10T09:11:08Z",

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-07-10T09:11:08Z",
    lastSeen: "2026-07-10T09:11:08Z",
  },

  {
    id: "MTR-003",

    assetId: "ADM-FD-001",
    assetType: "feeder",

    serialNumber: "SN-10023",
    meterNumber: "MTR000003",

    manufacturer: "Hexing",
    model: "HXF300",

    customerName: "Yola Plaza",
    customerAccount: "ACC-0003",

    voltage: 206.4,
    current: 18.3,
    frequency: 49.8,
    powerFactor: 0.91,

    powerKw: 5.2,
    reactivePowerKvar: 1.4,
    apparentPowerKva: 5.4,
    demandKw: 5.8,

    energyKwh: 890,

    status: "warning",

    signalStrength: 54,

    communicationStatus: "warning",

    tamperDetected: true,

    lastCommunication: "2026-07-10T09:00:11Z",

    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-07-10T09:00:11Z",
    lastSeen: "2026-07-10T09:00:11Z",
  },
];
