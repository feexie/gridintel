import PageHeader from "@/components/shared/PageHeader";
import KPICard from "@/components/cards/KPICard";
import DataTable from "@/components/tables/DataTable";
import { meters } from "@/data/utility/meters";

const columns = [
  {
    header: "Serial Number",
    accessorKey: "serialNumber" as const,
  },
  {
    header: "Status",
    accessorKey: "status" as const,
  },
  {
    header: "Consumption (kWh)",
    accessorKey: "consumptionKwh" as const,
  },
];

export default function MetersPage() {
  const onlineMeters = meters.filter(
    (m) => m.status === "online"
  ).length;

  const warningMeters = meters.filter(
    (m) => m.status === "warning"
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Meter Intelligence"
        title="Advanced Metering Infrastructure"
        description="Smart meter operations, communication status, and consumption analytics."
      />

      <section className="grid gap-4 md:grid-cols-3">
        <KPICard
          title="Total Meters"
          value={String(meters.length)}
        />

        <KPICard
          title="Online Meters"
          value={String(onlineMeters)}
        />

        <KPICard
          title="Warning Meters"
          value={String(warningMeters)}
        />
      </section>

      <DataTable
        columns={columns}
        data={meters}
      />
    </div>
  );
}
