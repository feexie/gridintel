import PageHeader from "@/components/shared/PageHeader";
import SectionHeader from "@/components/shared/SectionHeader";
import StatusBadge from "@/components/shared/StatusBadge";
import KPICard from "@/components/cards/KPICard";
import StatCard from "@/components/cards/StatCard";
import LineChart from "@/components/charts/LineChart";
import DataTable from "@/components/tables/DataTable";
import { alarms } from "@/data/utility/alarms";
import { feeders } from "@/data/utility/feeders";
import { revenueRecords } from "@/data/utility/revenue";
import { substations } from "@/data/utility/substations";
import { transformers } from "@/data/utility/transformers";

const alarmColumns = [
  { header: "Alarm", accessorKey: "title" as const },
  { header: "Source", accessorKey: "source" as const },
  { header: "Severity", accessorKey: "severity" as const },
  { header: "Status", accessorKey: "status" as const },
];

const revenueColumns = [
  { header: "Period", accessorKey: "period" as const },
  { header: "Revenue", accessorKey: "amount" as const },
  { header: "Collection %", accessorKey: "collectionRate" as const },
];

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Utility"
        title="Utility Operations Center"
        description="Live operational overview for network health, assets, alarms, and revenue."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KPICard title="Network Health" value="96%" delta="+2.1%" />
        <KPICard title="Active Feeders" value={String(feeders.length)} delta="Stable" />
        <KPICard title="Active Transformers" value={String(transformers.length)} delta="Healthy" />
        <KPICard title="Revenue Collection" value="93%" delta="+1.4%" />
        <KPICard title="Active Alarms" value={String(alarms.length)} delta="2 Critical" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          title="Substations"
          value={String(substations.length)}
          helper="Monitored across the utility network"
        />
        <StatCard
          title="Operational Status"
          value={<StatusBadge status="online" />}
          helper="Dashboard shell and utility overview are live"
        />
        <StatCard
          title="Collection Rate"
          value="93%"
          helper="Recent revenue collection snapshot"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <LineChart
          title="Network Performance"
          note="Placeholder chart for operational trend visualization."
        />

        <div className="space-y-4">
          <div className="rounded-3xl border border-white/6 bg-white/[0.03] p-5">
            <h3 className="text-lg font-semibold text-white">Critical Alarm Snapshot</h3>
            <p className="mt-1 text-sm text-slate-400">
              High-priority incidents from the static utility data set.
            </p>
            <div className="mt-4 space-y-3">
              {alarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-white/5 bg-slate-950/60 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{alarm.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{alarm.source}</p>
                  </div>
                  <StatusBadge status={alarm.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader
            title="Critical Alarms"
            description="Current high-priority incidents from the static utility data set."
          />
          <DataTable columns={alarmColumns} data={alarms} />
        </div>

        <div className="space-y-4">
          <SectionHeader
            title="Recent Events"
            description="Recent collections and performance snapshots for the operations team."
          />
          <DataTable columns={revenueColumns} data={revenueRecords} />
        </div>
      </section>
    </div>
  );
}
