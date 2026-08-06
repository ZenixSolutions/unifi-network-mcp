# Compatibility

## API and controller versions

- Built against the vendor's published contract for **UniFi Network API
  v10.4.57** (`docs/reference/openapi.json`, fetched from developer.ui.com).
- The Integration API is available on UniFi Network Application 9.0+; some
  resource areas in this surface (firewall zones/policies as exposed here,
  DNS policies, traffic matching lists) require newer application versions.
  A console that lacks an endpoint answers with the documented error shape,
  which the server passes through cleanly.
- Tested live against the controller version recorded in the release notes.

## Connectivity

| Mode                           | `UNIFI_CONSOLE_URL`                                                              | Notes                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cloud multi-console (ADR-002)  | _unset_                                                                          | Consoles discovered via `unifi_consoles` (Site Manager `GET /v1/hosts`); per-call `consoleId` routes through the connector proxy; no VPN |
| Local console (direct)         | `https://<console-ip>`                                                           | Self-signed TLS: either trust the console cert or set `UNIFI_INSECURE=1` (warned; see SECURITY.md)                                       |
| Pinned connector base (direct) | `https://api.ui.com/v1/connector/consoles/<consoleId>/proxy/network/integration` | Cloud proxy bound to one console; no VPN; same API key header                                                                            |

## MCP clients and transports

- **Transport: stdio** (this release). Claude Desktop, Claude Code, and other
  stdio MCP clients work with the `npx` command in the README.
- Remote/HTTP transport is not in this release; clients that require a hosted
  URL (e.g. ChatGPT connectors) are not yet supported. This is a roadmap item,
  not a bug.

## Known limitations

- Local Integration API **rate limits are undocumented** by the vendor; GETs
  are retried on 429/5xx with backoff.
- **Nested discriminated unions validate shallowly** (top-level discriminators
  are pinned and enforced; some deep variant fields are enforced by the
  console). See SECURITY.md.
- The vendor spec declares **no `securitySchemes`**; auth is implemented from
  the vendor's written documentation (`X-API-KEY` header).
- Vouchers `delete_by_filter` and other filter-based operations pass filter
  expressions through verbatim; the console is the authority on filterable
  properties per endpoint (each endpoint's documentation lists them).
