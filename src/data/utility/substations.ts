import type { Substation } from "@/types/utility";

export const substations: Substation[] = [
  {
    id: "ADM-SS-001",

    regionId: "adamawa",

    name: "Jimeta 132/33kV Injection Substation",

    status: "online",

    location: {
      latitude: 9.3265,
      longitude: 12.4448,
    },

    voltageLevel: "132/33kV",

    installedCapacityMva: 90,

    availableCapacityMva: 74,

    currentLoadMw: 56.8,

    transformers: 4,

    feeders: 12,

    voltageKv: 33,

    currentAmp: 1210,

    frequencyHz: 50,

    powerFactor: 0.96,

    communicationStatus: "online",

    edgeDeviceOnline: true,

    createdAt: "2026-01-01",

    updatedAt: "2026-07-10T09:00:00Z",

    lastSeen: "2026-07-10T11:52:00Z",
  },
];
