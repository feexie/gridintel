"use client";

import { regions } from "@/data/utility/regions";

import RegionCard from "./RegionCard";

type RegionSelectorProps = {
  selectedRegion: string;
  onRegionChange: (regionId: string) => void;
};

export default function RegionSelector({
  selectedRegion,
  onRegionChange,
}: RegionSelectorProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Distribution Regions
        </h2>

        <p className="text-sm text-slate-400">
          Select a region to drill down through substations, feeders,
          transformers and smart meters.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            selected={selectedRegion === region.id}
            onClick={() => onRegionChange(region.id)}
          />
        ))}
      </div>
    </section>
  );
}
