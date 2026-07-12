import type { Feeder } from "@/types/utility";

export const feeders: Feeder[] = [
  {
    id: "ADM-FD-001",

    regionId: "adamawa",

    substationId: "ADM-SS-001",

    name: "Jimeta Feeder 01",

    feederCode: "JF-01",

    status: "online",

    allocatedMw: 18,

    currentLoadMw: 14.6,

    customers: 5234,

    transformers: 47,

    smartMeters: 4589,

    outageHours: 3.2,

    saidi: 1.8,

    saifi: 0.7,

    technicalLoss: 6.2,

    commercialLoss: 4.1,

    voltageKv: 33,

    currentAmp: 480,

    powerFactor: 0.97,

    communicationStatus: "online",

    createdAt: "2026-01-01",

    updatedAt: "2026-07-10T09:00:00Z",

    lastSeen: "2026-07-10T11:52:00Z",
  },
];
