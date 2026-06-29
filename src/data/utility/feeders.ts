import type { Feeder } from "@/types/utility";

export const feeders: Feeder[] = [
  { id: "fed-001", name: "Feeder A1", status: "online", loadMw: 14.2, customers: 4520 },
  { id: "fed-002", name: "Feeder B2", status: "warning", loadMw: 18.9, customers: 5180 },
  { id: "fed-003", name: "Feeder C3", status: "online", loadMw: 11.7, customers: 3960 },
];
