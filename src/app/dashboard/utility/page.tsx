import PageHeader from "@/components/shared/PageHeader";
import ModuleCard from "@/components/cards/ModuleCard";

export default function UtilityWorkspacePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Utility Intelligence"
        title="Utility Intelligence Suite"
        description="Integrated executive, operational, commercial, and intelligence capabilities for electricity distribution utilities."
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Utility Workspaces
          </h2>

          <p className="text-sm text-slate-400">
            Access utility-specific dashboards, operations, commercial
            intelligence, and decision-support capabilities.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Executive Dashboard"
            description="Enterprise-wide visibility into customers, assets, reliability performance, operational events, and revenue."
            href="/dashboard/utility/executive"
          />

          <ModuleCard
            title="Operations Center"
            description="Monitor substations, feeders, transformers, network events, and operational performance."
            href="/dashboard/utility/operations"
            accent="#10b981"
          />

          <ModuleCard
            title="Revenue Center"
            description="Revenue assurance, billing, collections, losses, metering performance, and commercial analytics."
            href="/dashboard/utility/revenue"
            accent="#8b5cf6"
          />

          <ModuleCard
            title="AI Insights"
            description="Forecasting, anomaly detection, predictive intelligence, and decision support."
            href="/dashboard/utility/ai"
            accent="#06b6d4"
          />
        </div>
      </section>
    </div>
  );
}
