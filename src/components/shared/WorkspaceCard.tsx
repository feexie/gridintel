import Link from "next/link";

type WorkspaceCardProps = {
  title: string;
  description: string;
  href: string;
  accent?: string;
};

export default function WorkspaceCard({
  title,
  description,
  href,
  accent = "#22d3ee",
}: WorkspaceCardProps) {
  return (
    <Link href={href}>
      <article className="group h-full rounded-3xl border border-white/5 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-slate-900">
        <div
          className="h-1.5 w-16 rounded-full"
          style={{
            backgroundColor: accent,
          }}
        />

        <h3 className="mt-6 text-xl font-semibold text-white transition-colors group-hover:text-cyan-300">
          {title}
        </h3>

        <p className="mt-3 leading-7 text-slate-400">
          {description}
        </p>

        <div className="mt-8 flex items-center justify-between">
          <span className="text-sm font-medium text-cyan-400">
            Open Workspace
          </span>

          <span className="text-xl text-cyan-400 transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </article>
    </Link>
  );
}
