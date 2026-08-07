# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org).

## [Unreleased]

## [0.1.1] - 2026-08-06

### Added

- `docs/ai-setup.md` and a "Get started with AI" README section: a copy-paste
  prompt that walks any AI assistant (Claude, ChatGPT, Grok, ...) through
  guided setup, mirroring the vendor's own onboarding pattern.

## [0.1.0] - 2026-08-06

### Added

- MCP server (stdio) for the official UniFi Network Integration API v10.4.57:
  15 tools covering all 73 documented operations, generated from the committed
  vendor OpenAPI contract.
- `unifi_spec` tool serving the vendor's exact request/response schemas per
  operation.
- Safety model: Read/Create/Update/Admin/Destructive classification;
  `confirm: true` gate on Destructive and Admin operations; strict input
  envelopes; local request-body validation against vendor schemas; central
  API-key redaction; confined URL-encoding path builder.
- Cloud multi-console mode (ADR-002): with only `UNIFI_API_KEY` set, consoles
  are discovered via the `unifi_consoles` tool (Site Manager `GET /v1/hosts`)
  and every tool accepts a per-call `consoleId` routed through the documented
  `api.ui.com` Site Manager Connector — one visible console is auto-selected,
  several return the list to choose from.
- Support for local consoles (self-signed TLS via explicit `UNIFI_INSECURE=1`,
  warned) and pinned `api.ui.com` connector bases in direct mode.
- CLI verbs: `--version`, `--check` (exit 78 when unconfigured), `--list-tools`.
- CI-enforced `tools/list` token budget (measured ≈6,800 tokens; ceiling 25,000).
- Opt-in read-only live contract test suite validating responses against the
  vendor schemas.
