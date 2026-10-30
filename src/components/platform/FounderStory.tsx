import Image from "next/image";
import SectionHeader from "@/components/shared/SectionHeader";

export default function FounderStory() {
  return (
    <section className="space-y-8">
      <SectionHeader
        title="The Story Behind GridIntel"
        description="GridIntel was founded to modernize electricity operations through edge intelligence, cloud analytics, and decision support built on the utility's own records."
      />

      <div className="grid gap-8 items-center lg:grid-cols-[320px_1fr]">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-slate-900">
          <Image
            src="/images/founder/founder.jpeg"
            alt="Founder"
            fill
            sizes="320px"
            className="object-cover"
          />
        </div>

        <div className="space-y-5 text-slate-300 leading-8">
          <p>
            GridIntel was born from years of experience working across
            electricity distribution, mini-grids, renewable energy systems,
            and digital transformation projects in Africa.
          </p>

          <p>
            The platform combines intelligent edge devices with cloud-native
            software to deliver real-time visibility into substations,
            feeders, transformers, smart meters, and customer operations.
          </p>

          <p>
            We help utilities, regulators and mini-grid operators see what
            their records actually show, so they can improve reliability,
            reduce losses, connect more customers sooner, and base their
            decisions on the figures.
          </p>
        </div>
      </div>
    </section>
  );
}
