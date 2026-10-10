# ADR 0014: GIS is a platform capability, with a viewer scope from the first day

Date: 2026-10-09
Status: Accepted. Decisions 1 to 6 are the Founder's (2026-10-09) and were
built as foundations in Phase 7a. The twelve "choices made in building it"
were confirmed by the Founder at the 7a checkpoint (2026-10-09), and both
proposals were decided the same day: no basemap, and boundaries from
geoBoundaries. See "As decided and built in Phase 7b" at the end, which is
what the code does; the proposals before it are kept as they were put.

## Context

ADR 0004 moved GIS ahead of the API and the database and set one condition:
the map consumes services only. It said nothing about who the map is for,
which modules it serves, or what a logged-in organization may see on it.
Left open, the first map would have been a Utility screen with its own data
path, and each later module would have built another.

## Decisions (Founder, 2026-10-09)

1. **GIS is a platform capability that serves every module**: Utility now;
   Mini-grid, DER and Planning later. Its purpose is the spatial view of the
   energy system the user operates: network, losses, outages, revenue,
   assets and, later, mini-grid and DER sites as operating assets. **It is
   not a site-prospecting tool.** Every value on the map comes from an
   existing service, with its status and origin. The map never computes a
   figure.
2. **Write once, configure per section.** One shared map component in the
   design system. Each module only registers its layers and its default
   view. Nothing is re-implemented per section.
3. **Spatial domain.** Location for any entity: points, lines, and areas
   such as states, LGAs and service territories. No required link to a
   substation, so a mini-grid site or a DER asset fits without changing the
   model.
4. **Spatial services, generic over entity kinds**: what is here, what is
   inside an area, what is behind an asset (the downstream trace), and
   totals by area (for example revenue not realised by LGA).
5. **Viewer scope from the first day** (security design). Every spatial
   service and read model takes a viewer context: who, and which
   organization. Organizations will have territories (administrative areas,
   a drawn boundary, or a list of assets). Filtering happens in the
   services, never in components. Cache keys include the viewer scope. For
   now the only viewer is the public demonstration, which sees everything;
   login and real territories come with Phase 8. A test proves a restricted
   viewer cannot see an asset outside its territory through any service,
   including the map. Screens for a real tenant will be rendered per
   request; building screens ahead of time stays only for the public
   synthetic demonstration (ADR 0012).
6. **AI-ready, on the same pattern.** Nothing is built now; AI is Phase 11.
   There will be one AI layer; each module will register tools that wrap its
   services; answers cite service results; the AI uses the same viewer
   scope. Nothing in Phase 7 may make this harder.

## As built in Phase 7a

**Domain** (`src/domain/geo.ts`). `Geometry` is a point, a line or an area
(several polygons, with holes). `EntityLocation` places any entity, named by
an open `LocatedRef { kind, id }`: the kind is a string a module chooses, so
no parent of any sort is required. Each location states its `LocationBasis`:
surveyed, digitised, schematic, inherited or unspecified. `Area` is a named
area of a kind (country, state, lga, ward, service_territory, other).
`Territory` is an organization's extent, in parts of three kinds: named
areas, a drawn boundary, listed assets.

**Analytics** (pure, tested with fixed inputs).

- `spatial/geometry.ts`: point in area, shape within area, distance in
  metres to a point, line or area, and the box that holds a set of shapes.
- `spatial/locations.ts`: reads the locations the registry holds on its
  assets into `EntityLocation`s. An asset with no location is returned as
  not located, with the reason. Nothing is placed by guessing.
- `topology/trace.ts`: what supplies an asset, nearest first, and what it
  supplies.
- `spatial/allocation.ts`: which area an entity is in, and totals by area,
  under a named methodology (`gridintel.spatial.reference` 0.1.0).

**Port** (`src/repositories/ports/spatial.ts`): `listAreas`,
`listTerritories`. Records only. A source that holds no areas answers
"not available", not an empty complete list.

**Services** (`src/services/spatial`).

- `viewer.ts`: `ViewerContext` and `viewerScopeKey`.
- `module.ts`: what a module registers (entities, trace, measures, layers)
  and the registry that holds the registrations.
- `model.ts`: the spatial model, and the model as one viewer may see it.
- `queries.ts`: `whatIsHere`, `whatIsInside`, `whatIsBehind`,
  `totalsByArea`.
- `map.ts`: `mapView`, the read model the shared map component will be
  given.
