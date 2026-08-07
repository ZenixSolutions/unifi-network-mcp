# AI-guided setup — unifi-network-mcp

You are an AI assistant. A user pasted a prompt pointing you here so you can
help them connect their UniFi network to an AI client through the
`@zenixsolutions/unifi-network-mcp` MCP server. Follow these steps in order,
adapting to their platform. This is a community project, not affiliated with
or endorsed by Ubiquiti Inc.

## 1. Identify their AI client

Ask which client they use if it is not obvious from context.

- **Works today (MCP over stdio):** Claude Desktop, Claude Code, Cursor,
  Windsurf, and any MCP client that can launch a local stdio server.
- **ChatGPT and Grok:** their connectors currently require a hosted remote
  URL. This release is stdio-only; a remote HTTP transport is on the roadmap
  but NOT available yet. Be honest about this — do not improvise a workaround.
  Offer to set them up on a supported client instead, and suggest watching
  https://github.com/ZenixSolutions/unifi-network-mcp for the HTTP release.

## 2. Check prerequisites

Node.js ≥ 20 (`node --version`). If missing, help them install it from
https://nodejs.org first.

## 3. Create a UniFi API key

Walk them through: sign in at **unifi.ui.com** → **Settings → API Keys** →
**Create New API Key**.

- The key is shown **once** — have them store it securely.
- **Never ask the user to paste the key into this chat.** It belongs only in
  their client's local config file.
- Suggest a key scoped to the least privilege they need — the key's
  permissions are the real write control; the server adds confirmation
  friction, not authorization.

## 4. Add the server (cloud multi-console mode — recommended)

Only the API key is needed: no VPN, no console IP, no self-signed-TLS
workarounds. Calls route through Ubiquiti's documented Site Manager Connector,
and every console their account can see becomes available.

**Claude Desktop** — merge into `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`,
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "unifi-network": {
      "command": "npx",
      "args": ["-y", "@zenixsolutions/unifi-network-mcp"],
      "env": {
        "UNIFI_API_KEY": "PASTE-KEY-HERE"
      }
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add unifi-network -e UNIFI_API_KEY=PASTE-KEY-HERE -- npx -y @zenixsolutions/unifi-network-mcp
```

**Other stdio MCP clients:** command `npx`, args
`["-y", "@zenixsolutions/unifi-network-mcp"]`, env `UNIFI_API_KEY`.

**Direct-to-one-console alternative:** add
`"UNIFI_CONSOLE_URL": "https://<console-ip>"` and, if the console uses its
default self-signed certificate, `"UNIFI_INSECURE": "1"` — explain that this
disables TLS verification for that host and the cloud mode above avoids the
issue entirely.

## 5. Verify before restarting the client

Have them run (with their real key, in their own terminal):

```sh
UNIFI_API_KEY=PASTE-KEY-HERE npx -y @zenixsolutions/unifi-network-mcp --check
```

Expected output: `configuration ok`. Then restart the AI client so it picks
up the new server.

## 6. First prompts to try

- "List my UniFi consoles"
- "List the clients at <console name>"
- "Show the networks on <console name>"

If several consoles are visible, tools ask for an explicit `consoleId` rather
than guessing — that is by design, so nothing ever targets the wrong site.

## 7. Safety notes to relay

- Destructive and admin operations (deletes, device restart, PoE power-cycle,
  guest authorization) require an explicit `confirm: true` per call.
- Request bodies are validated against Ubiquiti's own published schemas
  before anything is sent.
- The API key is never logged and is redacted from error messages.

Full docs: `README.md`, `docs/tools.md`, `docs/compatibility.md` in the
repository.
