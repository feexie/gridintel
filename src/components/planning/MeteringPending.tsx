import Link from "next/link";
import { SectorBand } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";
import { PLANNING_HOME } from "@/constants/planning";

/* Metering, while its screens are being built in the sprint. It holds no figure. */
const SCREENS = [
  { title: "Metering Fund", text: "Can every customer be metered in five years with no upfront payment, what is the monthly charge, and does the fund survive duty, naira and inflation shocks?" },
  { title: "Where the first meters go", text: "Which DTs to meter first, so the first meters earn the cash that pays for the next." },
  { title: "Who pays, and is it fair", text: "The meter charge as a share of the bill in each band, who is exempt, and the public money that covers them." },
];

export function MeteringPending() {
  return (
    <div className="space-y-4" data-metering-pending>
      <SectorBand eyebrow="Planning · Utility planning" title="Metering">
        Being built now. No figure is shown until the Metering Fund model is in place.
      </SectorBand>
      <Panel title="What this planner will answer">
        <ul className="grid gap-x-6 gap-y-3 md:grid-cols-3">
          {SCREENS.map((screen) => (
            <li key={screen.title}>
              <p className="text-sm font-semibold text-ink">{screen.title}</p>
              <p className="mt-0.5 text-caption leading-snug text-ink-4">{screen.text}</p>
            </li>
          ))}
        </ul>
      </Panel>
      <p className="text-sm text-ink-3">
        <Link href={PLANNING_HOME} className="font-medium text-link hover:text-link-hover hover:underline">
          All planners →
        </Link>
      </p>
    </div>
  );
}
