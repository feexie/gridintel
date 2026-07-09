import Image from "next/image";
import SectionHeader from "@/components/shared/SectionHeader";
import { partners } from "@/data/platform/partners";

export default function PartnerCarousel() {
  return (
    <section className="space-y-8">
      <SectionHeader
        title="Trusted By"
        description="GridIntel is designed to integrate with utilities, renewable energy developers, government agencies, investors, and technology partners."
      />

      <div className="grid gap-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {partners.map((partner) => (
          <div
            key={partner.id}
            className="flex h-28 items-center justify-center rounded-3xl border border-white/5 bg-white/[0.03] p-6 transition hover:border-cyan-400/30"
          >
            <Image
              src={partner.logo}
              alt={partner.name}
              width={140}
              height={70}
              className="max-h-12 w-auto object-contain"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
