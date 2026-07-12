import type { Region } from "@/types/utility";

export const regions: Region[] = [
  {
    id: "adamawa",

    name: "Adamawa",

    status: "online",

    substations: 12,

    feeders: 86,

    transformers: 624,

    customers: 348520,

    activeOutages: 2,

    activeAlarms: 9,

    saidi: 3.4,

    saifi: 1.1,

    atccLosses: 23.6,

    collectionEfficiency: 91.8,

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-12T09:00:00Z",

    lastSeen: "2026-07-12T09:45:00Z",
  },

  {
    id: "borno",

    name: "Borno",

    status: "warning",

    substations: 8,

    feeders: 54,

    transformers: 403,

    customers: 218300,

    activeOutages: 5,

    activeAlarms: 14,

    saidi: 5.8,

    saifi: 2.3,

    atccLosses: 31.2,

    collectionEfficiency: 84.1,

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-12T09:00:00Z",

    lastSeen: "2026-07-12T09:42:00Z",
  },

  {
    id: "yobe",

    name: "Yobe",

    status: "online",

    substations: 6,

    feeders: 39,

    transformers: 288,

    customers: 141220,

    activeOutages: 1,

    activeAlarms: 4,

    saidi: 2.1,

    saifi: 0.8,

    atccLosses: 20.9,

    collectionEfficiency: 92.6,

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-12T09:00:00Z",

    lastSeen: "2026-07-12T09:44:00Z",
  },

  {
    id: "taraba",

    name: "Taraba",

    status: "maintenance",

    substations: 5,

    feeders: 28,

    transformers: 214,

    customers: 102880,

    activeOutages: 3,

    activeAlarms: 7,

    saidi: 4.6,

    saifi: 1.6,

    atccLosses: 27.4,

    collectionEfficiency: 86.5,

    createdAt: "2026-01-01T00:00:00Z",

    updatedAt: "2026-07-12T09:00:00Z",

    lastSeen: "2026-07-12T09:39:00Z",
  },
];
