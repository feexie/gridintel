"use client";

import type { Region } from "@/types/utility";

type RegionCardProps = {
  region: Region;
  selected: boolean;
  onClick: () => void;
};

export default function RegionCard({
  region,
  selected,
  onClick,
}: RegionCardProps) {
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
          {region.name}
        </h3>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            region.status === "online"
              ? "bg-emerald-500/20 text-emerald-400"
              : region.status === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : region.status === "maintenance"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {region.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Substations</p>
          <p className="font-semibold text-white">
            {region.substations}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Feeders</p>
          <p className="font-semibold text-white">
            {region.feeders}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Transformers</p>
          <p className="font-semibold text-white">
            {region.transformers}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Customers</p>
          <p className="font-semibold text-white">
            {region.customers.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-slate-500">SAIDI</p>
          <p className="font-semibold text-white">
            {region.saidi.toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">SAIFI</p>
          <p className="font-semibold text-white">
            {region.saifi.toFixed(2)}
          </p>
        </div>
      </div>
    </button>
  );
}
