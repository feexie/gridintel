"use client";

import { useMemo } from "react";

import { feeders } from "@/data/utility/feeders";

import { useOperations } from "@/context/OperationsContext";

import FeederCard from "./FeederCard";

export default function FeederPanel() {
  const {
    selection,
    selectFeeder,
  } = useOperations();

  const substation = selection.substation;

  const availableFeeders = useMemo(() => {
    if (!substation) return [];

    return feeders.filter(
      (feeder) =>
        feeder.substationId === substation.id
    );
  }, [substation]);

  if (!substation) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-400">
          Select a substation to view its feeders.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Feeders
        </h2>

        <p className="text-sm text-slate-400">
          {substation.name}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {availableFeeders.map((feeder) => (
          <FeederCard
            key={feeder.id}
            feeder={feeder}
            selected={
              selection.feeder?.id === feeder.id
            }
            onClick={() => selectFeeder(feeder)}
          />
        ))}
      </div>
    </section>
  );
}
