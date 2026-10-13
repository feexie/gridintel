import { SectorPlanned } from "@/components/overview/SectorPlanned";

/* Planning: planned, not built (ROADMAP, Phase 12; ADR 0017). The page holds no data and no figure. */
export default function PlanningPage() {
  return (
    <SectorPlanned
      sector="Planning"
      purpose="Where the network and the sites should grow, worked out from the same records the other sectors read."
      covers={["Load growth", "Capacity", "Scenarios", "Investment priorities"]}
    />
  );
}
