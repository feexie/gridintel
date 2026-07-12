"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Region,
  Substation,
  Feeder,
  Transformer,
  Meter,
} from "@/types/utility";

export interface OperationsSelection {
  region?: Region;
  substation?: Substation;
  feeder?: Feeder;
  transformer?: Transformer;
  meter?: Meter;
}

interface OperationsContextValue {
  selection: OperationsSelection;

  selectRegion: (region: Region) => void;

  selectSubstation: (substation: Substation) => void;

  selectFeeder: (feeder: Feeder) => void;

  selectTransformer: (
    transformer: Transformer
  ) => void;

  selectMeter: (meter: Meter) => void;

  clearSelection: () => void;
}

const OperationsContext =
  createContext<OperationsContextValue | null>(null);

export function OperationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selection, setSelection] =
    useState<OperationsSelection>({});

  function selectRegion(region: Region) {
    setSelection({
      region,
    });
  }

  function selectSubstation(
    substation: Substation
  ) {
    setSelection((previous) => ({
      ...previous,

      substation,

      feeder: undefined,

      transformer: undefined,

      meter: undefined,
    }));
  }

  function selectFeeder(feeder: Feeder) {
    setSelection((previous) => ({
      ...previous,

      feeder,

      transformer: undefined,

      meter: undefined,
    }));
  }

  function selectTransformer(
    transformer: Transformer
  ) {
    setSelection((previous) => ({
      ...previous,

      transformer,

      meter: undefined,
    }));
  }

  function selectMeter(meter: Meter) {
    setSelection((previous) => ({
      ...previous,

      meter,
    }));
  }

  function clearSelection() {
    setSelection({});
  }

  const value = useMemo(
    () => ({
      selection,

      selectRegion,

      selectSubstation,

      selectFeeder,

      selectTransformer,

      selectMeter,

      clearSelection,
    }),
    [selection]
  );

  return (
    <OperationsContext.Provider value={value}>
      {children}
    </OperationsContext.Provider>
  );
}

export function useOperations() {
  const context = useContext(OperationsContext);

  if (!context) {
    throw new Error(
      "useOperations must be used inside OperationsProvider."
    );
  }

  return context;
}
