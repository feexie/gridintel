# ADR 0002: Minimal CI on Node 24; `"type": "module"` deferred

Date: 2026-10-01
Status: Accepted

## Context

There was no CI. The test script (`node --test "src/**/*.test.ts"`) runs
TypeScript files directly, which needs a Node version with built-in type
stripping. `package.json` declares `node >= 20.9.0`, which is the Next.js
minimum but is too old for the test script. Local development uses Node 24.

Every test file prints a `MODULE_TYPELESS_PACKAGE_JSON` warning because
`package.json` has no `"type"` field.

## Decision

- Add `.github/workflows/ci.yml`: typecheck, test, lint and build on Node 24,
  on pushes to `main` and on pull requests.
- Do not add `"type": "module"` yet. Assessment: low risk, because every
  config file is already ESM or TypeScript (`eslint.config.mjs`,
  `postcss.config.mjs`, `next.config.ts`) and the repository has no CommonJS
  files. It still changes how Node and Next load the project, so it is
  applied as the first step of Phase 5, in its own commit, and kept only if
  all four checks and the dev server pass.
- Raise the `engines` Node version to match the test script at the same
  time.

## Consequences

Every push is checked. The test warning remains until Phase 5 step 0.
