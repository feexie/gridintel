"use client";

import { OperationsProvider } from "@/context/OperationsContext";

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

function OperationsWorkspace() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">
          Utility Operations Center
        </h1>

        <p className="mt-2 text-slate-400">
          End-to-end operational visibility across the electricity
          distribution network.
        </p>
      </header>

      <GridSummary />

      <RegionSelector />

      <SubstationPanel />

      <FeederPanel />

      <TransformerPanel />

      <MeterPanel />

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

export default function OperationsDashboard() {
  return (
    <OperationsProvider>
      <OperationsWorkspace />
    </OperationsProvider>
  );
}
