type PieChartProps = {
  title: string;
  note?: string;
};

export default function PieChart({ title, note }: PieChartProps) {
  return (
    <section className="rounded-3xl border border-white/6 bg-white/[0.03] p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {note ? <p className="mt-1 text-sm text-slate-400">{note}</p> : null}
      <div className="mt-6 h-56 rounded-2xl border border-dashed border-cyan-400/15 bg-slate-950/50" />
    </section>
  );
}
