import Link from "next/link";
import type { ReactNode } from "react";
import { PresentMode } from "./PresentMode";

type Query = Record<string, string | string[] | undefined>;

/** Whether a planning screen is in presentation mode (?present=1), and the address that switches it. */
export function presentState(path: string, query: Query): { present: boolean; toggleHref: string } {
  const present = query.present === "1";
  const kept = Object.entries(query).flatMap(([key, value]) => (key === "present" || value === undefined ? [] : [[key, Array.isArray(value) ? value[0] : value] as [string, string]]));
  const params = new URLSearchParams(present ? kept : [...kept, ["present", "1"]]).toString();
  return { present, toggleHref: params ? `${path}?${params}` : path };
}

/* Presentation mode on a planning screen other than the Metering Fund: the navigation and the
   screen tabs are hidden (globals.css) and the headline is enlarged, so a
   recording shows the finding and its figures only; the screen keeps the full width, so its tables do
   not wrap. A link switches it on and off. */
export function PresentFrame({ present, toggleHref, children }: { present: boolean; toggleHref: string; children: ReactNode }) {
  return (
    <div className="space-y-2" data-present-frame={present ? "on" : "off"}>
      {present ? <PresentMode /> : null}
      <p className="flex justify-end print:hidden">
        <Link href={toggleHref} className="text-caption text-link hover:underline" data-present-link>
          {present ? "Leave presentation mode" : "Presentation mode"}
        </Link>
      </p>
      {children}
    </div>
  );
}
