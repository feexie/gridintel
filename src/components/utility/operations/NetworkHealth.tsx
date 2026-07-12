import { substations } from "@/data/utility/substations";
import { feeders } from "@/data/utility/feeders";

export default function NetworkHealth() {
  const onlineSubstations = substations.filter(
    (substation) => substation.status === "online"
  ).length;

  const onlineFeeders = feeders.filter(
    (feeder) => feeder.status === "online"
  ).length;

  const totalSubstations = substations.length;

  const totalFeeders = feeders.length;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">
        Network Health
      </h2>

      <div className="space-y-5">

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-400">
              Substations Online
            </span>

            <span className="text-emerald-400">
              {onlineSubstations}/{totalSubstations}
            </span>
          </div>

          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{
                width: `${
                  (onlineSubstations / totalSubstations) * 100
                }%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-400">
              Feeders Online
            </span>

            <span className="text-cyan-400">
              {onlineFeeders}/{totalFeeders}
            </span>
          </div>

          <div className="h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-cyan-500"
              style={{
                width: `${
                  (onlineFeeders / totalFeeders) * 100
                }%`,
              }}
            />
          </div>
        </div>

      </div>
    </section>
  );
}
