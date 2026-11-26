import type { ReactNode } from "react";
import { DataBar } from "@/components/system/DataBar";
import { reference } from "@/composition/reference";
import { reports } from "@/composition/reports";
import { getDataContext } from "@/composition/runtime";
import { DashboardFrame } from "./frame";

/* Every /dashboard page: the workspace's frame (NAV-B step 6), the bar saying what data the screen shows, and the page. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const referenceNotices = await reference.barNotices();
  return <DashboardFrame bar={<DataBar context={{ ...getDataContext(), reportPeriods: reports.barPeriods(), referenceNotices }} />}>{children}</DashboardFrame>;
}
