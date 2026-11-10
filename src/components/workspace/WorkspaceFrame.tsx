import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { PlannedTag } from "@/components/system/Brand";
import type { WorkspaceFrameView, WorkspaceSummaryView } from "@/services/initiatives/views";
import RailLink from "./RailLink";

/* The frame of a workspace (ADR 0021): at the top left the organization's logo and name, with the
   GridIntel fallback mark when it has none; DEMO on every screen of a demo workspace; the switcher
   when there is more than one workspace to go to; the slimmed rail down the side (across the top
   on a phone); Reports, Help and the account at the foot of the rail.

   A demo workspace is read-only and synthetic, and is entered without signing in: its account
   says so, and it has nothing to sign out of. */

export function WorkspaceMark({ workspace, size = "md" }: { workspace: WorkspaceSummaryView; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs";
  if (workspace.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- a small logo from the organization's record
    return <img src={workspace.logo} alt="" className={`${box} shrink-0 rounded-tile object-contain`} />;
  }
  return (
    <span aria-hidden className={`${box} inline-flex shrink-0 items-center justify-center rounded-tile bg-brand-strong font-semibold text-white`} data-fallback-mark>
      {workspace.initials}
    </span>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-[3px] border border-caution-line/60 px-1.5 py-px text-micro font-semibold uppercase tracking-wide text-caution" data-demo-badge>
      Demo
    </span>
  );
}

function Switcher({ frame }: { frame: WorkspaceFrameView }) {
  if (frame.others.length === 0) return null;
  return (
    <details className="relative" data-switcher>
      <summary className="gi-tap cursor-pointer list-none rounded-tile border border-line-strong px-2.5 py-1 text-sm text-ink-2 hover:border-line-bold">Switch workspace ▾</summary>
      <ul className="absolute right-0 z-[1100] mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-panel border border-line bg-panel p-1 shadow-pop">
        {frame.others.map((other) => (
          <li key={other.id}>
            <Link href={other.href} className="flex items-center gap-2 rounded-tile px-2 py-1.5 text-sm text-ink-2 hover:bg-line/60" data-switch-to={other.id}>
              <WorkspaceMark workspace={other} size="sm" />
              <span className="min-w-0">
                <span className="block">{other.name}</span>
                <span className="block text-micro text-ink-4">
                  {other.typeLabel}
                  {other.demo ? " · demo" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function WorkspaceFrame({ frame, children }: { frame: WorkspaceFrameView; children: ReactNode }) {
  const { current } = frame;
  return (
    <div className="flex min-h-dvh flex-col bg-app text-ink lg:h-dvh" data-workspace-frame={current.id} data-workspace-type={current.type}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2" data-workspace-header>
        <Link href={current.href} className="flex min-w-0 items-center gap-2.5" aria-label={`${current.name}, workspace home`}>
          <WorkspaceMark workspace={current} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-ink" data-workspace-name>
              {current.name}
            </span>
            <span className="block text-micro text-ink-5">{current.typeLabel} workspace · GridIntel</span>
          </span>
        </Link>
        {current.demo ? <DemoBadge /> : null}
        <PlannedTag>Prototype</PlannedTag>
        <div className="ml-auto flex items-center gap-3">
          <Switcher frame={frame} />
          <ThemeToggle compact />
        </div>
      </header>
      {current.demo ? (
        <p className="border-b border-line bg-panel px-4 py-1.5 text-caption text-ink-3" data-demo-note>
          Demo workspace: synthetic data, read-only, open without signing in. Nothing here is a real organization&apos;s record.
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Workspace" className="flex shrink-0 flex-col border-b border-line bg-panel lg:w-56 lg:border-b-0 lg:border-r" data-rail>
          <ul className="flex gap-1 overflow-x-auto px-2 py-2 lg:flex-col lg:overflow-visible">
            {frame.rail.map((item) => (
              <li key={item.item} className="shrink-0">
                <RailLink href={item.href} exact={item.item === "home"} title={item.question} item={item.item}>
                  {item.label}
                </RailLink>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1 lg:mt-auto lg:block lg:py-2" data-rail-foot>
            <li>
              <a href={frame.reportsHref} className="block rounded-tile px-3 py-1.5 text-sm text-ink-2 hover:bg-line/60" data-rail-reports>
                Reports
              </a>
            </li>
            <li>
              <span className="flex items-center justify-between rounded-tile px-3 py-1.5 text-sm text-ink-4">
                Help <PlannedTag />
              </span>
            </li>
            <li className="px-3 py-1.5 text-caption text-ink-4" data-account>
              {current.demo ? "Not signed in · demo" : "Account"}
            </li>
          </ul>
        </nav>
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
