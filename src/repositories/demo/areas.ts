import type { Area, Coordinates } from "@/domain";
import { REGISTRY_SOURCE, demoProvenance } from "./sources.ts";

/* ==========================================================
   DEMO ADAPTER — AREAS

   Three invented districts laid over the synthetic network, so that
   "what is inside an area" and "totals by area" have areas to work
   on. They are rectangles. THEY ARE NOT ADMINISTRATIVE BOUNDARIES:
   they are no state, LGA or ward of Nigeria, and their kind says so
   ("other"). Real boundaries are external data and are not in this
   dataset (see ADR 0014 for the proposal).

   They are cut so that the cases an area must handle all occur:
     - South holds Riverside substation, all of Old Town and the
       first four Market Road transformers;
     - North-west holds Hillcrest substation, all of Government
       Avenue and two Market Road transformers;
     - North-east holds all of Farm Road's transformers and the last
       six of Market Road's.
   So Market Road's route crosses all three and lies wholly in none,
   Farm Road's route starts in North-west (at Hillcrest) and runs
   into North-east, and a few service points lie across a boundary
   from the transformer that supplies them.

   The demonstration organization has no territory record: the only
   viewer of the demonstration sees everything.
========================================================== */

const SOUTH = 9.15;
const MIDDLE = 9.245;
const NORTH = 9.37;
const WEST = 12.35;
const DIVIDE = 12.51;
const EAST = 12.58;

function rectangle(south: number, west: number, north: number, east: number): Coordinates[] {
  return [
    { latitude: south, longitude: west },
    { latitude: south, longitude: east },
    { latitude: north, longitude: east },
    { latitude: north, longitude: west },
  ];
}

export function buildDemoAreas(): Area[] {
  const provenance = demoProvenance(REGISTRY_SOURCE);
  const district = (id: string, name: string, outer: Coordinates[]): Area => ({
    id,
    kind: "other",
    name,
    geometry: { type: "area", polygons: [{ outer }] },
    provenance,
  });
  return [
    district("demo-district-south", "Demonstration district South (synthetic)", rectangle(SOUTH, WEST, MIDDLE, EAST)),
    district("demo-district-north-west", "Demonstration district North-west (synthetic)", rectangle(MIDDLE, WEST, NORTH, DIVIDE)),
    district("demo-district-north-east", "Demonstration district North-east (synthetic)", rectangle(MIDDLE, DIVIDE, NORTH, EAST)),
  ];
}
