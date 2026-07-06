import { navigationGroups } from "@/constants/navigation";
import NavItem from "./NavItem";

export default function Sidebar() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-r border-white/5 bg-slate-950 px-5 py-6 lg:flex lg:flex-col">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
          GridIntel
        </p>

        <h1 className="mt-2 text-xl font-semibold text-white">
          Energy Intelligence Platform
        </h1>
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
    </aside>
  );
}
