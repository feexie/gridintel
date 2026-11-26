"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_WORKSPACE_COOKIE, DEMO_WORKSPACE_QUERY, demoTypeFor, demoWorkspaceType, hrefOf, viewAt, type WorkspaceType } from "@/constants/views";
import type { SignedInFrameView } from "@/services/initiatives/views";
import { RailFrame } from "./RailFrame";
import { WorkspaceMark } from "./WorkspaceFrame";

/* ==========================================================
   THE DEMO WORKSPACE, CHOSEN IN THE BROWSER (NAV-B step 6;
   safeguard C)

   Only on the public demonstration, whose pages are built ahead of
   time and are the same for everyone. The five demo workspaces'
   frames and page sections are all in the page; this shows one:
   - the one a link names with ?workspace=, read once and then taken
     out of the address, and kept in a cookie (the switcher leads to
     Home with ?workspace= of the workspace chosen);
   - else the one the cookie names;
   - else the default (Demonstration DisCo).
   Either value is validated against the catalogue's five types
   (views.ts, demoWorkspaceType): any other value is the default.
   When the page's view is not in that workspace's catalogue, the
   demo workspace that shows it is used (demoTypeFor).

   It holds no figure and decides nothing about access: every demo
   workspace is synthetic and the public viewer holds every screen.
   A tenant deployment never draws it.
========================================================== */

const Chosen = createContext<WorkspaceType | null>(null);

function cookieValue(): string | null {
  const found = document.cookie.split("; ").find((part) => part.startsWith(`${DEMO_WORKSPACE_COOKIE}=`));
  return found === undefined ? null : decodeURIComponent(found.slice(DEMO_WORKSPACE_COOKIE.length + 1));
}

function keep(type: WorkspaceType) {
  document.cookie = `${DEMO_WORKSPACE_COOKIE}=${type}; path=/; max-age=31536000; samesite=lax`;
}

export function DemoWorkspace({ frames, bar, children }: { frames: SignedInFrameView[]; bar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [preferred, setPreferred] = useState<WorkspaceType>(() => demoWorkspaceType(null));

  useEffect(() => {
    const url = new URL(window.location.href);
    const asked = url.searchParams.get(DEMO_WORKSPACE_QUERY);
    const type = demoWorkspaceType(asked ?? cookieValue());
    if (asked !== null) {
      keep(type);
      url.searchParams.delete(DEMO_WORKSPACE_QUERY);
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // Read once the page is in the browser: the page was built ahead of time with the default.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferred(type);
  }, []);

  const type = demoTypeFor(viewAt(pathname)?.id ?? null, preferred);
  const frame = frames.find((one) => one.workspace.type === type) ?? frames[0];

  const switcher = (
    <details className="relative" data-switcher>
      <summary className="gi-tap cursor-pointer list-none rounded-tile border border-line-strong px-2.5 py-1 text-sm text-ink-2 hover:border-line-bold">Switch workspace ▾</summary>
      <ul className="absolute right-0 z-[1100] mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-panel p-1 shadow-pop">
        {frames
          .filter((one) => one.workspace.type !== type)
          .map((one) => (
            <li key={one.workspace.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-tile px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-line/60"
                data-switch-to={one.workspace.type}
                onClick={() => {
                  keep(one.workspace.type);
                  setPreferred(one.workspace.type);
                  // The address names the workspace it leads to, so it says what the screen shows and a reload keeps it.
                  // (Pushing the bare Home address after the query was taken out left the old ?workspace= in the bar.)
                  router.push(`${hrefOf("platform.home")}?${DEMO_WORKSPACE_QUERY}=${one.workspace.type}`);
                }}
              >
                <WorkspaceMark workspace={one.workspace} size="sm" />
                <span className="min-w-0">
                  <span className="block">{one.workspace.name}</span>
                  <span className="block text-micro text-ink-4">{one.workspace.typeLabel} · demo</span>
                </span>
              </button>
            </li>
          ))}
      </ul>
    </details>
  );

  return (
    <Chosen.Provider value={type}>
      <RailFrame frame={frame} switcher={switcher} bar={bar}>
        {children}
      </RailFrame>
    </Chosen.Provider>
  );
}

/** A part of a page for one workspace type: on the demonstration, shown only for the demo workspace being looked at; on a tenant, always (it is the only one given). */
export function ForWorkspace({ type, children }: { type: WorkspaceType; children: ReactNode }) {
  const chosen = useContext(Chosen);
  return chosen === null || chosen === type ? <>{children}</> : null;
}
