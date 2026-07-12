"use client";

import { useEffect, useMemo, useState } from "react";

import { substations } from "@/data/utility/substations";

import SubstationCard from "./SubstationCard";

type SubstationPanelProps = {
  regionId: string;
  onSubstationChange?: (substationId: string) => void;
};

export default function SubstationPanel({
  regionId,
  onSubstationChange,
}: SubstationPanelProps) {
  const regionSubstations = useMemo(() => {
    return substations.filter(
      (substation) => substation.regionId === regionId
    );
  }, [regionId]);

  const [selectedSubstation, setSelectedSubstation] = useState("");

  useEffect(() => {
    if (regionSubstations.length === 0) {
      setSelectedSubstation("");
      return;
    }

    setSelectedSubstation(regionSubstations[0].id);

    onSubstationChange?.(regionSubstations[0].id);
  }, [regionSubstations, onSubstationChange]);

  function handleSelect(id: string) {
    setSelectedSubstation(id);

    onSubstationChange?.(id);
  }

  if (regionSubstations.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Substations
        </h2>

        <p className="mt-3 text-slate-400">
          No substations available for this region.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Substations
        </h2>

        <p className="text-sm text-slate-400">
          Select a substation to continue drilling into the network.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {regionSubstations.map((substation) => (
          <SubstationCard
            key={substation.id}
            substation={substation}
            selected={selectedSubstation === substation.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </section>
  );
}
