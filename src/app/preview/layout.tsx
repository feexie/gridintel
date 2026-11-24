import type { Metadata } from "next";
import type { ReactNode } from "react";
import { frontDoorOnly } from "./front";

export const metadata: Metadata = { title: "GridIntel · Prototype", robots: { index: false, follow: false } };

/* The public front door and the demo workspaces, as a clickable prototype (Phase NAV-A, ADR 0021).
   It replaces nothing: "/" still leads to the dashboard, whose menu is unchanged. */
export default async function PreviewLayout({ children }: { children: ReactNode }) {
  await frontDoorOnly();
  return children;
}
