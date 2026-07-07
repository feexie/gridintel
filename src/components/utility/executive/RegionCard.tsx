import type { UtilityRegion } from "@/types/executive";

type RegionCardProps = {
  region: UtilityRegion;
};

export default function RegionCard({
  region,
}: RegionCardProps) {
  const collectionEfficiency =
    (region.revenueCollected / region.revenueBilled) * 100;

  return (
    <article className="rounded-3xl border border-white/6 bg-white/[0.03] p-5 transition hover:border-cyan-400/20">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {region.name}
        </h3>

        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
          Region
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Customers
          </p>

          <p className="mt-1 text-xl font-semibold text-white">
            {region.customers.toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Revenue Collected
          </p>

          <p className="mt-1 text-xl font-semibold text-white">
            ₦{(region.revenueCollected / 1000000).toFixed(1)}M
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Collection Efficiency
          </p>

          <p className="mt-1 text-xl font-semibold text-white">
            {collectionEfficiency.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            ATC&C Losses
          </p>

          <p className="mt-1 text-xl font-semibold text-white">
            {region.atccLosses}%
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-white/5 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">SAIDI</p>
            <p className="font-medium text-white">
              {region.saidi} hrs
            </p>
          </div>

          <div>
            <p className="text-slate-500">SAIFI</p>
            <p className="font-medium text-white">
              {region.saifi}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Substations</p>
            <p className="font-medium text-white">
              {region.substations}
            </p>
          </div>

          <div>
            <p className="text-slate-500">Feeders</p>
            <p className="font-medium text-white">
              {region.feeders}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
