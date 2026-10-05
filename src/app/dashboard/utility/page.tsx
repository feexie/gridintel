import Link from "next/link";
import { UTILITY_WORKSPACES } from "@/constants/navigation";

/* The Utility Intelligence hub: the workspaces that exist, each with the question it answers. */

export default function UtilityWorkspacePage() {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-micro font-semibold uppercase tracking-eyebrow text-link/80">Utility Intelligence</p>
        <h1 className="text-xl font-semibold text-ink">Workspaces</h1>
        <p className="text-xs text-ink-4">Each workspace is one screen shaped for one job. Every figure on them can be traced to its source and method.</p>
      </header>
      <ul className="grid gap-3 md:grid-cols-2">
        {UTILITY_WORKSPACES.map((workspace) => (
          <li key={workspace.href} className="border border-line bg-panel p-3">
            <Link href={workspace.href} className="text-sm font-semibold text-link hover:text-link-hover hover:underline">
              {workspace.label}
            </Link>
            <p className="mt-1 text-xs leading-snug text-ink-3">{workspace.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
