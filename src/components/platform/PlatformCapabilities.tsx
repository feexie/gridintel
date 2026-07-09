import SectionHeader from "@/components/shared/SectionHeader";
import CapabilityCard from "./CapabilityCard";
import { platformCapabilities } from "@/data/platform/capabilities";

export default function PlatformCapabilities() {
  return (
    <section className="space-y-8">
      <SectionHeader
        title="Platform Capabilities"
        description="Explore the sector intelligence suites that make up the GridIntel platform."
      />

      <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {platformCapabilities.map((capability) => (
          <CapabilityCard
            key={capability.title}
            capability={capability}
          />
        ))}
      </div>
    </section>
  );
}
