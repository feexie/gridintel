import type { Meter } from "@/types/utility";

type MeterActivityProps = {
  meters: Meter[];
};

export default function MeterActivity({
  meters,
}: MeterActivityProps) {
  if (meters.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-400">
          No smart meters available.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {meters.map((meter) => (
        <div
          key={meter.id}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        >
          <div className="flex items-center justify-between">

            <div>
              <h3 className="font-semibold text-white">
                {meter.customerName}
              </h3>

              <p className="text-xs text-slate-400">
                {meter.serialNumber}
              </p>

              <p className="text-xs text-cyan-400 uppercase">
               {meter.parentAssetType} • {meter.parentAssetId}
              </p>
            </div>

            <div className="text-right">

              <p className="font-semibold text-cyan-300">
                {meter.energyKwh.toLocaleString()} kWh
              </p>

              <p className="text-sm text-slate-300">
                {meter.powerKw.toFixed(2)} kW
              </p>

              <p
                className={`text-xs ${
                  meter.tamperDetected
                    ? "text-red-400"
                    : "text-emerald-400"
                }`}
              >
                {meter.tamperDetected ? "Tamper Detected" : "Healthy"}
              </p>

              <p className="text-xs text-slate-500">
                {meter.lastCommunication}
              </p>

            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
