import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { DataBar } from "@/components/system/DataBar";
import { navigationFor } from "@/constants/access";
import { reports } from "@/composition/reports";
import { getAccount, getDataContext, getViewer } from "@/composition/runtime";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [viewer, account] = await Promise.all([getViewer(), getAccount()]);
  return (
    <DashboardShell bar={<DataBar context={{ ...getDataContext(), reportPeriods: reports.barPeriods() }} />} navigation={navigationFor(viewer.screens)} account={account}>
      {children}
    </DashboardShell>
  );
}
