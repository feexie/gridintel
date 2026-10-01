# ADR 0004: GIS moves ahead of the API and database phases

Date: 2026-10-01
Status: Accepted (Founder decision)

## Context

The roadmap had GIS after the API boundary and the database. A map needs only
the demo dataset and the service layer, and a demonstrable network map is
worth having sooner.

## Decision

- GIS / network intelligence becomes Phase 7, directly after Phase 6. The API
  boundary becomes Phase 8 and production data architecture Phase 9.
- Condition: the map consumes services only. It never reads the dataset or a
  repository directly.
- The Phase 5 dataset carries coordinates for the substation, every
  distribution transformer and every service point, and a route polyline for
  every feeder (`Feeder.route`), so GIS needs no re-seed.

## Consequences

Map read models must be designed as services in Phase 7. A power transformer
has no coordinates of its own and takes its substation's location. Feeder
routes in the demo are straight lines between points, not surveyed geometry.
