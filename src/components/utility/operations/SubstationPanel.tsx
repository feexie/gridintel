"use client";

import { useMemo } from "react";

import { substations } from "@/data/utility/substations";

import { useOperations } from "@/context/OperationsContext";

import SubstationCard from "./SubstationCard";

export default function SubstationPanel() {
  const {
    selection,
    selectSubstation,
  } = useOperations();

  const region = selection.region;

  const regionSubstations = useMemo(() => {
    if (!region) return [];

    return substations.filter(
      (substation) => substation.regionId === region.id
    );
  }, [region]);

  if (!region) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-400">
          Select a region to view its substations.
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
          {region.name} Distribution Region
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {regionSubstations.map((substation) => (
          <SubstationCard
            key={substation.id}
            substation={substation}
            selected={
              selection.substation?.id === substation.id
            }
            onClick={() => selectSubstation(substation)}
          />
        ))}
      </div>
    </section>
  );
}
