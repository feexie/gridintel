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
    label: "Platform",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        description: "GridIntel platform home",
      },
    ],
  },

  {
    label: "Sector Suites",
    items: [
      {
        label: "Utility Intelligence",
        href: "/dashboard/utility",
        description: "Distribution utility operations and analytics",
      },
      {
        label: "DER Intelligence",
        href: "/dashboard/der",
        description: "Distributed energy resource management",
      },
      {
        label: "MiniGrid Intelligence",
        href: "/dashboard/minigrid",
        description: "Mini-grid operations and commercial intelligence",
      },
      {
        label: "Planning Intelligence",
        href: "/dashboard/planning",
        description: "Planning and forecasting workspace",
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
