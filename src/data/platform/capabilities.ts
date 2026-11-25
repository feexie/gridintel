import type { PlatformCapability } from "@/types/platform";

export const platformCapabilities: PlatformCapability[] = [
  {
    id: "utility",
    title: "Utility Intelligence",
    image: "/images/platform/utility.jpg",
    imageModern: "/images/platform/utility.webp",
    view: "utility.overview",
    description:
      "Executive dashboards, operations management, asset intelligence, reliability analytics, outage management, revenue operations, and AI-assisted utility decision support.",
  },

  {
    id: "der",
    title: "DER Intelligence",
    image: "/images/platform/der.jpg",
    view: "der.overview",
    description:
      "Distributed energy resource monitoring, battery management, renewable asset analytics, forecasting, and portfolio intelligence.",
  },

  {
    id: "minigrid",
    title: "MiniGrid Intelligence",
    image: "/images/platform/minigrid.jpg",
    view: "minigrid.overview",
    description:
      "Mini-grid operations, customer management, commercial performance, asset monitoring, and portfolio oversight.",
  },

  {
    id: "planning",
    title: "Planning Intelligence",
    image: "/images/platform/planning.jpg",
    view: "plan.overview",
    description:
      "Network planning, electrification planning, demand forecasting, investment prioritization, and scenario modelling.",
  },

  {
    id: "gis",
    title: "GIS Intelligence",
    image: "/images/platform/gis.jpg",
    view: "platform.overview",
    description:
      "Spatial intelligence, digital network mapping, geospatial visualization, routing, and asset location services.",
  },

  {
    id: "ai",
    title: "AI Intelligence",
    image: "/images/platform/ai.jpg",
    view: "platform.intelligence-ai",
    description:
      "Predictive maintenance, anomaly detection, intelligent recommendations, outage prediction, and operational decision support.",
  },
];
