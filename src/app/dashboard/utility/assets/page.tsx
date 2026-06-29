import PageHeader from "@/components/shared/PageHeader";
import ModuleCard from "@/components/cards/ModuleCard";

export default function AssetsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset Registry"
        title="Utility Assets"
        description="Manage and monitor all physical and intelligent utility assets."
      />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <ModuleCard
          title="Substations"
          description="Transmission and distribution substations."
          href="/dashboard/utility/assets/substations"
        />

        <ModuleCard
          title="Feeders"
          description="Distribution feeder monitoring and analysis."
          href="/dashboard/utility/assets/feeders"
          accent="#10b981"
        />

        <ModuleCard
          title="Transformers"
          description="Transformer fleet and loading analytics."
          href="/dashboard/utility/assets/transformers"
          accent="#f59e0b"
        />

        <ModuleCard
          title="Meters"
          description="AMI and smart meter intelligence."
          href="/dashboard/utility/assets/meters"
          accent="#06b6d4"
        />
      </div>
    </div>
  );
}
