import { SectorPlanned } from "@/components/overview/SectorPlanned";

/* DER Intelligence: planned, not built (ROADMAP; ADR 0017). The page holds no data and no figure. */
export default function DerPage() {
  return (
    <SectorPlanned
      sector="DER Intelligence"
      purpose="Distributed energy resources as operating assets, seen as fleets rather than one site at a time."
      covers={["Solar PV, storage, inverters and generators", "Performance of each asset and of the fleet", "Aggregation across sites", "Dispatch"]}
    />
  );
}
