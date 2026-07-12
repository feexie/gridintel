"use client";

import type { Meter } from "@/types/utility";

type MeterCardProps = {
  meter: Meter;
  selected: boolean;
  onClick: () => void;
};

export default function MeterCard({
  meter,
  selected,
  onClick,
}: MeterCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-5 text-left transition-all duration-200 ${
        selected
          ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
          : "border-slate-800 bg-slate-900 hover:border-slate-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {meter.customerName}
          </h3>

          <p className="text-sm text-slate-400">
            {meter.serialNumber}
          </p>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            meter.status === "online"
              ? "bg-emerald-500/20 text-emerald-400"
              : meter.status === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : meter.status === "maintenance"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {meter.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Voltage</p>
          <p className="font-semibold text-white">
            {meter.voltage.toFixed(1)} V
          </p>
        </div>

        <div>
          <p className="text-slate-500">Current</p>
          <p className="font-semibold text-white">
            {meter.current.toFixed(1)} A
          </p>
        </div>

        <div>
          <p className="text-slate-500">Frequency</p>
          <p className="font-semibold text-white">
            {meter.frequency.toFixed(2)} Hz
          </p>
        </div>

        <div>
          <p className="text-slate-500">Power Factor</p>
          <p className="font-semibold text-white">
            {meter.powerFactor.toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Energy</p>
          <p className="font-semibold text-white">
            {meter.energyKwh.toLocaleString()} kWh
          </p>
        </div>

        <div>
          <p className="text-slate-500">Power</p>
          <p className="font-semibold text-white">
            {meter.powerKw.toFixed(2)} kW
          </p>
        </div>

        <div>
          <p className="text-slate-500">Signal</p>
          <p className="font-semibold text-white">
            {meter.signalStrength}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">Health</p>
          <p
            className={`font-semibold ${
              meter.tamperDetected
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {meter.tamperDetected ? "Tamper" : "Healthy"}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="text-xs text-slate-500">
          Last Communication
        </p>

        <p className="text-xs text-slate-300">
          {meter.lastCommunication}
        </p>
      </div>
    </button>
  );
}
