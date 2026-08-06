# ADR-002: Cloud multi-console mode via the Site Manager Connector

- **Status:** Accepted, 2026-08-06 (Project Owner decision)
- **Amends:** RFC-004 Non-Goals ("Other UniFi APIs — Site Manager")

## Context

RFC-004 scoped the server to a single console bound by `UNIFI_CONSOLE_URL`.
The Project Owner operates many customer deployments and wants the
sign-in-once experience of unifi.ui.com: one API key, every company's console
visible, choose per action — without VPNs or per-customer config entries.

Ubiquiti's own integration guidance documents exactly this bridge: the Site
Manager API (`api.ui.com`, same `X-API-KEY`) lists consoles via
`GET /v1/hosts`, and the Site Manager Connector proxies Network API calls to
any console at
`/v1/connector/consoles/{consoleId}/proxy/network/integration`.

## Decision

1. **Two modes.** `UNIFI_CONSOLE_URL` set → _direct_ mode (unchanged).
   Unset → _cloud_ mode: only `UNIFI_API_KEY` is required and every call
   routes through the connector proxy.
2. **`unifi_consoles` tool** (Read): lists consoles visible to the key via
   Site Manager `GET /v1/hosts` — id, name, type, ipAddress. This is the
   **only** Site Manager surface used; discovery, not operation. The Network
   API remains the sole operational surface.
3. **`consoleId` on every tool** (optional): targets one console per call in
   cloud mode; ignored in direct mode.
4. **Explicit choice by default** (Owner decision): in cloud mode with no
   `consoleId`, the server auto-selects only when exactly one console is
   visible; with several, it returns the console list and asks for a choice —
   no accidental writes to the wrong customer's network. No env-var default
   console.

## Consequences

- MSP workflow works out of the box; `UNIFI_INSECURE` becomes unnecessary in
  cloud mode (api.ui.com has a publicly trusted certificate) and is ignored
  there with a warning.
- The console list is cached per process; `refresh: true` bypasses it.
- Scope note for the repo identity: the package remains a _Network API_
  server; Site Manager usage is limited to the two documented discovery
  fields of `GET /v1/hosts` output we surface. Operating Protect or other
  APIs stays out of scope.
- Live contract testing can use either mode; the suite targets one console
  per run.
