import type { Transformer } from "@/types/utility";

type TransformerCardProps = {
  transformer: Transformer;
  selected: boolean;
  onSelect: (id: string) => void;
};

export default function TransformerCard({
  transformer,
  selected,
  onSelect,
}: TransformerCardProps) {
  return (
    <button
      onClick={() => onSelect(transformer.id)}
      className={`w-full rounded-xl border p-5 text-left transition-all ${
        selected
          ? "border-cyan-500 bg-cyan-500/10"
          : "border-slate-800 bg-slate-900 hover:border-cyan-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">
            {transformer.name}
          </h3>

          <p className="text-xs text-slate-400">
            {transformer.ratingKva.toLocaleString()} kVA
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs capitalize ${
            transformer.status === "online"
              ? "bg-emerald-500/20 text-emerald-300"
              : transformer.status === "warning"
              ? "bg-yellow-500/20 text-yellow-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {transformer.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">

        <div>
          <p className="text-slate-500">Load</p>
          <p className="text-white font-semibold">
            {transformer.loadPercent.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">Voltage</p>
          <p className="text-white font-semibold">
            {transformer.voltageKv.toFixed(1)} kV
          </p>
        </div>

        <div>
          <p className="text-slate-500">Current</p>
          <p className="text-white font-semibold">
            {transformer.currentAmp.toFixed(0)} A
          </p>
        </div>

        <div>
          <p className="text-slate-500">Temperature</p>
          <p className="text-white font-semibold">
            {transformer.temperature.toFixed(1)} °C
          </p>
        </div>

        <div>
          <p className="text-slate-500">Customers</p>
          <p className="text-white font-semibold">
            {transformer.customers.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-slate-500">Smart Meters</p>
          <p className="text-white font-semibold">
            {transformer.smartMeters.toLocaleString()}
          </p>
        </div>

      </div>
    </button>
  );
}
