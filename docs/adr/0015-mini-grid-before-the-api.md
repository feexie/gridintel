# ADR 0015: Mini-grid Intelligence comes before the API and the database

Date: 2026-10-10
Status: Accepted. The Founder's decision (2026-10-10).

## Context

The roadmap had Mini-grid and DER intelligence as Phase 10, after the API
boundary (Phase 8) and the production data architecture (Phase 9), and
listed Phase 9 as its dependency. Phase 7 (GIS as a platform capability)
ended with a place for mini-grid sites on the shared map and nothing in it.

## Decision

Phase 10, Mini-grid Intelligence, is the next phase, ahead of Phase 8. It
keeps its number. Its purpose is operating intelligence for mini-grid
operators and for the people who fund and report on them: how each site
performs technically and commercially, and whether reported figures match
the records. It is not site prospecting.

It is worked in two gated parts: 10a, the domain, the analytics and a
synthetic dataset, ending in a checkpoint for the Founder's realism review;
10b, the screens, after that review.

DER intelligence (fleets, aggregation, dispatch) is not part of this phase.
It stays with the roadmap's later work.

## Consequences

- Phase 10 no longer depends on Phase 9. It runs on synthetic records
  behind the existing repository ports, as the Utility module does. A
  database adapter will serve both when it comes.
- The second module arrives before login. The mini-grid operator's records
  are kept as a set of repositories of their own (ADR 0016), which is the
  separation Phase 8 will need between organizations.
- What is owed before login is unchanged and now covers two modules: every
  read model must take the viewer (ADR 0014).
- Phases 8 and 9 follow in their order.
