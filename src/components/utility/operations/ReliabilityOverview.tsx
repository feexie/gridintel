export default function ReliabilityOverview() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="mb-6 text-lg font-semibold text-white">
        Reliability Overview
      </h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">

        <Metric
          label="SAIDI"
          value="1.82 hrs"
        />

        <Metric
          label="SAIFI"
          value="0.71"
        />

        <Metric
          label="CAIDI"
          value="2.56 hrs"
        />

        <Metric
          label="ASAI"
          value="99.42%"
        />

        <Metric
          label="Availability"
          value="99.87%"
        />

        <Metric
          label="Outages Today"
          value="3"
        />

      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
        {value}
      </p>
    </div>
  );
}
