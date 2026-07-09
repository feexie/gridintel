import Hero from "@/components/platform/Hero";
import PlatformCapabilities from "@/components/platform/PlatformCapabilities";
import ArchitectureFlow from "@/components/platform/ArchitectureFlow";
import FounderStory from "@/components/platform/FounderStory";
import PartnerCarousel from "@/components/platform/PartnerCarousel";

export default function DashboardPage() {
  return (
    <div className="space-y-20">
      <Hero />

      <PlatformCapabilities />

      <ArchitectureFlow />

      <FounderStory />

      <PartnerCarousel />
    </div>
  );
}
