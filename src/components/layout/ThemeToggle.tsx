"use client";

/* Light or dark. The choice is kept on the reader's device and applied before the page is
   painted by the script in app/layout.tsx, which reads the same key. The button names the theme
   it leads to; both names are in the page and the stylesheet shows the one that applies, so
   nothing here depends on what the server could not know. */

const KEY = "gridintel-theme";

export default function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Private browsing: the choice lasts for this page only.
    }
  };
  return (
    <button type="button" onClick={toggle} data-theme-toggle className="gi-tap inline-flex items-center gap-1.5 rounded-tile border border-line-strong px-2.5 py-1 text-caption font-medium text-ink-3 hover:border-line-bold hover:text-ink">
      <span aria-hidden>◐</span>
      <span className="gi-when-dark">Light theme</span>
      <span className="gi-when-light">Dark theme</span>
    </button>
  );
}
