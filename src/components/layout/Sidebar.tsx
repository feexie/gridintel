import { navigationGroups } from "@/constants/navigation";
import NavItem from "./NavItem";

export default function Sidebar() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-r border-white/5 bg-slate-950/95 px-5 py-6 lg:flex lg:flex-col">
      <div className="mb-8 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
          GridIntel
        </p>
        <h1 className="text-xl font-semibold text-white">
          Hybrid Utility Intelligence Platform
        </h1>
        <p className="text-sm leading-6 text-slate-400">
          Utility operations, GIS, analytics, and AI in one control center.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
        {navigationGroups.map((group) => (
          <section key={group.label} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {group.label}
            </h2>

            <div className="space-y-2">
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Design direction</p>
        <p className="mt-2 leading-6">
          Hybrid utility intelligence: operational density with modern SaaS clarity.
        </p>
      </div>
    </aside>
  );
}
