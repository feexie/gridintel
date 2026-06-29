import KPICard from "@/components/cards/KPICard";
import { alarms } from "@/data/utility/alarms";
import { feeders } from "@/data/utility/feeders";
import { meters } from "@/data/utility/meters";
import { substations } from "@/data/utility/substations";
import { transformers } from "@/data/utility/transformers";

export default function NetworkOverview() {
  const onlineFeeders = feeders.filter(
    (item) => item.status === "online"
  ).length;

  const healthyTransformers = transformers.filter(
    (item) => item.status === "online"
  ).length;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <KPICard
        title="Substations"
        value={String(substations.length)}
        delta="Live"
      />

      <KPICard
        title="Feeders"
        value={String(onlineFeeders)}
        delta="Online"
      />

      <KPICard
        title="Transformers"
        value={String(healthyTransformers)}
        delta="Healthy"
      />

      <KPICard
        title="Meters"
        value={String(meters.length)}
        delta="Connected"
      />

      <KPICard
        title="Active Alarms"
        value={String(alarms.length)}
        delta="Monitor"
      />
    </section>
  );
}
