import type { AssetKind, ScopeRef } from "@/domain";
import type { CalcStatus, Warning } from "../core/result.ts";
import type { MeterRole, TopologyIndex } from "../topology/registry.ts";
import {
  TOPOLOGY_CURRENT_ONLY,
  feederSuppliesSubstation,
  feedersOfSubstation,
  metersWithRole,
  servicePointsDirectOnFeeder,
  servicePointsOnTransformer,
  transformersOnFeeder,
} from "../topology/registry.ts";

/* ==========================================================
   ANALYTICS — ACCOUNTING BOUNDARIES

   An accounting section is bounded by meters, following the
   electrical hierarchy Substation → Feeder → DT → Service point:

   Distribution transformer
     input:      the DT's dt_totalizer meter(s)
     downstream: the service_point meter of each service point the
                 DT supplies

   Feeder
     input:      the feeder's feeder_head meter(s)
     downstream: the dt_totalizer meter(s) of each DT on the feeder,
                 and the service_point meter of each service point
                 supplied directly by the feeder

   Substation
     input:      the substation's substation_incomer meter(s)
     downstream: the feeder_head meter(s) of each feeder the
                 substation supplies

   Each element that must be metered is listed as a requirement. An
   element with no in-service meter of the right role is reported as
   a missing boundary input; a meter is never assumed to exist.

   Boundary energy is authoritative. Any DER/BESS connected inside
   the section is already in these readings and is not added again.
========================================================== */

export interface BoundaryRequirement {
  /** The element whose energy must be measured at this boundary. */
  assetKind: AssetKind;
  assetId: string;
  role: MeterRole;
  /** In-service meters found for this element; empty means the input is missing. */
  meterIds: string[];
}

export interface AccountingBoundary {
  scope: ScopeRef;
  status: CalcStatus;
  /** Positive flow is always downstream: into the section at input, out of it downstream. */
  direction: "downstream_positive";
  input: BoundaryRequirement[];
  downstream: BoundaryRequirement[];
  /** Human-readable names of every boundary element without a meter. */
  missingInputs: string[];
  warnings: Warning[];
}

function requirement(
  index: TopologyIndex,
  assetKind: AssetKind,
  assetId: string,
  role: MeterRole,
): BoundaryRequirement {
  return {
    assetKind,
    assetId,
    role,
    meterIds: metersWithRole(index, role, assetId).map((meter) => meter.id),
  };
}

function unsupported(scope: ScopeRef, code: string, message: string): AccountingBoundary {
  return {
    scope,
    status: "not_computable",
    direction: "downstream_positive",
    input: [],
    downstream: [],
    missingInputs: [],
    warnings: [{ code, message, ref: scope.id }],
  };
}

export function sectionBoundary(index: TopologyIndex, scope: ScopeRef): AccountingBoundary {
  let input: BoundaryRequirement[];
  let downstream: BoundaryRequirement[];

  switch (scope.kind) {
    case "distribution_transformer": {
      if (!index.transformerById.has(scope.id)) {
        return unsupported(scope, "SCOPE_NOT_FOUND", `No distribution transformer "${scope.id}".`);
      }
      input = [requirement(index, "distribution_transformer", scope.id, "dt_totalizer")];
      downstream = servicePointsOnTransformer(index, scope.id).map((sp) =>
        requirement(index, "service_point", sp.id, "service_point"),
      );
      break;
    }
    case "feeder": {
      if (!index.feederById.has(scope.id)) {
        return unsupported(scope, "SCOPE_NOT_FOUND", `No feeder "${scope.id}".`);
      }
      if (feederSuppliesSubstation(index, scope.id)) {
        return unsupported(
          scope,
          "UNSUPPORTED_TOPOLOGY",
          `Feeder "${scope.id}" supplies a substation. Energy leaving the feeder into a substation ` +
            "is not an accounting boundary this version supports.",
        );
      }
      input = [requirement(index, "feeder", scope.id, "feeder_head")];
      downstream = [
        ...transformersOnFeeder(index, scope.id).map((dt) =>
          requirement(index, "distribution_transformer", dt.id, "dt_totalizer"),
        ),
        ...servicePointsDirectOnFeeder(index, scope.id).map((sp) =>
          requirement(index, "service_point", sp.id, "service_point"),
        ),
      ];
      break;
    }
    case "substation": {
      if (!index.substationById.has(scope.id)) {
        return unsupported(scope, "SCOPE_NOT_FOUND", `No substation "${scope.id}".`);
      }
      input = [requirement(index, "substation", scope.id, "substation_incomer")];
      downstream = feedersOfSubstation(index, scope.id).map((feeder) =>
        requirement(index, "feeder", feeder.id, "feeder_head"),
      );
      break;
    }
    case "region":
    case "organization":
      return unsupported(
        scope,
        "UNSUPPORTED_SCOPE",
        "Energy accounting for administrative scopes needs cut-based aggregation across " +
          "sections, which is not implemented in this version.",
      );
  }

  const missingInputs = [...input, ...downstream]
    .filter((req) => req.meterIds.length === 0)
    .map((req) => `${req.role} meter for ${req.assetKind} ${req.assetId}`);

  return {
    scope,
    status: missingInputs.length > 0 ? "insufficient_data" : "ok",
    direction: "downstream_positive",
    input,
    downstream,
    missingInputs,
    warnings: [TOPOLOGY_CURRENT_ONLY],
  };
}
