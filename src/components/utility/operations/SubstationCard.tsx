import type { Substation } from "@/types/utility";

type SubstationCardProps = {
  substation: Substation;
  selected: boolean;
  onSelect: (id: string) => void;
};

export default function SubstationCard({
  substation,
  selected,
  onSelect,
}: SubstationCardProps) {
  return (
    <button
      onClick={() => onSelect(substation.id)}
      className={`w-full rounded-xl border p-5 text-left transition-all duration-200 ${
        selected
          ? "border-cyan-500 bg-cyan-500/10"
          : "border-slate-800 bg-slate-900 hover:border-cyan-600"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {substation.name}
          </h3>

          <p className="text-xs text-slate-400 mt-1">
            {substation.voltageLevel}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            substation.status === "online"
              ? "bg-emerald-500/20 text-emerald-300"
              : substation.status === "warning"
              ? "bg-yellow-500/20 text-yellow-300"
              : "bg-red-500/20 text-red-300"
          }`}
        >
          {substation.status}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Current Load</p>
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

        <div>
          <p className="text-slate-500">Frequency</p>
          <p className="font-semibold text-white">
            {substation.frequencyHz.toFixed(2)} Hz
          </p>
        </div>

        <div>
          <p className="text-slate-500">Power Factor</p>
          <p className="font-semibold text-white">
            {substation.powerFactor.toFixed(2)}
          </p>
        </div>
      </div>
    </button>
  );
}
