"use client";

import type { Substation } from "@/types/utility";

type SubstationCardProps = {
  substation: Substation;
  selected: boolean;
  onClick: () => void;
};

export default function SubstationCard({
  substation,
  selected,
  onClick,
}: SubstationCardProps) {
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
          {substation.name}
        </h3>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            substation.status === "online"
              ? "bg-emerald-500/20 text-emerald-400"
              : substation.status === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : substation.status === "maintenance"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {substation.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Voltage</p>
          <p className="font-semibold text-white">
            {substation.voltageLevel}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Load</p>
          <p className="font-semibold text-white">
            {substation.currentLoadMw.toFixed(1)} MW
          </p>
        </div>

        <div>
          <p className="text-slate-500">Capacity</p>
          <p className="font-semibold text-white">
            {substation.installedCapacityMva} MVA
          </p>
        </div>

        <div>
          <p className="text-slate-500">Available</p>
          <p className="font-semibold text-white">
            {substation.availableCapacityMva} MVA
          </p>
        </div>

        <div>
          <p className="text-slate-500">Feeders</p>
          <p className="font-semibold text-white">
            {substation.feeders}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Transformers</p>
          <p className="font-semibold text-white">
            {substation.transformers}
          </p>
        </div>
      </div>
    </button>
  );
}
