import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

/** The frame of every dashboard screen: the menu, the bar that says what data is shown, and the page. */
export default function DashboardShell({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh bg-app text-ink">
      <Sidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        {bar}
        <main className="flex-1 overflow-y-auto bg-app px-4 py-4 sm:px-6 sm:py-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
