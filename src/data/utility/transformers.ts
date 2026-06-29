import type { Transformer } from "@/types/utility";

export const transformers: Transformer[] = [
  { id: "tr-001", name: "TR-11", status: "online", ratingMva: 15, loadPercent: 68 },
  { id: "tr-002", name: "TR-22", status: "warning", ratingMva: 20, loadPercent: 91 },
  { id: "tr-003", name: "TR-33", status: "online", ratingMva: 10, loadPercent: 54 },
];
