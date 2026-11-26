import Link from "next/link";
import { DataBar } from "@/components/system/DataBar";
import { landingFor } from "@/constants/access";
import { getDataContext, getViewer } from "@/composition/runtime";
import { DashboardFrame } from "./dashboard/frame";

/* An address that leads nowhere. It is shown inside the same frame as every other screen, so
   that the bar saying what data the application holds is on this one too. */
export default async function NotFound() {
  const home = landingFor((await getViewer()).screens);
  return (
    <DashboardFrame bar={<DataBar context={{ ...getDataContext(), reportPeriods: {}, referenceNotices: {} }} />}>
      <div className="border border-line bg-panel p-4 text-sm text-ink-3" data-not-found>
        <h1 className="font-semibold text-ink">Page not found</h1>
        <p className="mt-1 text-ink-4">There is no screen at this address.</p>
        {home === null ? null : (
          <Link href={home} className="mt-2 inline-block text-link hover:underline">
            Go to the start
          </Link>
        )}
      </div>
    </DashboardFrame>
  );
}
