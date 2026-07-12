import type { Feeder } from "@/types/utility";

type FeederCardProps = {
  feeder: Feeder;
  selected: boolean;
  onSelect: (id: string) => void;
};

export default function FeederCard({
  feeder,
  selected,
  onSelect,
}: FeederCardProps) {
  return (
    <button
      onClick={() => onSelect(feeder.id)}
      className={`w-full rounded-xl border p-5 text-left transition-all duration-200 ${
        selected
          ? "border-cyan-500 bg-cyan-500/10"
          : "border-slate-800 bg-slate-900 hover:border-cyan-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {feeder.name}
          </h3>

          <p className="mt-1 text-xs text-slate-400">
            {feeder.feederCode}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            feeder.status === "online"
              ? "bg-emerald-500/20 text-emerald-300"
              : feeder.status === "warning"
              ? "bg-amber-500/20 text-amber-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {feeder.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">

        <div>
          <p className="text-slate-500">Current Load</p>
          <p className="font-semibold text-white">
            {feeder.currentLoadMw.toFixed(1)} MW
          </p>
        </div>

        <div>
          <p className="text-slate-500">Allocated</p>
          <p className="font-semibold text-white">
            {feeder.allocatedMw.toFixed(1)} MW
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
          <p className="font-semibold text-red-400">
            {feeder.technicalLoss.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">Commercial Loss</p>
          <p className="font-semibold text-red-400">
            {feeder.commercialLoss.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-slate-500">SAIDI</p>
          <p className="font-semibold text-white">
            {feeder.saidi.toFixed(2)}
          </p>
        </div>

        <div>
          <p className="text-slate-500">SAIFI</p>
          <p className="font-semibold text-white">
            {feeder.saifi.toFixed(2)}
          </p>
        </div>

      </div>
    </button>
  );
}
