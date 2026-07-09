import type { ArchitectureStep } from "@/types/platform";

export const architecture: ArchitectureStep[] = [
  {
    id: "edge",
    title: "Intelligent Edge",
    description:
      "Smart meters, feeder monitors, transformer sensors, RTUs and IoT devices continuously capture operational data across the electricity network.",
  },

  {
    id: "cloud",
    title: "Cloud Platform",
    description:
      "Operational data is securely transmitted to the GridIntel cloud for ingestion, storage, synchronization and event processing.",
  },

  {
    id: "intelligence",
    title: "Intelligence Engine",
    description:
      "Artificial Intelligence, GIS, analytics and forecasting transform raw telemetry into actionable operational intelligence.",
  },

  {
    id: "sector",
    title: "Sector Intelligence",
    description:
      "Each industry sector receives specialized dashboards, workflows and operational tools tailored to its business processes.",
  },

  {
    id: "decision",
    title: "Decision Support",
    description:
      "Executives, engineers and operators receive real-time insights, alerts and recommendations for faster decision making.",
  },
];
