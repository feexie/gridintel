import Link from "next/link";
import { METERING_SCREENS, type MeteringScreenId } from "@/constants/planning";

/* The Metering planner's screens, in the order of the story: Plan, Fund, Monitor. A screen not
   built yet is listed and marked so, with no link. */
export function MeteringTabs({ current }: { current: MeteringScreenId }) {
  return (
    <nav aria-label="Metering screens" className="flex flex-wrap gap-1 rounded-tile border border-line bg-panel p-1 print:hidden" data-metering-tabs>
      {METERING_SCREENS.map((screen) =>
        screen.planned ? (
          <span key={screen.id} className="flex items-center gap-1.5 rounded-tile px-3 py-1.5 text-sm text-ink-4">
            <span className="text-micro font-semibold uppercase tracking-wide text-ink-5">{screen.step}</span> {screen.label}
            <span className="rounded-full border border-dashed border-line-bold px-1.5 py-px text-micro font-medium uppercase tracking-wide text-ink-4">Planned</span>
          </span>
        ) : (
          <Link
            key={screen.id}
            href={screen.href}
            aria-current={screen.id === current ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-tile px-3 py-1.5 text-sm ${screen.id === current ? "bg-brand-soft font-semibold text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            <span className="text-micro font-semibold uppercase tracking-wide text-brand">{screen.step}</span> {screen.label}
          </Link>
        ),
      )}
    </nav>
  );
}
