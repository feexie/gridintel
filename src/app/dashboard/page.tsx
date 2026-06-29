import ModuleCard from "@/components/cards/ModuleCard";
import PageHeader from "@/components/shared/PageHeader";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="GridIntel Platform"
        title="Energy Intelligence Command Center"
        description="Select a workspace to manage utility operations, distributed energy resources, planning studies, GIS intelligence, and AI-driven analytics."
      />

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Operational Workspaces
        </h2>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Utility Workspace"
            description="Distribution operations, meters, outages, revenue, and assets."
            href="/dashboard/utility"
          />

          <ModuleCard
            title="MiniGrid Workspace"
            description="Manage hybrid mini-grid assets and performance."
            href="/dashboard/minigrid"
            accent="#10b981"
          />

          <ModuleCard
            title="DER Workspace"
            description="Distributed energy resources and flexibility management."
            href="/dashboard/der"
            accent="#f59e0b"
          />

          <ModuleCard
            title="Planning Workspace"
            description="Network planning, forecasting, and expansion studies."
            href="/dashboard/planning"
            accent="#8b5cf6"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">
          Intelligence Services
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          <ModuleCard
            title="GIS Intelligence"
            description="Spatial network visibility and geospatial analytics."
            href="/dashboard/intelligence/gis"
          />

          <ModuleCard
            title="AI Copilot"
            description="Operational insights, recommendations, and anomaly detection."
            href="/dashboard/intelligence/ai"
            accent="#ec4899"
          />

          <ModuleCard
            title="Enterprise Analytics"
            description="Executive reporting and business intelligence."
            href="/dashboard/intelligence/analytics"
            accent="#06b6d4"
          />
        </div>
      </section>
    </div>
  );
}
