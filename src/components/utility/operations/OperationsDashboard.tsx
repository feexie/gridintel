"use client";

import { useState } from "react";

import { regions } from "@/data/utility/regions";

import GridSummary from "./GridSummary";
import ReliabilityOverview from "./ReliabilityOverview";
import NetworkHealth from "./NetworkHealth";
import AlarmPanel from "./AlarmPanel";
import OutagePanel from "./OutagePanel";
import EdgeDeviceStatus from "./EdgeDeviceStatus";

import RegionSelector from "./RegionSelector";
import SubstationPanel from "./SubstationPanel";
import FeederPanel from "./FeederPanel";
import TransformerPanel from "./TransformerPanel";
import MeterPanel from "./MeterPanel";

export default function OperationsDashboard() {
  const [selectedRegion, setSelectedRegion] = useState(regions[0].id);

  const [selectedSubstation, setSelectedSubstation] =
    useState("");

  const [selectedFeeder, setSelectedFeeder] = useState("");

  const [selectedTransformer, setSelectedTransformer] =
    useState("");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">
          Utility Operations Center
        </h1>

        <p className="mt-2 text-slate-400">
          End-to-end operational visibility across the
          distribution network.
        </p>
      </header>

      <GridSummary />

      <RegionSelector
        selectedRegion={selectedRegion}
        onRegionChange={setSelectedRegion}
      />

      <SubstationPanel
        regionId={selectedRegion}
        onSubstationChange={setSelectedSubstation}
      />

      {selectedSubstation && (
        <FeederPanel
          substationId={selectedSubstation}
          onFeederChange={setSelectedFeeder}
        />
      )}

      {selectedFeeder && (
        <TransformerPanel
          feederId={selectedFeeder}
          onTransformerChange={setSelectedTransformer}
        />
      )}

      {selectedTransformer && (
        <MeterPanel
          transformerId={selectedTransformer}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ReliabilityOverview />
        <NetworkHealth />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AlarmPanel />
        <OutagePanel />
      </div>

      <EdgeDeviceStatus />
    </div>
  );
}
