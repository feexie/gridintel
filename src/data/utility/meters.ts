import type { Meter } from "@/types/utility";

export const meters: Meter[] = [
  { id: "meter-001", serialNumber: "SN-10021", status: "online", consumptionKwh: 1420 },
  { id: "meter-002", serialNumber: "SN-10022", status: "online", consumptionKwh: 1750 },
  { id: "meter-003", serialNumber: "SN-10023", status: "warning", consumptionKwh: 890 },
];
