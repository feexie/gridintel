export type NavigationItem = {
  label: string;
  href: string;
  description?: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Command Center",
    items: [
      {
        label: "Platform Overview",
        href: "/dashboard",
      },
    ],
  },

  {
    label: "Utility Workspace",
    items: [
      {
        label: "Operations Overview",
        href: "/dashboard/utility",
      },
      {
        label: "Network Operations",
        href: "/dashboard/utility/network",
      },
      {
        label: "Asset Intelligence",
        href: "/dashboard/utility/assets",
      },
      {
        label: "Revenue Intelligence",
        href: "/dashboard/utility/revenue",
      },
      {
        label: "Outage Management",
        href: "/dashboard/utility/outages",
      },
      {
        label: "Control Room",
        href: "/dashboard/utility/control-room",
      },
      {
        label: "Alarms",
        href: "/dashboard/utility/alarms",
      },
    ],
  },

  {
    label: "Energy Platforms",
    items: [
      {
        label: "DER Workspace",
        href: "/dashboard/der",
      },
      {
        label: "MiniGrid Workspace",
        href: "/dashboard/minigrid",
      },
      {
        label: "Planning Workspace",
        href: "/dashboard/planning",
      },
    ],
  },

  {
    label: "Intelligence Services",
    items: [
      {
        label: "GIS Intelligence",
        href: "/dashboard/intelligence/gis",
      },
      {
        label: "AI Copilot",
        href: "/dashboard/intelligence/ai",
      },
      {
        label: "Enterprise Analytics",
        href: "/dashboard/intelligence/analytics",
      },
    ],
  },

  {
    label: "Administration",
    items: [
      {
        label: "Reports",
        href: "/dashboard/reports",
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
      },
    ],
  },
];
