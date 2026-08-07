# unifi-network-mcp

MCP server for the **official UniFi Network Integration API**.

Gives AI assistants (Claude, and any MCP-compatible client) typed, safety-gated access to your UniFi Network console: devices, clients, networks, WiFi, firewall policies and zones, ACL rules, DNS policies, traffic matching lists, hotspot vouchers, switching views, and supporting resources — the complete documented v10.4.57 surface, 73 operations behind 16 tools.

> **Community project.** Not affiliated with, endorsed by, or supported by Ubiquiti Inc. "UniFi" is used only to describe what this software connects to.

## Get started with AI

Paste this into Claude, ChatGPT, Grok, or any AI assistant for a guided, hands-on setup:

```text
Read https://raw.githubusercontent.com/ZenixSolutions/unifi-network-mcp/main/docs/ai-setup.md and follow its instructions to help me set up the UniFi Network MCP server with my AI client.
```

## Quick start (cloud, recommended)

One API key, every console you manage — no VPN, no console IPs, no self-signed certificates.

1. Create an API key: sign in at [unifi.ui.com](https://unifi.ui.com) → **Settings → API Keys** → _Create New API Key_. Store it securely — it is shown once.
2. Add the server to your MCP client. For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "npx",
      "args": ["-y", "@zenixsolutions/unifi-network-mcp"],
      "env": {
        "UNIFI_API_KEY": "<your API key>"
      }
    }
  }
}
```

3. Ask your assistant something like _"list my UniFi consoles"_, then _"list the clients at Acme HQ"_. With several consoles visible, the assistant is shown the list and picks a `consoleId` per action (ADR-002); with exactly one, it is used automatically. Calls route through Ubiquiti's documented [Site Manager Connector](https://developer.ui.com) on `api.ui.com`.

## Quick start (direct to one console)

Point the server at a single console instead by adding:

```json
"UNIFI_CONSOLE_URL": "https://192.168.1.1",
"UNIFI_INSECURE": "1"
```

(`UNIFI_INSECURE=1` accepts the console's default self-signed certificate — warned on start; see [SECURITY.md](SECURITY.md).)

## Configuration

| Variable            | Required | Meaning                                                                                                                                                                                       |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNIFI_API_KEY`     | yes      | API key from unifi.ui.com. Sent as the `X-API-KEY` header.                                                                                                                                    |
| `UNIFI_CONSOLE_URL` | no       | When set: direct mode against that console (integration path appended automatically; a full `api.ui.com` connector base also works). When unset: **cloud multi-console mode** via api.ui.com. |
| `UNIFI_INSECURE`    | no       | Direct mode only: set to `1` to accept a self-signed console certificate (warned on every start). Ignored in cloud mode.                                                                      |

Verify a configuration without connecting a client:

```sh
npx -y @zenixsolutions/unifi-network-mcp --check   # exit 0 ok, 78 misconfigured
npx -y @zenixsolutions/unifi-network-mcp --list-tools
npx -y @zenixsolutions/unifi-network-mcp --version
```

## The tool surface

16 tools cover all 73 documented operations (measured `tools/list` cost: ≈7,500 tokens). Each resource area is one tool with an `operation` argument:

`unifi_info`, `unifi_sites`, `unifi_devices`, `unifi_clients`, `unifi_networks`, `unifi_wifi_broadcasts`, `unifi_firewall_policies`, `unifi_firewall_zones`, `unifi_acl_rules`, `unifi_dns_policies`, `unifi_traffic_matching_lists`, `unifi_vouchers`, `unifi_switching`, `unifi_supporting` — plus `unifi_spec` (the vendor's exact request/response schema for any operation) and `unifi_consoles` (cloud-mode console discovery; every tool takes an optional `consoleId`).

Full per-operation reference: [docs/tools.md](docs/tools.md).

### Safety model

- Every operation is classified **Read / Create / Update / Admin / Destructive** in its tool description.
- **Destructive** (all deletes, device removal) and **Admin** (device restart, PoE power-cycle, guest authorization) operations require `confirm: true` in the call — an assistant cannot trigger them by accident.
- Request bodies are validated locally against Ubiquiti's own published OpenAPI schemas before anything is sent.
- The real write control is your **API key's permissions** — scope the key in unifi.ui.com to what you actually want an assistant to do. The server adds friction, not authorization.
- The API key is never logged and is redacted from every error message.

## Documentation

- [docs/tools.md](docs/tools.md) — tool and operation reference
- [docs/compatibility.md](docs/compatibility.md) — clients, controller versions, transports, known limitations
- [docs/reference/openapi.json](docs/reference/openapi.json) — the committed vendor contract (v10.4.57) this build is generated from
- [SECURITY.md](SECURITY.md) — security posture, residual risks, reporting
- [CHANGELOG.md](CHANGELOG.md) — release notes

## Development

```sh
npm install
npm run generate      # regenerate op map from docs/reference/openapi.json
npm run typecheck && npm run lint && npm test
npm run build
npm run check:budget  # measured tools/list token budget (CI-enforced)
UNIFI_CONSOLE_URL=... UNIFI_API_KEY=... npm run test:contract  # live, read-only
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Governance follows the Engineering OS framework; the foundation decisions are recorded in [docs/rfc/RFC-004-unifi-network-mcp-foundation.md](docs/rfc/RFC-004-unifi-network-mcp-foundation.md).

## License

[MIT](LICENSE)
