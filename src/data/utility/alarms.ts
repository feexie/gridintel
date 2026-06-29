import type { Alarm } from "@/types/utility";

export const alarms: Alarm[] = [
  {
    id: "alm-001",
    title: "Transformer load nearing threshold",
    status: "warning",
    severity: "warning",
    source: "TR-22",
  },
  {
    id: "alm-002",
    title: "Feeder trip detected",
    status: "online",
    severity: "critical",
    source: "Feeder B2",
  },
  {
    id: "alm-003",
    title: "Meter communication delay",
    status: "warning",
    severity: "info",
    source: "SN-10023",
  },
];
