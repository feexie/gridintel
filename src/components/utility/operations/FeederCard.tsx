"use client";

import type { Feeder } from "@/types/utility";

type FeederCardProps = {
  feeder: Feeder;
  selected: boolean;
  onClick: () => void;
};

export default function FeederCard({
  feeder,
  selected,
  onClick,
}: FeederCardProps) {
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
        <h3 className="text-lg font-semibold text-white">
          {feeder.name}
        </h3>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            feeder.status === "online"
              ? "bg-emerald-500/20 text-emerald-400"
              : feeder.status === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : feeder.status === "maintenance"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {feeder.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Code</p>
          <p className="font-semibold text-white">
            {feeder.feederCode}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Load</p>
          <p className="font-semibold text-white">
            {feeder.currentLoadMw.toFixed(1)} MW
          </p>
        </div>

        <div>
          <p className="text-slate-500">Customers</p>
          <p className="font-semibold text-white">
            {feeder.customers.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Transformers</p>
          <p className="font-semibold text-white">
            {feeder.transformers}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Technical Loss</p>
          <p className="font-semibold text-white">
            {feeder.technicalLoss.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">Commercial Loss</p>
          <p className="font-semibold text-white">
            {feeder.commercialLoss.toFixed(1)}%
          </p>
        </div>
      </div>
    </button>
  );
}
