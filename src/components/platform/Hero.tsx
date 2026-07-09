import Image from "next/image";

export default function Hero() {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="grid gap-12 px-10 py-16 lg:grid-cols-2 lg:items-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-400">
              GridIntel Platform
            </p>

            <h1 className="text-5xl font-bold leading-tight text-white">
              Sector-Based Energy Intelligence
            </h1>

            <p className="max-w-xl text-lg leading-8 text-slate-300">
              GridIntel is an enterprise energy intelligence platform that
              delivers operational visibility, asset intelligence, AI-driven
              analytics, and decision support across utilities, distributed
              energy resources, mini-grids, and power system planning.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <button className="rounded-xl bg-cyan-500 px-6 py-3 font-medium text-slate-950 transition hover:bg-cyan-400">
              Explore Sector Suites
            </button>

            <button className="rounded-xl border border-white/10 px-6 py-3 font-medium text-white transition hover:border-cyan-400">
              Learn More
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="rounded-3xl border border-white/5 bg-slate-900/60 p-8">
            <Image
              src="/images/logo/Grid-Intel.png"
              alt="GridIntel"
              width={300}
              height={300}
              priority
	      className="h-16 w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
