"use client";

import type { Transformer } from "@/types/utility";

type TransformerCardProps = {
  transformer: Transformer;
  selected: boolean;
  onClick: () => void;
};

export default function TransformerCard({
  transformer,
  selected,
  onClick,
}: TransformerCardProps) {
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
          {transformer.name}
        </h3>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            transformer.status === "online"
              ? "bg-emerald-500/20 text-emerald-400"
              : transformer.status === "warning"
              ? "bg-amber-500/20 text-amber-400"
              : transformer.status === "maintenance"
              ? "bg-blue-500/20 text-blue-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {transformer.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Rating</p>
          <p className="font-semibold text-white">
            {transformer.ratingKva} kVA
          </p>
        </div>

        <div>
          <p className="text-slate-500">Load</p>
          <p className="font-semibold text-white">
            {transformer.loadPercent}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">Temperature</p>
          <p className="font-semibold text-white">
            {transformer.temperature}°C
          </p>
        </div>

        <div>
          <p className="text-slate-500">Customers</p>
          <p className="font-semibold text-white">
            {transformer.customers}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Smart Meters</p>
          <p className="font-semibold text-white">
            {transformer.smartMeters}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Communication</p>
          <p className="font-semibold text-white capitalize">
            {transformer.communicationStatus}
          </p>
        </div>
      </div>
    </button>
  );
}
