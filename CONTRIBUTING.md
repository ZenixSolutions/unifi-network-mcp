# Contributing

Thanks for your interest. This repository is governed by the Engineering OS
framework; the practical rules below are what you need to contribute.

## Development setup

```sh
git clone https://github.com/ZenixSolutions/unifi-network-mcp.git
cd unifi-network-mcp
npm install
npm run typecheck && npm run lint && npm test
```

Node ≥ 20 is required.

## How the code is generated

The tool surface is **derived from the committed vendor contract** at
`docs/reference/openapi.json`:

- `npm run generate` rebuilds `src/generated/op-map.json` (the operation map)
  and `src/generated/spec-schemas.json` (vendor schemas for runtime body
  validation). Both are committed; CI fails if they are stale.
- Hand-edit `scripts/generate-op-map.mjs` (curated tool/operation names live
  there), never the generated files.
- To adopt a new API version: replace `docs/reference/openapi.json` with the
  new `openapi.json` from developer.ui.com, run `npm run generate`, fix what
  the type checker and tests surface, and update `docs/compatibility.md`.

## Quality gates (all enforced in CI)

- `npm run typecheck` — TypeScript strict, no `any`
- `npm run lint` — ESLint, zero warnings tolerated
- `npm run format:check` — Prettier
- `npm test` — Vitest; coverage thresholds 85% on `src/`
- `npm run build` then `npm run check:budget` — the measured `tools/list`
  cost must stay under 25,000 tokens
- Secret scan

Live contract tests (`npm run test:contract`) are opt-in and read-only; they
require `UNIFI_CONSOLE_URL` and `UNIFI_API_KEY` for a real console.

## Dependency policy

Runtime dependencies are pinned to exact versions and kept to a minimum
(`@modelcontextprotocol/sdk`, `zod`, `ajv`, `ajv-formats`, `undici`). Adding a
dependency requires justification in the pull request: what it does, why the
platform can't, its maintenance state, and its transitive footprint. Dependabot
proposes updates weekly; updates are reviewed, not auto-merged.

## Pull requests

- Branch from `main`; keep PRs focused.
- All CI checks must pass; conversation threads must be resolved.
- User-visible changes need a `CHANGELOG.md` entry under _Unreleased_.
- Significant design changes need an RFC or ADR in `docs/` before the
  implementation PR.

## Releases

Semantic versioning. A release requires: approved scope, green CI, updated
CHANGELOG, a version bump commit, and a `vX.Y.Z` tag, which triggers the
release workflow (npm publish with provenance). Pre-1.0, breaking tool-surface
changes are allowed with a minor bump and a changelog notice.
