"use client";

import { useEffect, useMemo, useState } from "react";

import { transformers } from "@/data/utility/transformers";

import TransformerCard from "./TransformerCard";

type TransformerPanelProps = {
  feederId: string;
  onTransformerChange?: (transformerId: string) => void;
};

export default function TransformerPanel({
  feederId,
  onTransformerChange,
}: TransformerPanelProps) {
  const feederTransformers = useMemo(() => {
    return transformers.filter(
      (transformer) => transformer.feederId === feederId
    );
  }, [feederId]);

  const [selectedTransformer, setSelectedTransformer] =
    useState("");

  useEffect(() => {
    if (feederTransformers.length === 0) {
      setSelectedTransformer("");
      return;
    }

    setSelectedTransformer(feederTransformers[0].id);

    onTransformerChange?.(feederTransformers[0].id);
  }, [feederTransformers, onTransformerChange]);

  function handleSelect(id: string) {
    setSelectedTransformer(id);

    onTransformerChange?.(id);
  }

  if (feederTransformers.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-white">
          Distribution Transformers
        </h2>

        <p className="mt-3 text-slate-400">
          No transformers found for this feeder.
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
          Select a transformer to inspect connected smart meters
          and equipment health.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {feederTransformers.map((transformer) => (
          <TransformerCard
            key={transformer.id}
            transformer={transformer}
            selected={selectedTransformer === transformer.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

    </section>
  );
}
