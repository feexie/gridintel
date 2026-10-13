import Link from "next/link";
import { PlannedTag, SectorBand } from "@/components/system/Brand";
import { Panel } from "@/components/system/Metric";
import { MINIGRID_HOME, UTILITY_HOME } from "@/constants/navigation";

/* The one page of a sector that is not built (DER, Planning). It says so first and plainly, says
   what the sector is for, and that it will have the structure every sector has (ADR 0017). It
   holds no data and no figure, and nothing on it looks like a working screen. */

const STRUCTURE = [
  { title: "Overview", text: "What needs attention here, in a few lines, with links in." },
  { title: "GIS Map", text: "The shared map, showing this sector's layers." },
  { title: "AI Assistant", text: "This sector's own tools on the platform's one AI layer. Every answer cites the figures." },
  { title: "Workspaces", text: "The sector's own screens, each figure with its status, origin, source and method." },
];

export function SectorPlanned({ sector, purpose, covers }: { sector: string; purpose: string; covers: string[] }) {
  return (
    <div className="space-y-4" data-sector-planned>
      <SectorBand eyebrow={sector} title="Overview" aside={<PlannedTag>Planned · not built</PlannedTag>}>
        {sector} is not built yet. There is no data and no figure on this page.
      </SectorBand>

      <Panel title="What it is for" aside="Scope not yet set">
        <p className="max-w-3xl text-sm leading-snug text-ink-2">{purpose}</p>
        <ul className="grid gap-x-6 gap-y-1 text-sm text-ink-3 sm:grid-cols-2" data-planned-covers>
          {covers.map((one) => (
            <li key={one} className="flex gap-2">
              <span aria-hidden className="text-ink-5">
                –
              </span>
              {one}
            </li>
          ))}
        </ul>
        <p className="text-caption leading-snug text-ink-4">This is the intent recorded in the roadmap, not a commitment to features. Scope and acceptance are set when the phase is approved.</p>
      </Panel>

      <Panel title="How it will be laid out" aside="The same as every sector">
        <ul className="grid gap-x-6 gap-y-3 md:grid-cols-2" data-planned-structure>
          {STRUCTURE.map((part) => (
            <li key={part.title}>
              <p className="text-sm font-semibold text-ink">{part.title}</p>
              <p className="mt-0.5 text-caption leading-snug text-ink-4">{part.text}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="text-sm text-ink-3">
        Built today:{" "}
        <Link href={UTILITY_HOME} className="font-medium text-link hover:text-link-hover hover:underline">
          Utility Intelligence →
        </Link>{" "}
        <Link href={MINIGRID_HOME} className="ml-2 font-medium text-link hover:text-link-hover hover:underline">
          Mini-grid Intelligence →
        </Link>
      </p>
    </div>
  );
}
