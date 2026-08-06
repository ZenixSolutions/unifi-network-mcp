# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org).

## [Unreleased]

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
- Support for local consoles (self-signed TLS via explicit `UNIFI_INSECURE=1`,
  warned) and the documented `api.ui.com` Site Manager Connector base.
- CLI verbs: `--version`, `--check` (exit 78 when unconfigured), `--list-tools`.
- CI-enforced `tools/list` token budget (measured ≈6,800 tokens; ceiling 25,000).
- Opt-in read-only live contract test suite validating responses against the
  vendor schemas.
