import PageHeader from "@/components/shared/PageHeader";
import ModuleCard from "@/components/cards/ModuleCard";

export default function UtilityPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Utility Workspace"
        title="Utility Operations Center"
        description="Monitor assets, network operations, outages, revenue assurance, and advanced metering intelligence."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          title="Network Operations"
          description="Monitor feeders, transformers, substations and network health."
          href="/dashboard/utility/network"
        />

        <ModuleCard
          title="Asset Registry"
          description="Manage substations, feeders, transformers and meters."
          href="/dashboard/utility/assets"
          accent="#10b981"
        />

        <ModuleCard
          title="Control Room"
          description="Real-time operational monitoring and dispatch."
          href="/dashboard/utility/control-room"
          accent="#f59e0b"
        />

        <ModuleCard
          title="Outage Management"
          description="Track faults, outages and restoration activities."
          href="/dashboard/utility/outages"
          accent="#ef4444"
        />

        <ModuleCard
          title="Revenue Assurance"
          description="Revenue collection, losses and commercial analytics."
          href="/dashboard/utility/revenue"
          accent="#8b5cf6"
        />

        <ModuleCard
          title="Meter Intelligence"
          description="AMI analytics, smart meter health and anomaly detection."
          href="/dashboard/utility/assets/meters"
          accent="#06b6d4"
        />
      </div>
    </div>
  );
}
