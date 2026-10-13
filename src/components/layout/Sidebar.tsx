import Menu from "./Menu";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-panel px-3 py-4 lg:flex lg:flex-col">
      <div className="mb-5 px-2">
        <Wordmark />
      </div>
      <div className="flex-1 overflow-y-auto">
        <Menu />
      </div>
      <div className="border-t border-line px-2 pt-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
