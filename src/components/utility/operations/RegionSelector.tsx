"use client";

import { regions } from "@/data/utility/regions";

import { useOperations } from "@/context/OperationsContext";

import RegionCard from "./RegionCard";

export default function RegionSelector() {
  const {
    selection,
    selectRegion,
  } = useOperations();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Distribution Regions
        </h2>

        <p className="text-sm text-slate-400">
          Select a region to begin exploring the network hierarchy.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            selected={selection.region?.id === region.id}
            onClick={() => selectRegion(region)}
          />
        ))}
      </div>
    </section>
  );
}
