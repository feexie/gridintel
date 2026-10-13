import { navigationGroups } from "@/constants/navigation";
import NavItem from "./NavItem";

/** The menu itself: the same groups in the sidebar and in the menu a phone opens. */
export default function Menu({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5">
      {navigationGroups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <p className="mb-1 px-3 text-micro font-semibold uppercase tracking-title text-ink-5">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavItem key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}
