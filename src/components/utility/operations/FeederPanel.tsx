"use client";

import { useEffect, useMemo, useState } from "react";

import { feeders } from "@/data/utility/feeders";

import FeederCard from "./FeederCard";

type FeederPanelProps = {
  substationId: string;
  onFeederChange?: (feederId: string) => void;
};

export default function FeederPanel({
  substationId,
  onFeederChange,
}: FeederPanelProps) {
  const substationFeeders = useMemo(() => {
    return feeders.filter(
      (feeder) => feeder.substationId === substationId
    );
  }, [substationId]);

  const [selectedFeeder, setSelectedFeeder] = useState("");

  useEffect(() => {
    if (substationFeeders.length === 0) {
      setSelectedFeeder("");
      return;
    }

    setSelectedFeeder(substationFeeders[0].id);

    onFeederChange?.(substationFeeders[0].id);
  }, [substationFeeders, onFeederChange]);

  function handleSelect(id: string) {
    setSelectedFeeder(id);

    onFeederChange?.(id);
  }

  if (substationFeeders.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Feeders
        </h2>

        <p className="mt-3 text-slate-400">
          No feeders available for this substation.
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
          Select a feeder to continue drilling into distribution
          transformers.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {substationFeeders.map((feeder) => (
          <FeederCard
            key={feeder.id}
            feeder={feeder}
            selected={selectedFeeder === feeder.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </section>
  );
}
