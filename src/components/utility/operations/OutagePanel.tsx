export default function OutagePanel() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">
        Active Outages
      </h2>

      <div className="space-y-4">

        <div className="rounded-lg border border-white/10 p-4">
          <p className="font-medium text-white">
            Jimeta Feeder 01
          </p>

          <p className="text-sm text-slate-400">
            Planned maintenance
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Customers affected: 312
          </p>
        </div>

      </div>
    </section>
  );
}
