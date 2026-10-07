/* The menu. Only screens that work are in it: a page that says "Coming Soon" is reachable by
   its address and is not offered as somewhere to go. */

export type NavigationItem = {
  label: string;
  href: string;
  /** The question the screen answers. */
  description?: string;
  /** Active only on exactly this address, not on the addresses below it. */
  exact?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const UTILITY_WORKSPACES: NavigationItem[] = [
  { label: "Executive", href: "/dashboard/utility/executive", description: "What is happening across the portfolio, and where should I look first?" },
  { label: "Operations", href: "/dashboard/utility/operations", description: "What does the network look like, level by level, from region to service point?" },
  { label: "Reliability", href: "/dashboard/utility/reliability", description: "Which feeders fail their customers, why, and is it ours to fix?" },
  { label: "Revenue", href: "/dashboard/utility/revenue", description: "Where is revenue not realised, who is not paying, and is the loss commercial or collection?" },
  { label: "Assets", href: "/dashboard/utility/assets", description: "Which assets require attention?" },
  { label: "Events / Alarms", href: "/dashboard/utility/events", description: "What is wrong now, where, and who is affected?" },
];

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Platform",
    items: [{ label: "Overview", href: "/dashboard", exact: true }],
  },
  {
    label: "Utility Intelligence",
    items: UTILITY_WORKSPACES,
  },
];
