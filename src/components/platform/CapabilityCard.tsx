import Image from "next/image";
import Link from "next/link";

import type { PlatformCapability } from "@/types/platform";

type CapabilityCardProps = {
  capability: PlatformCapability;
};

export default function CapabilityCard({
  capability,
}: CapabilityCardProps) {
  return (
    <Link href={capability.href}>
      <article className="group h-full overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03] transition duration-300 hover:border-cyan-400/40 hover:bg-white/[0.05]">
        <div className="relative h-52 w-full">
          <Image
            src={capability.image}
            alt={capability.title}
            fill
            sizes="(max-width:768px) 100vw,
                   (max-width:1280px) 50vw,
                   25vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        </div>

        <div className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-white">
            {capability.title}
          </h3>

          <p className="text-sm leading-7 text-slate-400">
            {capability.description}
          </p>

          <div className="font-medium text-cyan-300">
            Learn More →
          </div>
        </div>
      </article>
    </Link>
  );
}
