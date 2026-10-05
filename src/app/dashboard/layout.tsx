import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { DataBar } from "@/components/system/DataBar";
import { getDataContext } from "@/composition/runtime";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell bar={<DataBar context={getDataContext()} />}>{children}</DashboardShell>;
}
