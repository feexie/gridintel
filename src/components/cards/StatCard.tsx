import type { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: ReactNode;
  helper?: string;
};

export default function StatCard({ title, value, helper }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-white/5 bg-slate-900/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {helper ? <p className="mt-2 text-sm text-slate-400">{helper}</p> : null}
    </article>
  );
}
