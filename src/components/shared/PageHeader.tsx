type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
}: PageHeaderProps) {
  return (
    <header className="space-y-3">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300/80">
          {eyebrow}
        </p>
      ) : null}

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
    </header>
  );
}
