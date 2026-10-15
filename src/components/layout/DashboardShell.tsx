import type { ReactNode } from "react";
import { homeFor } from "@/constants/access";
import type { Sector } from "@/constants/navigation";
import SectorSwitcher from "./SectorSwitcher";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Topbar from "./Topbar";
import Wordmark from "./Wordmark";

/**
 * The frame of every dashboard screen: the sectors, the menu of the sector the reader is in, the
 * bar that says what data is shown, and the page. `navigation` is what the viewer may open
 * (constants/access.ts); the frame shows nothing else.
 */
export default function DashboardShell({ bar, navigation, children }: { bar: ReactNode; navigation: Sector[]; children: ReactNode }) {
  const home = homeFor(navigation);
  return (
    <div className="flex h-dvh flex-col bg-app text-ink print:block print:h-auto">
      <header className="hidden shrink-0 items-center gap-8 border-b border-line bg-panel px-5 py-2 lg:flex print:hidden" data-sector-bar>
        <Wordmark href={home} />
        <SectorSwitcher navigation={navigation} />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <Topbar navigation={navigation} home={home} />

      <div className="flex min-h-0 flex-1 print:block">
        <Sidebar navigation={navigation} />
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          {bar}
          <main className="flex-1 overflow-y-auto bg-app px-4 py-4 sm:px-6 sm:py-5 lg:px-8 print:overflow-visible print:bg-white print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
