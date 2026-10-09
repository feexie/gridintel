/* Builds the administrative boundary files GridIntel keeps in its repository from the files
   geoBoundaries publishes (ADR 0014).

   Source: geoBoundaries gbOpen, Nigeria, ADM1 (states) and ADM2 (local government areas), the
   "simplified" GeoJSON of release 9469f09. Licence CC BY 4.0; geoBoundaries' stated source is
   GRID3. The originals are not kept in the repository. This script is given the two files as
   downloaded, checks each against the SHA-256 recorded below, and writes the two files under
   src/repositories/geoboundaries/data, and a third, nga-sources.json, that holds only what each
   file is and where it came from.

   What it changes, and nothing else:
     - coordinates are rounded to 5 decimal places (about one metre);
     - of each feature's properties, the id, the name and (states) the ISO code are kept;
     - each LGA is given the state it lies in, WORKED OUT FROM THE GEOMETRY (the published LGA
       file names no state): the state that holds most of the LGA's area, judged on a grid of points inside it. The link is
       marked as derived in the output.

   Usage:
     curl -L -o adm1.geojson <ADM1 url below>
     curl -L -o adm2.geojson <ADM2 url below>
     node scripts/build-boundaries.mjs adm1.geojson adm2.geojson

   The output is the same on every run: it holds no clock time. */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RELEASE = "9469f09";
const BASE = `https://github.com/wmgeolab/geoBoundaries/raw/${RELEASE}/releaseData/gbOpen/NGA`;
const COMMON = {
  publisher: "geoBoundaries (gbOpen)",
  citation: "Runfola et al. 2020, geoBoundaries: A global database of political administrative boundaries. PLoS ONE 15(4): e0231866",
  boundarySource: "GRID3",
  licence: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
  release: RELEASE,
  yearRepresented: "2022",
  sourceDataUpdated: "2023-02-26",
  geoBoundariesBuilt: "2023-12-12",
  // The day the originals were downloaded and checked.
  retrieved: "2026-10-09",
  geometry: "The published simplified geometry, coordinates rounded to 5 decimal places.",
};
const LEVELS = {
  ADM1: {
    boundaryId: "NGA-ADM1-27671186",
    url: `${BASE}/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson`,
    sha256: "edd28050c7f1ae40471424605f74e4d2df83502e4f301089761ae18f8ae2fbbf",
    units: 37,
    out: "nga-adm1.json",
  },
  ADM2: {
    boundaryId: "NGA-ADM2-59680162",
    url: `${BASE}/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson`,
    sha256: "daac9ba2c98f0d8984085c8a5b3a5301fca362f3ca37e6ac7dfcc7633719fc1d",
    units: 774,
    out: "nga-adm2.json",
  },
};
const DECIMALS = 5;

function read(path, level) {
  const raw = readFileSync(path);
  const sha256 = createHash("sha256").update(raw).digest("hex");
  if (sha256 !== LEVELS[level].sha256) throw new Error(`${path} is not the ${level} file of release ${RELEASE}: SHA-256 ${sha256}, expected ${LEVELS[level].sha256}.`);
  const collection = JSON.parse(raw.toString("utf8"));
  if (collection.features.length !== LEVELS[level].units) throw new Error(`${level}: ${collection.features.length} units, expected ${LEVELS[level].units}.`);
  return { features: collection.features, bytes: raw.length };
}

const round = (value) => Number(value.toFixed(DECIMALS));
/** A feature's polygons, each a list of rings (the outline first, then holes), each ring a list of [longitude, latitude]. */
function polygonsOf(geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
  if (polygons === null) throw new Error(`Unexpected geometry type ${geometry.type}.`);
  return polygons.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => [round(longitude), round(latitude)])));
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygons = (point, polygons) => polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));

/** Points spread evenly inside an area: a grid over its box, keeping those that fall inside it. Never fewer than one. */
function interiorPoints(polygons) {
  const outline = polygons.flatMap((polygon) => polygon[0]);
  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const [west, east, south, north] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (const steps of [24, 96, 384]) {
    const points = [];
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const point = [west + ((i + 0.5) * (east - west)) / steps, south + ((j + 0.5) * (north - south)) / steps];
        if (inPolygons(point, polygons)) points.push(point);
      }
    }
    if (points.length >= 20) return points;
  }
  return [outline[0]];
}

const [adm1Path, adm2Path] = process.argv.slice(2);
if (!adm1Path || !adm2Path) throw new Error("Usage: node scripts/build-boundaries.mjs <ADM1 simplified geojson> <ADM2 simplified geojson>");

const adm1 = read(adm1Path, "ADM1");
const adm2 = read(adm2Path, "ADM2");

const states = adm1.features
  .map((feature) => ({ id: `gb-${feature.properties.shapeID}`, name: feature.properties.shapeName, code: feature.properties.shapeISO || undefined, polygons: polygonsOf(feature.geometry) }))
  .sort((a, b) => (a.name < b.name ? -1 : 1));

let weakest = { share: 1, name: "" };
const lgas = adm2.features
  .map((feature) => {
    const polygons = polygonsOf(feature.geometry);
    const points = interiorPoints(polygons);
    const votes = states.map((state) => ({ state, inside: points.filter((point) => inPolygons(point, state.polygons)).length })).sort((x, y) => y.inside - x.inside);
    const share = votes[0].inside / points.length;
    if (votes[0].inside === 0) throw new Error(`${feature.properties.shapeName} lies in no state.`);
    if (share < weakest.share) weakest = { share, name: `${feature.properties.shapeName} (${votes[0].state.name})` };
    return { id: `gb-${feature.properties.shapeID}`, name: feature.properties.shapeName, parentId: votes[0].state.id, polygons };
  })
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1));

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "repositories", "geoboundaries", "data");
mkdirSync(outDir, { recursive: true });
const headers = [];
const write = (level, kind, areas, extra = {}) => {
  const { out, ...source } = LEVELS[level];
  const header = { ...COMMON, level, ...source, ...extra };
  headers.push({ kind, source: header });
  const text = JSON.stringify({ source: header, kind, areas });
  writeFileSync(join(outDir, out), text);
  return text.length;
};
const adm1Bytes = write("ADM1", "state", states);
const adm2Bytes = write("ADM2", "lga", lgas, {
  parentLink: "derived",
  parentMethod: "The state that holds most of the LGA's area, judged on a grid of points inside the LGA. geoBoundaries' LGA file names no state.",
});
// What each file is and where it came from, on its own: read without reading any geometry.
writeFileSync(join(outDir, "nga-sources.json"), `${JSON.stringify(headers, null, 2)}\n`);

console.log(`states: ${states.length} areas, ${adm1.bytes} bytes as published, ${adm1Bytes} bytes written`);
console.log(`LGAs:   ${lgas.length} areas, ${adm2.bytes} bytes as published, ${adm2Bytes} bytes written`);
console.log(`LGA to state by geometry: the least clear is ${weakest.name}, with ${(weakest.share * 100).toFixed(1)}% of its area in that state`);
