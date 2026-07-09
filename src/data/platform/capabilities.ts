import type { PlatformCapability } from "@/types/platform";

export const platformCapabilities: PlatformCapability[] = [
  {
    id: "utility",
    title: "Utility Intelligence",
    image: "/images/platform/utility.jpg",
    href: "/dashboard/utility",
    description:
      "Executive dashboards, operations management, asset intelligence, reliability analytics, outage management, revenue operations, and AI-assisted utility decision support.",
  },

  {
    id: "der",
    title: "DER Intelligence",
    image: "/images/platform/der.jpg",
    href: "/dashboard/der",
    description:
      "Distributed energy resource monitoring, battery management, renewable asset analytics, forecasting, and portfolio intelligence.",
  },

  {
    id: "minigrid",
    title: "MiniGrid Intelligence",
    image: "/images/platform/minigrid.jpg",
    href: "/dashboard/minigrid",
    description:
      "Mini-grid operations, customer management, commercial performance, asset monitoring, and portfolio oversight.",
  },

  {
    id: "planning",
    title: "Planning Intelligence",
    image: "/images/platform/planning.jpg",
    href: "/dashboard/planning",
    description:
      "Network planning, electrification planning, demand forecasting, investment prioritization, and scenario modelling.",
  },

  {
    id: "gis",
    title: "GIS Intelligence",
    image: "/images/platform/gis.jpg",
    href: "/dashboard/intelligence/gis",
    description:
      "Spatial intelligence, digital network mapping, geospatial visualization, routing, and asset location services.",
  },

  {
    id: "ai",
    title: "AI Intelligence",
    image: "/images/platform/ai.jpg",
    href: "/dashboard/intelligence/ai",
    description:
      "Predictive maintenance, anomaly detection, intelligent recommendations, outage prediction, and operational decision support.",
  },
];
