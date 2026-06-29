import type { Substation } from "@/types/utility";

export const substations: Substation[] = [
  {
    id: "sub-001",
    name: "North Grid Substation",
    status: "online",
    location: { latitude: 6.5244, longitude: 3.3792 },
    transformers: 4,
    feeders: 6,
  },
  {
    id: "sub-002",
    name: "Central Utility Hub",
    status: "warning",
    location: { latitude: 6.5431, longitude: 3.3935 },
    transformers: 5,
    feeders: 8,
  },
  {
    id: "sub-003",
    name: "South Service Node",
    status: "online",
    location: { latitude: 6.4698, longitude: 3.5852 },
    transformers: 3,
    feeders: 4,
  },
];
