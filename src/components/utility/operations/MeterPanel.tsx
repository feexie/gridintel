"use client";

import { useMemo } from "react";

import { meters } from "@/data/utility/meters";

import { useOperations } from "@/context/OperationsContext";

import MeterCard from "./MeterCard";

export default function MeterPanel() {
  const {
    selection,
    selectMeter,
  } = useOperations();

  const transformer = selection.transformer;

  const availableMeters = useMemo(() => {
    if (!transformer) return [];

    return meters.filter(
      (meter) =>
        meter.parentAssetType === "transformer" &&
        meter.parentAssetId === transformer.id
    );
  }, [transformer]);

  if (!transformer) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-400">
          Select a transformer to view connected smart meters.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Smart Meters
        </h2>

        <p className="text-sm text-slate-400">
          {transformer.name}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {availableMeters.map((meter) => (
          <MeterCard
            key={meter.id}
            meter={meter}
            selected={
              selection.meter?.id === meter.id
            }
            onClick={() => selectMeter(meter)}
          />
        ))}
      </div>
    </section>
  );
}
