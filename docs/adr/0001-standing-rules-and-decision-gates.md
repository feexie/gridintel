# ADR 0001: Standing rules separate from the founding directive

Date: 2026-10-01
Status: Accepted (Founder instruction)

## Context

The founding directive is long and contains one-off instructions (sections
24–25: audit the system, then implement). Loaded into every session it would
re-trigger that work and crowd out the rules that actually apply daily.

## Decision

- `docs/FOUNDING_DIRECTIVE.md` keeps the directive verbatim as the reference
  vision. It is read on demand, not loaded each session. (Moved on
  2026-10-07, by Founder decision, to `private/FOUNDING_DIRECTIVE.md`, which
  is not committed: the repository is public.)
- `docs/ENGINEERING_RULES.md` holds the standing rules and is the only
  document `CLAUDE.md` imports besides `AGENTS.md`.
- Decision gates define what needs Founder approval: product scope or roadmap
  order; data-integrity or provenance semantics; auth, security, secrets,
  external integrations and new infrastructure; deleting working
  functionality before its replacement is live; major dependencies.
- Everything else is an engineering decision. Major ones are recorded as ADRs
  in `docs/adr/`.
- `docs/ROADMAP.md` is the living plan and is updated at the end of each
  phase. Implementation of a phase starts only after it is approved.

## Consequences

Sessions start from short, stable rules. The vision stays intact and
unedited. Autonomy is bounded by explicit gates rather than by case-by-case
permission.
