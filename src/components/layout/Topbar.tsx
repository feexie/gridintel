export default function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/95 px-6 py-4 lg:px-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            GridIntel
          </p>

          <h2 className="text-lg font-semibold text-white">
            Energy Intelligence Platform
          </h2>
        </div>
      </div>
    </header>
  );
}
