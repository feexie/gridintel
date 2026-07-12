import type { Transformer } from "@/types/utility";

export const transformers: Transformer[] = [
  {
    id: "ADM-TR-001",

    feederId: "ADM-FD-001",

    name: "Jimeta DT-01",

    status: "online",

    ratingKva: 500,

    loadPercent: 68,

    voltageKv: 0.415,

    currentAmp: 695,

    temperature: 47,

    customers: 162,

    smartMeters: 160,

    lastMaintenance: "2026-05-12",

    communicationStatus: "online",

    edgeDeviceOnline: true,

    createdAt: "2026-01-01",

    updatedAt: "2026-07-10T09:00:00Z",

    lastSeen: "2026-07-10T11:52:00Z",
  },

  {
    id: "ADM-TR-002",

    feederId: "ADM-FD-001",

    name: "Jimeta DT-02",

    status: "warning",

    ratingKva: 300,

    loadPercent: 91,

    voltageKv: 0.415,

    currentAmp: 623,

    temperature: 76,

    customers: 118,

    smartMeters: 115,

    lastMaintenance: "2025-12-08",

    communicationStatus: "warning",

    edgeDeviceOnline: true,

    createdAt: "2026-01-01",

    updatedAt: "2026-07-10T09:00:00Z",

    lastSeen: "2026-07-10T11:51:42Z",
  },

  {
    id: "ADM-TR-003",

    feederId: "ADM-FD-001",

    name: "Jimeta DT-03",

    status: "maintenance",

    ratingKva: 500,

    loadPercent: 0,

    voltageKv: 0.415,

    currentAmp: 0,

    temperature: 32,

    customers: 205,

    smartMeters: 202,

    lastMaintenance: "2026-07-08",

    communicationStatus: "offline",

    edgeDeviceOnline: false,

    createdAt: "2026-01-01",

    updatedAt: "2026-07-10T09:00:00Z",

    lastSeen: "2026-07-08T18:20:00Z",
  },
];
