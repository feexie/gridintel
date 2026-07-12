"use client";

import { useMemo } from "react";

import { transformers } from "@/data/utility/transformers";

import { useOperations } from "@/context/OperationsContext";

import TransformerCard from "./TransformerCard";

export default function TransformerPanel() {
  const {
    selection,
    selectTransformer,
  } = useOperations();

  const feeder = selection.feeder;

  const availableTransformers = useMemo(() => {
    if (!feeder) return [];

    return transformers.filter(
      (transformer) =>
        transformer.feederId === feeder.id
    );
  }, [feeder]);

  if (!feeder) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-slate-400">
          Select a feeder to view its transformers.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">
          Distribution Transformers
        </h2>

        <p className="text-sm text-slate-400">
          {feeder.name}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {availableTransformers.map((transformer) => (
          <TransformerCard
            key={transformer.id}
            transformer={transformer}
            selected={
              selection.transformer?.id ===
              transformer.id
            }
            onClick={() =>
              selectTransformer(transformer)
            }
          />
        ))}
      </div>
    </section>
  );
}
