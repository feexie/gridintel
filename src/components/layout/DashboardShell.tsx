import type { ReactNode } from "react";
import SectorSwitcher from "./SectorSwitcher";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Wordmark from "./Wordmark";

/** The frame of every dashboard screen: the sectors, the menu of the sector the reader is in, the bar that says what data is shown, and the page. */
export default function DashboardShell({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-app text-ink">
      <header className="hidden shrink-0 items-center gap-8 border-b border-line bg-panel px-5 py-2 lg:flex" data-sector-bar>
        <Wordmark />
        <SectorSwitcher />
      </header>
      <Topbar />

      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {bar}
          <main className="flex-1 overflow-y-auto bg-app px-4 py-4 sm:px-6 sm:py-5 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
