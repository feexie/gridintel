import PageHeader from "@/components/shared/PageHeader";
import ModuleCard from "@/components/cards/ModuleCard";

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="GridIntel"
        title="Energy Intelligence for Utility and Distributed Energy Operations"
        description="Access operational, commercial, and planning intelligence across utility networks, distributed energy resources, mini-grid portfolios, and power system planning environments."
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Sector Suites
          </h2>

          <p className="text-sm text-slate-400">
            Select a sector workspace to access specialized operational,
            commercial, planning, and decision-support capabilities.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard
            title="Utility Intelligence"
            description="Operational visibility, asset intelligence, network performance, and revenue management for electricity distribution utilities."
            href="/dashboard/utility"
          />

          <ModuleCard
            title="DER Intelligence"
            description="Monitoring, analytics, forecasting, and performance management for distributed energy resource portfolios."
            href="/dashboard/der"
            accent="#10b981"
          />

          <ModuleCard
            title="MiniGrid Intelligence"
            description="Operational, technical, and commercial intelligence for mini-grid operators and developers."
            href="/dashboard/minigrid"
            accent="#f59e0b"
          />

          <ModuleCard
            title="Planning Intelligence"
            description="Network planning, forecasting, expansion analysis, electrification studies, and investment planning."
            href="/dashboard/planning"
            accent="#8b5cf6"
          />
        </div>
      </section>
    </div>
  );
}
