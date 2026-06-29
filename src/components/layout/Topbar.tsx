export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/85 px-6 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Operations Console
          </p>
          <h2 className="truncate text-lg font-semibold text-white">
            Search, alerts, and live context
          </h2>
        </div>

        <label className="flex min-w-[260px] flex-1 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-400 focus-within:border-cyan-400/40">
          <span className="text-slate-500">⌕</span>
          <input
            type="search"
            placeholder="Search assets, analytics, alerts..."
            className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </label>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-amber-400/15 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            3 Alerts
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
            Live
          </div>
        </div>
      </div>
    </header>
  );
}
