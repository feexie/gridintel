"use client";

import { useMemo } from "react";

import { meters } from "@/data/utility/meters";

import MeterActivity from "./MeterActivity";

type MeterPanelProps = {
  transformerId: string;
};

export default function MeterPanel({
  transformerId,
}: MeterPanelProps) {
  const transformerMeters = useMemo(() => {
    return meters.filter((meter) => {
      return (
        meter.assetType === "transformer" &&
        meter.assetId === transformerId
      );
    });
  }, [transformerId]);

  return (
    <section className="space-y-4">

      <div>
        <h2 className="text-xl font-semibold text-white">
          Smart Meter Fleet
        </h2>

        <p className="text-sm text-slate-400">
          Real-time telemetry from all smart meters connected to the selected
          transformer.
        </p>
      </div>

      <MeterActivity meters={transformerMeters} />

    </section>
  );
}