- `src/services/utility/spatial.ts`: the Utility module's registration.
  Entities: substations, power transformers, feeders, distribution
  transformers, service points. Layers: substations, feeder routes,
  distribution transformers. One measure: revenue not realised.

**Composition** (`src/composition/spatial.ts`, `getViewer` in
`runtime.ts`). The registry with Utility registered, bound to the adapter,
the clock, the cache and the viewer. A module joins the platform by being
added to one list.

No screen, route or component was built. That is Phase 7b.

## Choices made in building it (for the Founder to confirm)

1. **A territory holds an entity only when all of it is inside.** A point
   inside the area; a line when every recorded vertex is inside. A feeder
   that crosses the boundary of an area-based territory is not visible to
   that viewer, though its transformers inside are. The alternative, showing
   any line that touches the territory, would show a viewer the route of a
   line through someone else's area. An asset-list territory avoids the
   question: listing a feeder gives the feeder and everything it supplies.
2. **Nothing is visible by default.** A viewer is either "everything" (the
   public demonstration) or a territory. An empty territory sees nothing.
   An area the source does not hold, or an asset that does not exist,
   widens nothing.
3. **An entity outside the territory does not exist for that viewer.** It
   is in no list, no count and no total. Asking about it by name gives the
   same answer as asking about something that was never there. A trace
   stops at the edge of the territory: a viewer given one feeder is not told
   which substation supplies it. Every result carries `scopeLimited`, which
   is true for every restricted viewer whether or not anything was hidden,
   so the flag itself tells nothing.
4. **Seeing an entity means seeing its figures.** A feeder's ATC&C is the
   feeder's, even if some of its customers lie outside the viewer's area.
   Counts made behind an asset (connections, active accounts) cover only
   what the viewer sees.
5. **A restricted viewer is never given the figure for the whole**, or what
   is left of it after its own entities. Totals by area for such a viewer
   have no remainder.
6. **Administrative areas are public; other areas are not.** Every viewer
   sees country, state, LGA and ward areas. An area of any other kind (a
   service territory, a custom area) is seen only by a viewer whose
   territory names it.
7. **The cache key is the territory written out in full**, not a digest of
   it, so two territories cannot collide. The existing `cachedView`, which
   every Phase 6 screen uses, has no viewer in its key and is documented as
   being only for screens that are the same for everyone.
8. **A figure is given whole to one area and never divided.** Revenue not
   realised at a transformer goes to the area the transformer stands in. It
   follows where transformers are, not where customers live. What no
   transformer carries (each feeder's and substation's own residual,
   customers supplied at 11 kV) is shown as a named remainder that belongs
   to no area, so the areas and the remainder add up to the Revenue
   screen's figure (₦46,304,966 on the demonstration). If any figure in an
   area is missing, the area's total is missing, not smaller.
9. **A feeder route in the demonstration is marked schematic.** It is
   straight lines through the transformers (ADR 0004). `Feeder.routeBasis`
   and `locationBasis` on located assets are new optional registry fields.
   The registry does not say how its points were obtained, so they are
   "unspecified". The map must say a schematic route is one.
10. **Three synthetic districts were added to the demonstration dataset**
    (`src/repositories/demo/areas.ts`), so that the area services run end to
    end. They are rectangles of kind `other`, named "(synthetic)", and are
    no state, LGA or ward. They can be removed or replaced when real
    boundaries are decided.
11. **A long list is counted, not listed, unless asked for.** A group of
    more than 200 entities (the 1,064 service points behind Farm Road)
    arrives as a count; the caller names the kind to get the list.
12. **The first registered layers carry no figure.** Substations, feeder
    routes and transformers are drawn as the network. The layers that
    colour by loading, ATC&C, revenue not realised or band compliance,
    open outages and standing alarms are Phase 7b. The layer contract
    already carries a figure and a legend class, decided in the service
    layer, and layers of one exclusive group are shown one at a time; both
    are tested with a stand-in layer.

## What is not covered, and is known

- **The Phase 6 read models take no viewer.** Executive, Operations,
  Reliability, Revenue, Assets and Events are computed for everyone and
  cached without a viewer. That is correct while the only viewer is the
  public demonstration. Before any organization logs in (Phase 8), each of
  them must take the viewer and be keyed by it, or be reached only through
  services that do. The restricted-viewer test covers the spatial services
  and the map read model, which is what exists to be restricted today; it
  fails if a spatial service is added and not covered.
