import PageHeader from "@/components/shared/PageHeader";
import NetworkOverview from "@/components/utility/overview/NetworkOverview";

export default function NetworkPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Network Operations"
        title="Distribution Network Control"
        description="Monitor feeders, substations, transformers, meters and operational alarms across the utility network."
      />

      <NetworkOverview />
    </div>
  );
}
