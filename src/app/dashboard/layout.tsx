import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { DataBar } from "@/components/system/DataBar";
import { navigationFor } from "@/constants/access";
import { getDataContext, getViewer } from "@/composition/runtime";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell bar={<DataBar context={getDataContext()} />} navigation={navigationFor(getViewer().screens)}>
      {children}
    </DashboardShell>
  );
}