- **Where territories are stored and who may edit them** is Phase 8.
  `listTerritories` exists on the port and the demonstration holds none.
- **Rendering.** `getViewer()` returns a constant, so a map screen for the
  demonstration can be built ahead of time. When it reads the request, a
  screen for a real tenant is rendered per request by the same rule that
  already governs a dataset that is not fixed (ADR 0012): the route waits
  for the request and is never kept as a file.
- **Containment is planar, in degrees.** Exact enough for areas the size of
  a state; wrong only across the antimeridian or a pole.

## Why this does not make AI harder (decision 6)

A registered layer, measure or question is named by a stable id
(`utility.feeders`, `utility.revenue_not_realised`), takes plain arguments
and a viewer, and returns a serialisable view model whose every number is a
`MetricView` with status, origin and method. That is the shape a tool
needs: a module's AI tools will wrap these calls one to one, pass the same
`ViewerContext`, and cite the result they were given. No spatial service
reads a request, a session or a component.

## Proposal 1 (decided 2026-10-09: no basemap): the basemap

The map can be drawn with no basemap at all: the network on a plain ground,
with a scale. A basemap adds streets and place names, and it is an external
service: the viewer's browser fetches tiles from it. Terms and prices below
were read on the providers' own pages on 2026-10-09 and must be confirmed
at sign-up.

**What leaves the browser with any hosted basemap**: the viewer's IP
address, the site's origin as the referrer, and which map tiles were asked
for, that is, where the viewer is looking and how closely. No GridIntel
data is sent: assets and figures are drawn on top in the browser. For the
synthetic demonstration that is harmless. For a real utility it tells a
third party which parts of the network its staff are examining.

