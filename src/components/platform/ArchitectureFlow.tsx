import SectionHeader from "@/components/shared/SectionHeader";
import { architecture } from "@/data/platform/architecture";

export default function ArchitectureFlow() {
  return (
    <section className="space-y-8">
      <SectionHeader
        title="Platform Architecture"
        description="GridIntel transforms field data into operational intelligence through a scalable cloud-native architecture."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {architecture.map((step, index) => (
          <div
            key={step.id}
            className="relative rounded-3xl border border-white/5 bg-slate-900/60 p-6"
          >
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-lg font-bold text-cyan-300">
              {index + 1}
            </div>

            <h3 className="text-lg font-semibold text-white">
              {step.title}
            </h3>

            <p className="mt-3 text-sm leading-7 text-slate-400">
              {step.description}
            </p>

            {index < architecture.length - 1 && (
              <div className="absolute right-[-18px] top-1/2 hidden text-cyan-400 lg:block">
                →
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
