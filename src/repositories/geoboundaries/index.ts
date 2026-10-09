import type { Area, AreaKind, DataSource, Polygon, Provenance } from "@/domain";
import type { GridIntelRepositories } from "../ports/index.ts";
import SOURCE_HEADERS from "./data/nga-sources.json" with { type: "json" };

/* ==========================================================
   GEOBOUNDARIES ADAPTER — NIGERIA'S STATES AND LGAs

   Administrative boundaries from geoBoundaries (gbOpen), Nigeria:
   ADM1, the 36 states and the Federal Capital Territory, and ADM2,
   the 774 local government areas. Licence CC BY 4.0; geoBoundaries'
   stated source is GRID3. REAL DATA, not synthetic: the only real
   records the application holds today.

   The files under ./data are built from the published files by
   scripts/build-boundaries.mjs, which records in each the URL, the
   SHA-256 of the original, the licence, the release and the dates.
   Everything said about the source here is read from those files.

   WHAT THEY ARE GOOD FOR. Orientation, stating a territory by state
   or LGA, and sorting located things into areas. They are simplified
   outlines and are NOT SURVEY-GRADE: a point near a line can fall on
   the wrong side, and they are no basis for a licence area or a
   boundary dispute. An LGA's state is not in the published file; it
   was worked out from the geometry and is marked derived.

   A level's geometry is read only when that level is asked for. The
   sources are read from a small file of their own, with no geometry.

   The licence requires credit wherever the boundaries are shown:
   `BOUNDARY_CREDIT`.
========================================================== */

export const BOUNDARY_CREDIT = "Boundaries: geoBoundaries (CC BY 4.0), Runfola et al. 2020";
export const BOUNDARY_NOTE = "Administrative boundaries from geoBoundaries, not survey-grade.";

interface BoundarySource {
  publisher: string;
  boundarySource: string;
  licence: string;
  release: string;
  yearRepresented: string;
  retrieved: string;
  level: string;
  boundaryId: string;
  url: string;
  sha256: string;
  geometry: string;
  parentLink?: string;
  parentMethod?: string;
}

interface BoundaryFile {
  source: BoundarySource;
  kind: string;
  areas: { id: string; name: string; code?: string; parentId?: string; polygons: number[][][][] }[];
}

const LEVEL_NAME: Record<string, string> = { ADM1: "states", ADM2: "local government areas" };

function sourceOf(source: BoundarySource): DataSource {
  return {
    id: `geoboundaries-gbopen-nga-${source.level.toLowerCase()}`,
    name: `geoBoundaries (gbOpen): Nigeria ${LEVEL_NAME[source.level] ?? source.level}`,
    kind: "gis",
    description:
      `Administrative boundaries published by geoBoundaries, from ${source.boundarySource}; boundary ${source.boundaryId}. ${source.geometry} ` +
      `Original file SHA-256 ${source.sha256}. Not survey-grade.`,
    licence: source.licence,
    attribution: BOUNDARY_CREDIT,
    url: source.url,
    release: source.release,
    dated: `Represents ${source.yearRepresented}; retrieved ${source.retrieved}`,
    notice: BOUNDARY_NOTE,
  };
}

/** The two sources, from the small file that holds only what each boundary file is: no geometry is read for them. */
export const GEOBOUNDARIES_SOURCES: readonly DataSource[] = (SOURCE_HEADERS as { source: BoundarySource }[]).map((header) => sourceOf(header.source));

function areasOf(file: BoundaryFile): Area[] {
  const dataSource = sourceOf(file.source);
  const derived = file.source.parentLink === "derived";
  const method = file.source.parentMethod === undefined ? file.source.geometry : `${file.source.geometry} Parent area derived: ${file.source.parentMethod}`;
  return file.areas.map((area): Area => {
    const provenance: Provenance = {
      sourceSystem: dataSource.id,
      sourceRecordId: area.id.replace(/^gb-/, ""),
      // The day the published file was retrieved and checked.
      ingestedAt: `${file.source.retrieved}T00:00:00Z`,
      method,
      methodologyVersion: file.source.release,
    };
    return {
      id: area.id,
      kind: file.kind as AreaKind,
      name: area.name,
      ...(area.code === undefined ? {} : { code: area.code }),
      ...(area.parentId === undefined ? {} : { parentAreaId: area.parentId, parentBasis: derived ? ("derived" as const) : ("recorded" as const) }),
      geometry: {
        type: "area",
        polygons: area.polygons.map((rings): Polygon => {
          const [outer, ...holes] = rings.map((ring) => ring.map(([longitude, latitude]) => ({ latitude, longitude })));
          return holes.length > 0 ? { outer, holes } : { outer };
        }),
      },
      provenance,
    };
  });
}

/** Each level is read and turned into records once per process, on first use. */
const loaded = new Map<"state" | "lga", Promise<Area[]>>();

function level(kind: "state" | "lga"): Promise<Area[]> {
  let pending = loaded.get(kind);
  if (pending === undefined) {
    const file: Promise<{ default: unknown }> =
      kind === "state" ? import("./data/nga-adm1.json", { with: { type: "json" } }) : import("./data/nga-adm2.json", { with: { type: "json" } });
    pending = file.then((module_) => areasOf(module_.default as BoundaryFile));
    loaded.set(kind, pending);
  }
  return pending;
}

/**
 * The given repositories with Nigeria's states and LGAs added to their areas, and the
 * geoBoundaries sources added to their source list. Nothing else is touched. Areas of other
 * kinds, and all territories, stay whatever the given repositories hold.
 */
export function withGeoBoundaries(repos: GridIntelRepositories): GridIntelRepositories {
  return {
    ...repos,
    spatial: {
      async listAreas(query) {
        const base = await repos.spatial.listAreas(query);
        const records = [...base.records];
        const wants = (kind: AreaKind) => query.kinds === undefined || query.kinds.includes(kind);
        if (wants("state")) records.push(...(await level("state")));
        if (wants("lga")) records.push(...(await level("lga")));
        // A list that had no areas at all now has these and no others; any other list is as complete as it was.
        return { records, completeness: base.completeness === "not_available" && records.length > 0 ? "partial" : base.completeness };
      },
      listTerritories: (query) => repos.spatial.listTerritories(query),
    },
    sources: {
      async listDataSources() {
        return [...(await repos.sources.listDataSources()), ...GEOBOUNDARIES_SOURCES];
      },
    },
  };
}
