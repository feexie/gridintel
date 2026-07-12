import { edgeDevices } from "@/data/utility/edgeDevices";

export default function EdgeDeviceStatus() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">
          Edge Device Status
        </h2>

        <p className="text-sm text-slate-400">
          Monitor the health and connectivity of deployed GridIntel Edge
          Devices across the network.
        </p>
      </div>

      <div className="space-y-4">
        {edgeDevices.map((device) => (
          <div
            key={device.id}
            className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">
                  {device.assetType.toUpperCase()}
                </h3>

                <p className="text-sm text-slate-400">
                  Asset ID: {device.assetId}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  device.online
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {device.online ? "Online" : "Offline"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">
                  Firmware
                </p>

                <p className="text-sm text-white">
                  {device.firmwareVersion}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Signal
                </p>

                <p className="text-sm text-white">
                  {device.signalStrength} %
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Latency
                </p>

                <p className="text-sm text-white">
                  {device.latencyMs} ms
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Last Heartbeat
                </p>

                <p className="text-sm text-white">
                  {device.lastHeartbeat}
                </p>
              </div>

              {device.batteryVoltage !== undefined && (
                <div>
                  <p className="text-xs text-slate-500">
                    Battery
                  </p>

                  <p className="text-sm text-white">
                    {device.batteryVoltage.toFixed(1)} V
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
