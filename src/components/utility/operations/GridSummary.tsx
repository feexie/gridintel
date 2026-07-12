import { substations } from "@/data/utility/substations";
import { feeders } from "@/data/utility/feeders";
import { transformers } from "@/data/utility/transformers";
import { meters } from "@/data/utility/meters";

export default function GridSummary() {
  const onlineSubstations = substations.filter(
    (s) => s.status === "online"
  ).length;

  const onlineFeeders = feeders.filter(
    (f) => f.status === "online"
  ).length;

  const onlineTransformers = transformers.filter(
    (t) => t.status === "online"
  ).length;

  const healthyMeters = meters.filter(
    (m) => m.status === "online"
  ).length;

  const cards = [
    {
      title: "Substations",
      value: substations.length,
      subtitle: `${onlineSubstations} online`,
    },
    {
      title: "Feeders",
      value: feeders.length,
      subtitle: `${onlineFeeders} online`,
    },
    {
      title: "Transformers",
      value: transformers.length,
      subtitle: `${onlineTransformers} online`,
    },
    {
      title: "Smart Meters",
      value: meters.length,
      subtitle: `${healthyMeters} communicating`,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
        >
          <p className="text-sm text-slate-400">
            {card.title}
          </p>

          <h2 className="mt-2 text-3xl font-bold text-white">
            {card.value}
          </h2>

          <p className="mt-1 text-sm text-emerald-400">
            {card.subtitle}
          </p>
        </div>
      ))}
    </section>
  );
}
