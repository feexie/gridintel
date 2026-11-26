import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/* The public layer (ADR 0021; NAV-B step 7): Home, an initiative's own page, "Who are you?", a
   role's page and Track, on the public demonstration only. Each page checks it is on the
   demonstration (front.ts); on a tenant deployment "/" leads to the dashboard, and every other
   public address is not found. No rail, no report, no login. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return children;
}
