import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { DataBar } from "@/components/system/DataBar";
import { navigationFor } from "@/constants/access";
import { reports } from "@/composition/reports";
import { getDataContext, getViewer } from "@/composition/runtime";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell bar={<DataBar context={{ ...getDataContext(), reportPeriods: reports.barPeriods() }} />} navigation={navigationFor(getViewer().screens)}>
      {children}
    </DashboardShell>
  );
}
