import type { ReactNode } from "react";
import { homeFor } from "@/constants/access";
import type { Sector } from "@/constants/navigation";
import Account, { type AccountView } from "./Account";
import SectorSwitcher from "./SectorSwitcher";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import Topbar from "./Topbar";
import Wordmark from "./Wordmark";

/**
 * The frame of every dashboard screen: the sectors, the menu of the sector the reader is in, the
 * bar that says what data is shown, and the page. `navigation` is what the viewer may open
 * (constants/access.ts); the frame shows nothing else. `account` is who is signed in, on a
 * tenant deployment; the public demonstration has none.
 */
export default function DashboardShell({ bar, navigation, account = null, children }: { bar: ReactNode; navigation: Sector[]; account?: AccountView | null; children: ReactNode }) {
  const home = homeFor(navigation);
  return (
    <div className="flex h-dvh flex-col bg-app text-ink print:block print:h-auto">
      <header className="hidden shrink-0 items-center gap-8 border-b border-line bg-panel px-5 py-2 lg:flex print:hidden" data-sector-bar>
        <Wordmark href={home} />
        <SectorSwitcher navigation={navigation} />
        <div className="ml-auto flex items-center gap-4">
          {account ? <Account account={account} /> : null}
          <ThemeToggle />
        </div>
      </header>
      <Topbar navigation={navigation} home={home} />
      {account ? <Account account={account} className="border-b border-line bg-panel px-4 py-1.5 lg:hidden print:hidden" /> : null}

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
