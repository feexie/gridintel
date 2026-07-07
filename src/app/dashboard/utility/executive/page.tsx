import PageHeader from "@/components/shared/PageHeader";
import SectionHeader from "@/components/shared/SectionHeader";
import KPICard from "@/components/cards/KPICard";

import RegionCard from "@/components/utility/executive/RegionCard";

import {
  utilityRegions,
  executiveEvents,
} from "@/data/utility/executive";

export default function ExecutiveDashboardPage() {
  const totalCustomers = utilityRegions.reduce(
    (sum, region) => sum + region.customers,
    0
  );

  const totalRevenueBilled = utilityRegions.reduce(
    (sum, region) => sum + region.revenueBilled,
    0
  );

  const totalRevenueCollected = utilityRegions.reduce(
    (sum, region) => sum + region.revenueCollected,
    0
  );

  const averageSAIDI =
    utilityRegions.reduce(
      (sum, region) => sum + region.saidi,
      0
    ) / utilityRegions.length;

  const averageSAIFI =
    utilityRegions.reduce(
      (sum, region) => sum + region.saifi,
      0
    ) / utilityRegions.length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Utility Intelligence"
        title="Executive Dashboard"
        description="Enterprise-wide visibility into network assets, customers, reliability performance, operational events, and revenue performance."
      />

      {/* Enterprise Overview */}

      <section className="space-y-4">
        <SectionHeader
          title="Enterprise Overview"
          description="High-level utility performance across all operating regions."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Regions"
            value={String(utilityRegions.length)}
            delta="Operational"
          />

          <KPICard
            title="Customers"
            value={totalCustomers.toLocaleString()}
            delta="Active"
          />

          <KPICard
            title="Revenue Billed"
            value={`₦${(totalRevenueBilled / 1000000).toFixed(0)}M`}
            delta="Enterprise"
          />

          <KPICard
            title="Revenue Collected"
            value={`₦${(totalRevenueCollected / 1000000).toFixed(0)}M`}
            delta="Collected"
          />
        </div>
      </section>

      {/* Regional Overview */}

      <section className="space-y-4">
        <SectionHeader
          title="Regional Overview"
          description="Operational footprint and customer statistics by region."
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {utilityRegions.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
            />
          ))}
        </div>
      </section>

      {/* Live Operations Feed */}

      <section className="space-y-4">
        <SectionHeader
          title="Live Operations Feed"
          description="Real-time operational events and network incidents."
        />

        <div className="space-y-3">
          {executiveEvents.map((event) => (
            <div
              key={event.id}
              className="rounded-3xl border border-white/6 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">
                    {event.region} / {event.substation} /{" "}
                    {event.feeder}
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Status: {event.status}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-400">
                    {event.timestamp}
                  </p>

                  <p className="mt-1 font-medium text-white">
                    {event.customersAffected.toLocaleString()} Customers
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reliability & Revenue */}

      <section className="space-y-4">
        <SectionHeader
          title="Reliability & Revenue Performance"
          description="Enterprise-level service quality and commercial performance indicators."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title="Average SAIDI"
            value={averageSAIDI.toFixed(1)}
            delta="Hours"
          />

          <KPICard
            title="Average SAIFI"
            value={averageSAIFI.toFixed(1)}
            delta="Interruptions"
          />

          <KPICard
            title="Collection Efficiency"
            value="86.6%"
            delta="Enterprise"
          />

          <KPICard
            title="ATC&C Losses"
            value="17.1%"
            delta="Average"
          />
        </div>
      </section>
    </div>
  );
}
