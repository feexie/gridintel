"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Account, { type AccountView } from "@/components/layout/Account";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { PlannedTag } from "@/components/system/Brand";
import type { SignedInFrameView } from "@/services/initiatives/views";
import { DemoBadge, WorkspaceMark } from "./WorkspaceFrame";

/* The frame of every /dashboard page (ADR 0021 decision 5; NAV-B step 6): at the top left the
   workspace's mark and name, DEMO on a demo workspace, the switcher when there is another
   workspace to go to; down the side the rail, each item leading to its landing and listing its
   views; Reports, Help and the account at its foot; then the bar saying what data the screen
   shows, and the page. The frame is given already cut to the viewer's grant: it shows nothing
   else, and decides nothing about access. */

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function RailFrame({ frame, switcher = null, account = null, bar, children }: { frame: SignedInFrameView; switcher?: ReactNode; account?: AccountView | null; bar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const { workspace } = frame;
  // The rail item the page is in: the one listing the view, or whose landing it is.
  const current = frame.rail.find((item) => item.views.some((view) => within(pathname, view.href))) ?? frame.rail.find((item) => (item.item === "home" ? pathname === item.href : within(pathname, item.href)));
  return (
    <div className="flex h-dvh flex-col bg-app text-ink print:block print:h-auto" data-workspace-frame={workspace.id} data-workspace-type={workspace.type}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2 print:hidden" data-workspace-header>
        <Link href={workspace.href} className="flex min-w-0 items-center gap-2.5" aria-label={`${workspace.name}, workspace home`}>
          <WorkspaceMark workspace={workspace} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-ink" data-workspace-name>
              {workspace.name}
            </span>
            <span className="block text-micro text-ink-5">{workspace.typeLabel} workspace · GridIntel</span>
          </span>
        </Link>
        {workspace.demo ? <DemoBadge /> : null}
        <div className="ml-auto flex items-center gap-3">
          {switcher}
          {account ? <Account account={account} className="hidden lg:flex" /> : null}
          <ThemeToggle compact />
        </div>
      </header>
      {account ? <Account account={account} className="border-b border-line bg-panel px-4 py-1.5 lg:hidden print:hidden" /> : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row print:block">
        <nav aria-label="Workspace" className="flex shrink-0 flex-col border-b border-line bg-panel lg:w-60 lg:overflow-y-auto lg:border-b-0 lg:border-r print:hidden" data-rail>
          <ul className="flex gap-1 overflow-x-auto px-2 py-1 lg:flex-col lg:overflow-visible lg:py-2">
            {frame.rail.map((item) => {
              const active = item === current;
              return (
                <li key={item.item} className="shrink-0">
                  <Link
                    href={item.href}
                    title={item.question}
                    aria-current={active && pathname === item.href ? "page" : undefined}
                    data-rail-item={item.item}
                    data-active={active ? "" : undefined}
                    className={`block whitespace-nowrap rounded-tile px-3 py-1.5 text-sm ${active ? "bg-brand-strong/10 font-semibold text-ink" : "text-ink-2 hover:bg-line/60"}`}
                  >
                    {item.label}
                  </Link>
                  {active && item.views.length > 0 ? (
                    <ul className="mt-0.5 hidden space-y-0.5 pl-3 lg:block" data-rail-views={item.item} data-rail-views-wide>
                      {item.views.map((view) => (
                        <li key={view.id}>
                          <Link
                            href={view.href}
                            aria-current={within(pathname, view.href) ? "page" : undefined}
                            data-rail-view={view.id}
                            data-planned={view.planned ? "" : undefined}
                            className={`flex items-center justify-between gap-2 rounded-tile px-3 py-1 text-sm ${within(pathname, view.href) ? "font-semibold text-ink" : view.planned ? "text-ink-4 hover:text-ink-2" : "text-ink-3 hover:text-ink"}`}
                          >
                            {view.label}
                            {view.planned ? <PlannedTag /> : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {/* On a phone the views of the item the page is in are a row of their own: every screen stays one tap away. */}
          {current && current.views.length > 0 ? (
            <ul className="flex gap-1 overflow-x-auto border-t border-line px-2 py-1 lg:hidden" data-rail-views-narrow={current.item}>
              {current.views.map((view) => (
                <li key={view.id} className="shrink-0">
                  <Link href={view.href} aria-current={within(pathname, view.href) ? "page" : undefined} className={`block whitespace-nowrap rounded-tile px-2.5 py-1 text-caption ${within(pathname, view.href) ? "bg-brand-strong/10 font-semibold text-ink" : "text-ink-3"}`}>
                    {view.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="hidden flex-wrap items-center gap-1 border-t border-line px-2 py-1 lg:mt-auto lg:block lg:py-2" data-rail-foot>
            {frame.reportsHref ? (
              <li>
                <Link href={frame.reportsHref} className="block rounded-tile px-3 py-1.5 text-sm text-ink-2 hover:bg-line/60" data-rail-reports>
                  Reports
                </Link>
              </li>
            ) : null}
            {frame.helpHref ? (
              <li>
                <Link href={frame.helpHref} className="block rounded-tile px-3 py-1.5 text-sm text-ink-2 hover:bg-line/60" data-rail-help>
                  Help · About this build
                </Link>
              </li>
            ) : null}
            <li className="px-3 py-1.5 text-caption text-ink-4" data-rail-account>
              {workspace.demo ? "Not signed in · demo" : "Account"}
            </li>
          </ul>
        </nav>
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
          {bar}
          <main className="flex-1 overflow-y-auto bg-app px-4 py-4 sm:px-6 sm:py-5 lg:px-8 print:overflow-visible print:bg-white print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
