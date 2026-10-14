import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import { DataBar } from "@/components/system/DataBar";
import { homeFor, navigationFor } from "@/constants/access";
import { getDataContext, getViewer } from "@/composition/runtime";

/* An address that leads nowhere. It is shown inside the same frame as every other screen, so
   that the bar saying what data the application holds is on this one too. */
export default function NotFound() {
  const navigation = navigationFor(getViewer().screens);
  const home = homeFor(navigation);
  return (
    <DashboardShell bar={<DataBar context={getDataContext()} />} navigation={navigation}>
      <div className="border border-line bg-panel p-4 text-sm text-ink-3" data-not-found>
        <h1 className="font-semibold text-ink">Page not found</h1>
        <p className="mt-1 text-ink-4">There is no screen at this address.</p>
        {home === null ? null : (
          <Link href={home} className="mt-2 inline-block text-link hover:underline">
            Go to the start
          </Link>
        )}
      </div>
    </DashboardShell>
  );
}
