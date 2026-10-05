import { navigationGroups } from "@/constants/navigation";
import NavItem from "./NavItem";

/* The menu on a screen too narrow for the sidebar. */
export default function Topbar() {
  return (
    <header className="border-b border-line bg-app px-3 py-2 lg:hidden">
      <p className="px-3 text-micro font-semibold uppercase tracking-eyebrow text-link/80">GridIntel</p>
      <nav aria-label="Main" className="mt-1 flex flex-wrap gap-x-1">
        {navigationGroups
          .flatMap((group) => group.items)
          .map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
      </nav>
    </header>
  );
}
