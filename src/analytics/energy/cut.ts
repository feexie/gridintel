import type { ScopeRef, ServicePoint } from "@/domain";
import type { CalcStatus, Warning } from "../core/result.ts";
import type { TopologyIndex } from "../topology/registry.ts";
import {
  TOPOLOGY_CURRENT_ONLY,
  feedersOfSubstation,
  servicePointsDirectOnFeeder,
  servicePointsOnTransformer,
  servicePointsUnder,
  transformersOnFeeder,
} from "../topology/registry.ts";

/* ==========================================================
   ANALYTICS — THE ELECTRICAL SECTIONS OF A SCOPE

   An electrical scope (substation, feeder, transformer) is its own
   section. An administrative scope (region, organization) is cut
   into the LARGEST electrical sections that lie wholly inside it:

   - a substation all of whose service points are in the scope;
   - otherwise each of its feeders that lies wholly inside;
   - otherwise each transformer on a divided feeder that lies wholly
     inside.

   Each service point is then in exactly one section, so nothing is
   counted twice. Two things cannot be cut and make the result not
   computable rather than approximate:
   - a transformer that serves two scopes;
   - a connection supplied directly by a feeder that is divided
     between scopes, because its energy cannot be separated from the
     feeder's.

   Where the cut falls below a substation, the losses upstream of the
   cut (the substation's own, and the feeder's between its head and
   the transformers) belong to no single scope and are in none. This
   is reported as a warning.

   The cut follows the registry's substation > feeder > transformer
   hierarchy. A source with another shape (a mini-grid site with its
   own generation) needs its own section types; nothing here assumes
   they cannot exist.
========================================================== */

export interface SectionCut {
  scope: ScopeRef;
  status: CalcStatus;
  /** Sections wholly inside the scope, each a substation, a feeder or a transformer. */
  sections: ScopeRef[];
  warnings: Warning[];
}

type Membership = "all" | "none" | "mixed";

export function sectionsForScope(index: TopologyIndex, scope: ScopeRef): SectionCut {
  if (scope.kind !== "region" && scope.kind !== "organization") {
    return { scope, status: "ok", sections: [scope], warnings: [] };
  }
  const inside = servicePointsUnder(index, scope);
  if (inside.value === null) return { scope, status: "not_computable", sections: [], warnings: inside.warnings };

  const insideIds = new Set(inside.value.map((sp) => sp.id));
  const regionIds = new Set(
    scope.kind === "region"
      ? [scope.id]
      : index.registry.regions.filter((region) => region.organizationId === scope.id).map((region) => region.id),
  );
  const membership = (points: readonly ServicePoint[]): Membership => {
    const count = points.filter((sp) => insideIds.has(sp.id)).length;
    return count === 0 ? "none" : count === points.length ? "all" : "mixed";
  };

  const sections: ScopeRef[] = [];
  const warnings: Warning[] = [TOPOLOGY_CURRENT_ONLY];
  let computable = true;
  let belowSubstation = false;

  const substations = [...index.registry.substations]
    .filter((substation) => substation.lifecycle === "in_service")
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const substation of substations) {
    const points = servicePointsUnder(index, { kind: "substation", id: substation.id }).value ?? [];
    if (points.length === 0) {
      // With no connections recorded, the substation's own region decides.
      if (substation.adminRegionId !== undefined && regionIds.has(substation.adminRegionId)) {
        sections.push({ kind: "substation", id: substation.id });
      }
      continue;
    }
    const whole = membership(points);
    if (whole === "none") continue;
    if (whole === "all") {
      sections.push({ kind: "substation", id: substation.id });
      continue;
    }

    belowSubstation = true;
    for (const feeder of feedersOfSubstation(index, substation.id)) {
      const feederPoints = servicePointsUnder(index, { kind: "feeder", id: feeder.id }).value ?? [];
      const onFeeder = membership(feederPoints);
      if (onFeeder === "none") continue;
      if (onFeeder === "all") {
        sections.push({ kind: "feeder", id: feeder.id });
        continue;
      }
      if (servicePointsDirectOnFeeder(index, feeder.id).some((sp) => insideIds.has(sp.id))) {
        computable = false;
        warnings.push({
          code: "CUT_NOT_POSSIBLE",
          message: `Feeder "${feeder.id}" is divided between scopes and supplies a connection in this scope directly; its energy cannot be separated.`,
          ref: feeder.id,
        });
      }
      for (const dt of transformersOnFeeder(index, feeder.id)) {
        const onTransformer = membership(servicePointsOnTransformer(index, dt.id));
        if (onTransformer === "all") sections.push({ kind: "distribution_transformer", id: dt.id });
        if (onTransformer === "mixed") {
          computable = false;
          warnings.push({
            code: "CUT_NOT_POSSIBLE",
            message: `Transformer "${dt.id}" serves connections inside and outside this scope; its energy cannot be divided between them.`,
            ref: dt.id,
          });
        }
      }
    }
  }

  if (belowSubstation) {
    warnings.push({
      code: "UPSTREAM_LOSSES_NOT_INCLUDED",
      message:
        "This scope does not follow substation boundaries, so it is accounted from feeders or transformers. " +
        "Losses upstream of them belong to no single scope and are not included.",
    });
  }
  if (!computable) return { scope, status: "not_computable", sections: [], warnings };
  if (sections.length === 0) {
    warnings.push({ code: "NO_SECTIONS", message: "No electrical section lies inside this scope.", ref: scope.id });
    return { scope, status: "insufficient_data", sections: [], warnings };
  }
  return { scope, status: "ok", sections, warnings };
}
