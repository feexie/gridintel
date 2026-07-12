export default function AlarmPanel() {
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900 p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">
        Active Alarms
      </h2>

      <div className="space-y-4">

        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="font-medium text-red-300">
            Low Voltage Alert
          </p>

          <p className="mt-1 text-sm text-slate-300">
            Jimeta Feeder 01 voltage dropped below threshold.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="font-medium text-amber-300">
            Communication Delay
          </p>

          <p className="mt-1 text-sm text-slate-300">
            Edge device heartbeat delayed.
          </p>
        </div>

      </div>
    </section>
  );
}
