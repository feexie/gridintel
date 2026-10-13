import Menu from "./Menu";
import ThemeToggle from "./ThemeToggle";

/** Down the side on a desktop: the screens of the sector chosen in the row above. */
export default function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-line bg-panel px-3 py-4 lg:flex lg:flex-col">
      <div className="flex-1 overflow-y-auto">
        <Menu />
      </div>
      <div className="border-t border-line px-2 pt-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
