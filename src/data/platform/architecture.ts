import type { ArchitectureStep } from "@/types/platform";

export const architecture: ArchitectureStep[] = [
  {
    id: 1,
    title: "Edge Devices",
    description:
      "Smart meters, sensors, relays, transformers and field IoT devices continuously collect operational data.",
    image: "/images/platform/edge.jpg",
  },
  {
    id: 2,
    title: "Secure Cloud Platform",
    description:
      "Operational data is securely synchronized to the GridIntel cloud for processing and storage.",
    image: "/images/platform/cloud.jpg",
  },
  {
    id: 3,
    title: "AI Intelligence",
    description:
      "Machine learning detects anomalies, predicts failures and generates recommendations.",
    image: "/images/platform/ai.jpg",
  },
  {
    id: 4,
    title: "Decision Support",
    description:
      "Executives and operators access actionable insights through role-based dashboards.",
    image: "/images/platform/utility.jpg",
  },
];
