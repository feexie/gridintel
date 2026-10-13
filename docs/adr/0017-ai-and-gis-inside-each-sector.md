# ADR 0017: GIS and AI are platform capabilities that each sector shows as its own

Date: 2026-10-13
Status: Accepted. Decisions 1 to 6 are the Founder's (2026-10-13). It
extends ADR 0014 and changes one thing ADR 0014 built: where the map is
reached from. No AI is built by this ADR; AI remains Phase 11.

## Context

ADR 0014 made GIS a platform capability: one shared map component, layers
registered by each module, a viewer on every spatial call. It put the map in
the Platform menu as one screen holding every module's layers, and said in
its decision 6 that AI would follow the same pattern.

With two sectors built, one map for everything reads as a third product
beside them, and it opens on one sector's network with the other's switched
off. The same would happen to an assistant: one page for the whole platform
would be asked utility questions and mini-grid questions with nothing to say
which records it is answering from.

## Decisions (Founder, 2026-10-13)

1. **Every sector has the same structure**: Overview, GIS Map, AI
   Assistant, then its workspaces. Utility and Mini-grid have it now. DER
   and Planning will join with it.
2. **GIS is shown inside each sector, by the shared map component only.**
   A sector's GIS Map is the one map of ADR 0014 given that sector's layers
   and the reference geography. Nothing is re-implemented per sector.
3. **There is no top-level Map.** The Platform Overview shows every sector
   on one small map. The old addresses (`/dashboard/map`,
   `/dashboard/intelligence/gis`) redirect to the Platform Overview.
4. **One AI layer for the platform.** It is not a separate assistant in
   each sector.
5. **Each sector registers its own tools, wrapping its own services.** An
   answer cites the service results it used, each with its status and
   origin, and the assistant is given the viewer's scope.
6. **Nothing is built now.** Each sector has an "AI Assistant (planned)"
   page that says plainly that it is not built, gives three or four example
   questions for that sector, and says that every answer will cite the
   figures. It is marked planned in the menu. Nothing on it may look like a
   working assistant.

## The pattern, for GIS (built) and AI (to be built)

| | GIS (ADR 0014, built) | AI (Phase 11, not built) |
| --- | --- | --- |
| One platform capability | `src/services/spatial`: the model, the questions, the map read model, the viewer's scope, the cache | One AI layer: the model call, the tool loop, the citation rule, the audit of tool calls, PII filtering |
| What a sector registers | Its entities, trace, measures and layers (`SpatialModule`) | Its tools, each wrapping one of its services one to one |
| How a thing is named | A stable id that begins with the sector's: `utility.transformers.loading` | The same: `utility.revenue_gap`, `minigrid.site_performance` |
| What comes back | A view model whose every number is a `MetricView` with status, origin and method | The same view model. The assistant never receives, and never produces, a bare number |
| Who is asking | `ViewerContext` on every call; filtering in the services; cache keyed by the viewer's scope | The same `ViewerContext`, passed to every tool. The assistant cannot ask for what the viewer cannot see |
| Where a sector shows it | Its GIS Map: the shared component with its layers | Its AI Assistant: the shared assistant with its tools |

## Rules the AI layer will be held to

These are fixed now so that Phase 11 is designed against them, and so that
nothing built before then makes them harder.

1. **A tool wraps a service one to one.** A tool computes nothing. It calls
   one application service with plain arguments and the viewer, and returns
   that service's result.
2. **Every figure in an answer is a citation.** A number, a status or a
   name of an asset in an answer is taken from a tool result and is shown
   with that result's status and origin, and a link to the screen that
   holds its source and method. A figure the assistant cannot cite is not
   written.
3. **The engine's status stands.** Where a service says insufficient data,
   not available, estimated or provisional, the answer says so in the same
   words. The assistant does not fill a gap, and a gap is never a zero.
4. **Synthetic stays synthetic.** A result built on a synthetic record is
   marked synthetic in the answer, as it is on a screen.
5. **The viewer's scope is not the assistant's to widen.** The same
   `ViewerContext` goes to every tool. A tool for one sector reads that
   sector's repositories only; the utility's and the mini-grid operator's
   records stay two sets (ADR 0015), and an answer never adds one to the
   other.
6. **AI output is never data.** It is not stored, cached or shown as
   measured, reported, calculated or estimated data, and it is never an
   input to a calculation (engineering rule 5).
7. **No customer PII** in a prompt or an answer (engineering rule 2).
8. **Every tool call is recorded**: who asked, which tool, which
   arguments, which result it was given.

## What was built with this ADR (Phase UI-A, a prototype)

- **Navigation** (`src/constants/navigation.ts`): Platform with Overview;
  each sector with Overview, GIS Map, AI Assistant marked planned, then its
  workspaces.
- **A sector's GIS Map** (`/dashboard/utility/map`,
  `/dashboard/minigrid/map`): `spatial.sector(id)` in the composition root
  names the sector's layers and which are on when the map opens. The screen
  is `MapWorkspace`, unchanged in what it does; the map is `NetworkMap`.
  `incidentsNow` takes the modules to ask, so a sector's map lists only
  what that sector holds as in progress.
- **The Platform Overview's map**: `spatial.platform()`, the utility's
  substations and the mini-grid sites among the state outlines, with no
  figure layer.
- **The redirects**, in `next.config.ts`.
- **The AI Assistant (planned) page** (`src/components/ai/AssistantPlanned.tsx`),
  one component for every sector. It has no input, no button, no
  conversation and no figure; a browser test holds that. Each example
  question names the screen that answers it today.

## Consequences

- The Sites workspace moved from `/dashboard/minigrid` to
  `/dashboard/minigrid/sites`, so that `/dashboard/minigrid` is the
  sector's Overview, as `/dashboard/utility` is.
- A layer registered by a sector is shown on that sector's map. A layer
  that should appear on the Platform Overview's map is named in
  `spatial.platform()`.
- The reference geography (states, LGAs) is on every sector's map.
- What ADR 0014 leaves owed is unchanged: the Phase 6 and Phase 10 read
  models take no viewer yet, and must before anyone logs in. That now
  includes the overview read models, which are put together from them.
- Choosing an AI provider, a model and where prompts are sent is an
  external integration and a decision gate. It is not decided here.
