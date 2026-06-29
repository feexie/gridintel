type KPICardProps = {
  title: string;
  value: string;
  delta?: string;
};

export default function KPICard({ title, value, delta }: KPICardProps) {
  return (
    <article className="rounded-3xl border border-white/6 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.01)]">
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
        {delta ? (
          <p className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
            {delta}
          </p>
        ) : null}
      </div>
    </article>
  );
}
