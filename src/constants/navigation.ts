/* The menu. Every sector has the same structure: Overview, GIS Map, AI Assistant, then its
   workspaces (ADR 0017). A sector that joins later (DER, Planning) is one more group of the same
   shape.

   Every item leads to a screen that exists. An item marked `planned` leads to a page that says
   what is not built yet, and the menu marks it so before it is opened. */

export type NavigationItem = {
  label: string;
  href: string;
  /** The question the screen answers. */
  description?: string;
  /** Active only on exactly this address, not on the addresses below it. */
  exact?: boolean;
  /** Not built yet. Shown with the word "Planned" in the menu. */
  planned?: boolean;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const PLATFORM_HOME = "/dashboard";
export const UTILITY_HOME = "/dashboard/utility";
export const MINIGRID_HOME = "/dashboard/minigrid";

export const UTILITY_WORKSPACES: NavigationItem[] = [
  { label: "Executive", href: `${UTILITY_HOME}/executive`, description: "What is happening across the portfolio, and where should I look first?" },
  { label: "Operations", href: `${UTILITY_HOME}/operations`, description: "What does the network look like, level by level, from region to service point?" },
  { label: "Reliability", href: `${UTILITY_HOME}/reliability`, description: "Which feeders fail their customers, why, and is it ours to fix?" },
  { label: "Revenue", href: `${UTILITY_HOME}/revenue`, description: "Where is revenue not realised, who is not paying, and is the loss commercial or collection?" },
  { label: "Assets", href: `${UTILITY_HOME}/assets`, description: "Which assets require attention?" },
  { label: "Events / Alarms", href: `${UTILITY_HOME}/events`, description: "What is wrong now, where, and who is affected?" },
];

export const MINIGRID_WORKSPACES: NavigationItem[] = [
  { label: "Sites", href: `${MINIGRID_HOME}/sites`, description: "Which sites are underperforming and why, and do their reports match the records?" },
];

/** The three screens every sector opens with, in this order. */
function sector(home: string, map: string): NavigationItem[] {
  return [
    { label: "Overview", href: home, exact: true, description: "What needs attention here?" },
    { label: "GIS Map", href: `${home}/map`, description: map },
    { label: "AI Assistant", href: `${home}/ai`, planned: true, description: "Planned. Not built yet." },
  ];
}

export const navigationGroups: NavigationGroup[] = [
  {
    label: "Platform",
    items: [{ label: "Overview", href: PLATFORM_HOME, exact: true }],
  },
  {
    label: "Utility Intelligence",
    items: [...sector(UTILITY_HOME, "Where is the network, what is wrong on it now, and where are the losses?"), ...UTILITY_WORKSPACES],
  },
  {
    label: "Mini-grid Intelligence",
    items: [...sector(MINIGRID_HOME, "Where are the sites, and how does each one stand?"), ...MINIGRID_WORKSPACES],
  },
];
