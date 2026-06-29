import Link from "next/link";

type ModuleCardProps = {
  title: string;
  description: string;
  href: string;
  accent?: string;
};

export default function ModuleCard({
  title,
  description,
  href,
  accent = "#22d3ee",
}: ModuleCardProps) {
  return (
    <Link href={href}>
      <article className="h-full rounded-3xl border border-white/6 bg-white/[0.03] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.05]">
        <div
          className="h-1.5 w-16 rounded-full"
          style={{
            backgroundColor: accent,
          }}
        />

        <h3 className="mt-4 text-lg font-semibold text-white">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      </article>
    </Link>
  );
}
