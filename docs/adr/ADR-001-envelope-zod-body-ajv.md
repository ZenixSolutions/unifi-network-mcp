# ADR-001: Strict Zod envelopes + vendor-schema Ajv validation for bodies

- **Status:** Accepted, 2026-08-06
- **Relates to:** RFC-004 D1

## Context

RFC-004 D1 describes the grouped tool inputs as "Zod discriminated-union input
schemas derived from the committed spec". During implementation it became clear
that hand-mirroring all 379 vendor component schemas into Zod would recreate
the drift risk the committed-contract design exists to remove: two sources of
truth for the same shapes, one maintained by hand.

## Decision

Split validation by what each layer is authoritative for:

- **Envelope (operation, path/query params, confirm gate): Zod, strict.**
  These shapes are ours, small, and stable; `.strict()` rejects hallucinated
  fields locally.
- **Request bodies: Ajv (JSON Schema 2020-12) against the vendor's own
  component schemas**, registered verbatim from the generated
  `spec-schemas.json`. Top-level discriminated unions are expanded at
  generation time into `anyOf` branches with the discriminator value
  const-pinned per branch, so an undocumented action/type fails locally.
  Component schemas are registered unmodified to avoid infinite mutual
  recursion (variant → base → variant).

## Consequences

- Complete, drift-proof body coverage: a new vendor spec re-generates into
  enforced validation without hand-written schema work.
- Nested discriminated unions validate shallowly (documented in SECURITY.md
  and compatibility.md); the console remains the final arbiter.
- One extra runtime dependency (`ajv`, `ajv-formats`) — accepted under the
  dependency policy as the standard JSON Schema validator.
- The model-facing input schema advertises `body` as an open object and points
  at `unifi_spec` for exact shapes, keeping `tools/list` ≈6,800 tokens instead
  of inlining 379 schemas.
