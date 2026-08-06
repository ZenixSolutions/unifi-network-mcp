# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

An MCP server for the official UniFi Network Integration API (v10.4.57),
governed by the Engineering OS framework. Foundation decisions:
`docs/rfc/RFC-004-unifi-network-mcp-foundation.md`. Divergences from the RFC
are recorded as ADRs in `docs/adr/`.

## Architecture in one paragraph

Everything is derived from the committed vendor contract
`docs/reference/openapi.json`. `npm run generate` produces
`src/generated/op-map.json` (73 operations grouped into 14 resource tools) and
`src/generated/spec-schemas.json` (vendor schemas). `src/tools/registry.ts`
builds tool descriptions, input schemas, and strict Zod envelopes from the op
map; `src/api/validate.ts` validates request bodies against the vendor schemas
with Ajv; `src/api/client.ts` is the only place HTTP happens; `src/server.ts`
exports a side-effect-free `buildServer()`; `src/index.ts` is a thin bin.

## Hard rules

- Never edit `src/generated/*` by hand — edit the generator and re-run
  `npm run generate`.
- Never bypass `resolveCall`/`getBodyValidator` when adding behavior; the
  confirm gate for Destructive/Admin operations lives there.
- The API key must never reach a log, error, or tool result — everything is
  redacted through `makeRedactor`; keep it that way.
- `main` must never point at a module with import side effects.
- No undocumented API endpoints (legacy `/api/s/...` is out of scope by
  constitution).
- Do not add dependencies casually; see the dependency policy in
  CONTRIBUTING.md.

## Verification before any PR

`npm run generate && git diff --exit-code src/generated` (generated files
current), `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test` (coverage ≥85% on src/), `npm run build`, `npm run check:budget`
(tools/list under 25k tokens, measured).

## Test layout

`tests/unit` (config, redaction, client, registry, validation, spec tool,
format), `tests/integration` (in-memory MCP handshake; all 73 operations
dispatched end-to-end against a stubbed client), `tests/contract` (opt-in,
read-only, against a live console; validates responses against vendor
schemas), `tests/fixtures/bodies.ts` (one valid body per write operation —
adding a body-carrying operation without a fixture fails the suite).
