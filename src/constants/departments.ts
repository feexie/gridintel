/* ==========================================================
   DEPARTMENTS (ADR 0018, Phase 8A)

   A department is a set of permission keys: what an administrator
   gives a person when inviting them, or later. The examples of ADR
   0018, each for the sector its keys are in; an administrator is
   offered those of their organization's sectors only. "Every
   screen" holds no list: it is every screen of the organization's
   sectors, now and as screens are added.
========================================================== */

export interface Department {
  id: string;
  label: string;
  /** The sector whose screens it opens. */
  sector: "utility" | "minigrid";
  /** The keys held; null for every screen of the organization. */
  keys: readonly string[] | null;
}

export const DEPARTMENTS: readonly Department[] = [
  { id: "utility.every", label: "Every screen", sector: "utility", keys: null },
  { id: "utility.revenue", label: "Revenue department", sector: "utility", keys: ["utility.overview", "utility.map", "utility.revenue"] },
  { id: "utility.operations", label: "Operations room", sector: "utility", keys: ["utility.overview", "utility.map", "utility.events", "utility.operations"] },
  { id: "utility.planning", label: "Network planning", sector: "utility", keys: ["utility.overview", "utility.map", "utility.assets", "utility.reliability"] },
  { id: "utility.regulatory", label: "Regulatory reporting", sector: "utility", keys: ["utility.reports"] },
  { id: "minigrid.every", label: "Every screen", sector: "minigrid", keys: null },
  { id: "minigrid.reports", label: "Reports only", sector: "minigrid", keys: ["minigrid.reports"] },
];

/** The departments an organization holding these sectors may give. */
export function departmentsFor(sectors: readonly string[]): Department[] {
  return DEPARTMENTS.filter((department) => sectors.includes(department.sector));
}

/** The department whose keys a membership holds exactly; null for a list no department names. */
export function departmentOf(sectors: readonly string[], keys: readonly string[] | null): Department | null {
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((key) => b.includes(key));
  return departmentsFor(sectors).find((department) => (department.keys === null ? keys === null : keys !== null && same(department.keys, keys))) ?? null;
}