| Option | Cost | Terms | Attribution | Leaves the browser |
| --- | --- | --- | --- | --- |
| A. No basemap | None | None | None | Nothing |
| B. OpenStreetMap's own tile server | Free | Best effort, no SLA; access "may be withdrawn at any point", and the policy warns commercial services of exactly that. No bulk download, prefetch or offline use. A valid referrer is required | "© OpenStreetMap contributors", visible on the map | IP, referrer, tiles viewed, to the OSM Foundation |
| C. OpenFreeMap (public instance) | Free; funded by donations | No key, no stated limit, commercial use allowed, no SLA. Vector tiles: needs MapLibre GL, which is not installed (a major dependency) | OpenStreetMap, OpenMapTiles (OpenFreeMap optional) | The same, to OpenFreeMap |
| D. CARTO basemaps | Free for commercial use up to 1 million tile requests a month; then $500 a month for up to 10 million | A key is required. Works with Leaflet | "© OpenStreetMap contributors, © CARTO" | The same, to CARTO |
| E. Stadia Maps | Free plan is **non-commercial only** (200,000 credits a month). Starter $20 a month, 1 million credits, commercial use allowed | Account and key | Per their attribution page (not read) | The same, to Stadia |
| F. MapTiler | Free plan for non-commercial use and prototypes (5,000 sessions a month, logo on the map). Flex $30 a month, 25,000 sessions | Account and key | Logo on the free plan | The same, to MapTiler |
| G. Self-hosted tiles (a Protomaps extract of the area, one static file served from GridIntel's own host) | No fee. Storage and bandwidth on our host. Size not measured: the whole planet is about 120 GB; an extract of one state would be a small fraction | OpenStreetMap data under ODbL. Needs one small library to read the file in Leaflet (a dependency) | "© OpenStreetMap contributors" | Nothing to a third party |

**Recommendation: A for Phase 7b, with the basemap as a setting of the
shared component; decide between G and a paid plan when the first real
tenant is in sight.**

- The demonstration network does not exist. Drawn over real streets near
  Yola it looks like real assets at real addresses, under whatever label.
  On a plain ground it reads as what it is: a network diagram laid out
  geographically.
- A adds no external call, no key, no terms and no dependency, so 7b is not
  held up by this decision, and nothing has to be undone later: the
  component takes a basemap or none.
- B is not a foundation for a product: it is free because it is for the
  OpenStreetMap community, and it can be withdrawn.
- If streets are wanted in the public demonstration now, the least
  commitment is D (free at this volume, works with the Leaflet already
  installed) or B.

## Proposal 2 (decided 2026-10-09: geoBoundaries): Nigeria's administrative boundaries

Wanted for two things: territories stated as states or LGAs, and totals by
area ("revenue not realised by LGA"). Sizes below were read from response
headers; no file was downloaded.

| Source | Licence | Commercial use | Attribution | Holds | Size |
| --- | --- | --- | --- | --- | --- |
| **geoBoundaries (gbOpen), Nigeria**; its stated source is GRID3 | CC BY 4.0 | Allowed | The name "geoBoundaries" with a link to geoboundaries.org, shown prominently; cite the source GRID3 | 37 first-level units (36 states and the FCT), 774 LGAs; represents 2022; built December 2023 | States 2.3 MB, simplified 0.8 MB. LGAs 9.4 MB, simplified 3.7 MB, simplified TopoJSON 0.56 MB |
| GRID3 Nigeria, directly | CC BY 4.0, as geoBoundaries records it; not read at the source | Allowed, if so | GRID3 | The same states and LGAs; GRID3 also publishes ward boundaries (not checked) | Not checked |
| UN OCHA common operational dataset (HDX), from OSGOF, eHealth Africa and the UN | **Not confirmed**: the page refused an automated read | Unknown until read | Its sources | 37 states, 774 LGAs, wards; reviewed October 2024 | Not checked |
| GADM | Its own | **Not allowed** without permission, nor redistribution | n/a | n/a | n/a |
| OpenStreetMap boundaries | ODbL | Allowed, with share-alike on a derived database | "© OpenStreetMap contributors" | Varies by place | n/a |
| Natural Earth | Public domain | Allowed | None required | States only, coarse; no LGAs | Small |

**What leaves the browser: nothing.** The files would be kept in the
repository and served from GridIntel's own origin; no third party is called
at run time. Cost: none.

**Recommendation: geoBoundaries, states and LGAs, the simplified files,
committed to the repository** (about 0.8 MB and 0.6 to 3.7 MB), read by an
adapter behind the existing areas port, with the source, the licence and
the year in each area's provenance, the attribution on the map, and a line
in an attributions file. GADM is ruled out by its licence. The HDX set may
be the more authoritative (it names the Surveyor General's office) and
should be read by a person before this is settled, because I could not
confirm its licence.

Three things to weigh:

- **These are approximate boundaries, not legal ones.** A "simplified" file
  is for display and for sorting assets into areas. An asset near a line
  can fall on the wrong side. Not a basis for a licence area or a dispute.
- **A state or an LGA is not a franchise area.** A DisCo's service
  territory follows its licence, not LGA lines. Territories for real
  organizations will still need the organization's own definition; the
  model already takes a drawn boundary or an asset list.
- **On the demonstration it mixes real areas with synthetic assets.**
  "Revenue not realised in Yola North" would be a synthetic figure in a
  real LGA. It stays under the SYNTHETIC DATA bar, but it reads more like a
  claim about a real place than anything on the screens today. The
  alternative for the demonstration is to keep the three synthetic
  districts and bring real boundaries in with the first real tenant.

## Decisions asked of the Founder

1. Confirm or change choices 1 to 12, in particular 1 (a line crossing the
   boundary is not visible), 6 (which areas are public) and 10 (synthetic
   districts in the demonstration).
2. Basemap: A, or another option.
3. Boundaries: geoBoundaries now, after the HDX licence is read, or not
   until a real tenant; and whether real boundaries go under the synthetic
   demonstration.

## As decided and built in Phase 7b (2026-10-09)

**The twelve choices: confirmed**, with two put on record.

- *The territory rule is strict.* A line that crosses a viewer's territory
  boundary is not visible to that viewer. Operator territories are normally
  asset-based (what the organization operates); areas are for viewing and
  for totals.
- *No basemap.* It is a setting of the shared map component and is off for
  the synthetic demonstration, because a synthetic network over real streets
  could be mistaken for real assets. To be revisited when real customer data
  arrives. The map says "No basemap" on itself, and a browser test checks
  that the page fetches nothing from any other host.

**Administrative boundaries: geoBoundaries gbOpen, Nigeria, ADM1 and ADM2.**
The Founder confirmed the licence, the source and the release as read from
the geoBoundaries API.

| | ADM1: states | ADM2: local government areas |
| --- | --- | --- |
| Boundary id | NGA-ADM1-27671186 | NGA-ADM2-59680162 |
| Licence | Creative Commons Attribution 4.0 International (CC BY 4.0) | the same |
| Source, as geoBoundaries states it | GRID3 | GRID3 |
| Units | 37 (36 states and the Federal Capital Territory) | 774 |
| Represents / source updated / built by geoBoundaries | 2022 / 26 February 2023 / 12 December 2023 | the same |
| Release | `9469f09` | `9469f09` |
| Retrieved | 2026-10-09 | 2026-10-09 |
| File | `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1_simplified.geojson` | `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2_simplified.geojson` |
| SHA-256 of that file | `edd28050c7f1ae40471424605f74e4d2df83502e4f301089761ae18f8ae2fbbf` | `daac9ba2c98f0d8984085c8a5b3a5301fca362f3ca37e6ac7dfcc7633719fc1d` |
| Size as published | 827,817 bytes | 3,717,494 bytes |
| Size kept in the repository | 359,978 bytes | 1,624,599 bytes |

- **Option B**: the published simplified geometry with coordinates rounded
  to 5 decimal places (about one metre), keeping each area's id, name and,
  for a state, ISO code. `scripts/build-boundaries.mjs` builds the kept
  files from the originals and refuses a file whose SHA-256 is not the one
  above. The originals are not in the repository. The kept files are in
  `src/repositories/geoboundaries/data`, with a third small file that holds
  only what each is and where it came from.
- **Provenance.** Each area's provenance names its source, the source's own
  record id, the release and the day retrieved. Each of the two sources
  (`DataSource`, kind `gis`) carries the licence, the credit, the URL, the
  release, the dates, the original file's SHA-256 and the words that must be
  shown with it. `DataSource` gained optional `licence`, `attribution`,
  `url`, `release`, `dated` and `notice` for this; they reach a screen in
  its sourcing.
- **An LGA's state is derived.** The published LGA file names no state. The
  build script gives each LGA the state that holds most of its area, judged
  on a grid of points inside the LGA, and the link is marked derived
  (`Area.parentBasis`). The result matches the official number of LGAs in
  all 36 states and the FCT; the least clear LGA has 99.1% of its area in
  its state. A first attempt by outline vertices put LGAs on a state border
  in the wrong state in six states and was dropped.
- **Credit and label.** "Boundaries: geoBoundaries (CC BY 4.0), Runfola et
  al. 2020" is on every map that shows them, drawn inside the map frame, and
  in the README. On screen they are "Administrative boundaries from
  geoBoundaries, not survey-grade".
- **Loading.** States are fetched with the map; LGAs only when their layer
  is switched on (`/api/areas/state`, `/api/areas/lga`, built with the
  application: about 124 KB and 547 KB compressed).

**Synthetic and real are never related** (both rules approved by the
Founder; enforced in the services, with tests).

- No synthetic figure is totalled by a non-synthetic area. Totals by area
  use only areas whose source is synthetic when the figures are, and say
  how many real areas were left out.
- No synthetic entity is listed as inside a real area, named as being in
  one, or held by a territory stated as one. Asking what is inside Yola
  North answers with nothing listed and the reason.
- *An engineer's addition, for the Founder to confirm:* the rule is applied
  both ways. A real entity is not put in a synthetic district either. The
  one test is `relates` in `src/services/spatial/model.ts`.
- The three synthetic districts stay, and are the only areas the
  demonstration totals by. States and LGAs are an orientation layer.

**What Phase 7b added to the platform.**

- *Layers carry more.* A layer may draw several kinds of entity, mark only
  what it has a figure for (an overlay), give each entity's key figures and
  place in the network for when it is selected, or draw areas: a measure
  totalled by them, or outlines fetched on request. What must be said on a
  map (a credit, "schematic", "not survey-grade") travels with the layer.
- *A map can be focused* on one entity: it then holds that entity, what
  supplies it and what it supplies.
- *Incidents.* A module may say what is in progress now; the platform adds
  what is behind where each began (`incidentsNow`).
- *Three modules are registered*: Utility; Mini-grid, with one layer and no
  data, its entity list "not available"; and reference geography.
- *Legend classes are decided in the service layer*, stated in words in the
  legend, and never shown by colour alone: a class differs in size too.
  "Above rating" is the loading methodology's own threshold. The bands for
  ATC&C (25% and 50%) and band compliance (1 and 5 days), and the thirds for
  revenue not realised, only sort a figure for colouring; they are display
  bands, not findings, and are the engineer's choice.
- *Band compliance on a transformer is its feeder's figure*, labelled as
  the feeder's: a service band is a feeder's.
