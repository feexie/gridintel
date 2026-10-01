# ADR 0003: `synthetic` is its own data source kind

Date: 2026-10-01
Status: Accepted (Founder decision)

## Context

Phase 5 needs a designed demonstration dataset. `DataSource.kind` already had
`"mock"`. The two are different things, and AI tools and external
stakeholders will rely on the provenance meaning being exact.

## Decision

- `DataSource.kind` gains `"synthetic"`: a deliberately designed, internally
  consistent dataset that exercises the analytics engine and describes
  nothing real.
- `"mock"` keeps its meaning: placeholder data written to fill a screen. It
  is retired when the legacy mock data is removed in Phase 6.
- `ReportedKpi.source.kind` gains `"gridintel_synthetic"` for figures invented
  as part of a synthetic dataset.
- Every service returns `Sourced<T>`: the result plus `sourcing`, which lists
  the data sources of the records used and sets `synthetic: true` when any of
  them is synthetic. Services build this from record provenance; it is not a
  setting.
- The UI must show the synthetic marker wherever such a result is displayed.

## Consequences

A result cannot lose its synthetic origin on the way to the screen or to an
AI tool. A result that mixes real and synthetic records is marked synthetic.
Mock-sourced results are not marked synthetic; they are identifiable by their
source kind until mock data is removed.
