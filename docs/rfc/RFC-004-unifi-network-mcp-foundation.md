# RFC-004: UniFi Network MCP Server — Foundation

- **Status:** **Approved** — Project Owner, 2026-08-06. D1–D8 approved; open questions resolved: grouped tool surface (~15), npm + GitHub release, 85% coverage threshold on `src/` enforced in CI.
- **Author:** Claude (acting as Repository Architect / API-MCP Architect / Security Engineer per `ACTIVATION_MATRIX.md`)
- **Date:** 2026-08-06
- **Repository:** `ZenixSolutions/unifi-network-mcp` (to be created)
- **Related:** RFC-001 (Lumics foundation), RFC-003 (NetBox layered surface), `claude/hudu-mcp-release-playbook.md`
- **Reviewers:** Pending — Chief Architect, Security Engineer, Devil's Advocate
- **Owner decision:** Pending

---

## Summary

A public, open-source MCP server for the **UniFi Network Integration API v10.4.57** — the fourth MCP repository under Engineering OS governance, after Lumics, Hudu, and NetBox.

Unlike the prior three, this API ships an **official machine-readable contract**: Ubiquiti publishes `openapi.json` (OpenAPI 3.1), a `llms.txt` index, and per-page documentation at `developer.ui.com`. There is no reverse-engineering step and no browser-capture risk; the committed spec _is_ the vendor's own artifact.

Four decisions were made by the Project Owner on 2026-08-06 and are recorded as approved inputs, not open questions:

| Decision              | Owner selection                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Local clone location  | `.../OneDrive-ZenixSolutions/Dev/unifi-network-mcp`                                                                          |
| Repository identity   | `ZenixSolutions/unifi-network-mcp`, public, MIT, community server (non-affiliated)                                           |
| API coverage          | Full documented Integration API surface — reads and writes; the API key's permissions decide write safety (NetBox precedent) |
| Contract verification | Live contract run against the Owner's console, reachable from the Owner's Mac                                                |

---

## The captured contract (measured, not estimated)

Downloaded from `https://developer.ui.com/network/v10.4.57/openapi.json` (409 KB, committed to `docs/reference/`):

- **OpenAPI 3.1.0**, title "UniFi Network API", version **10.4.57**
- **44 paths, 73 operations, 379 component schemas**, 14 tags
- Operation classes per `standards/security-standard.md`: **41 Read, 9 Create, 10 Update, 10 Destructive (DELETE), 3 Admin** (device restart, PoE port power-cycle, guest authorize/unauthorize — POST `/actions` endpoints with discriminated request bodies)
- **Auth:** `X-API-KEY` header; keys generated at unifi.ui.com → Settings → API Keys. _The spec declares no `securitySchemes` — a vendor spec gap we document and work around, not guess around._
- **Two documented servers:**
  - Local console — `https://{consoleIP}/proxy/network/integration`
  - Cloud proxy — `https://api.ui.com/v1/connector/consoles/{consoleId}/proxy/network/integration` (Site Manager Connector; no VPN required)
- **Pagination:** `offset`/`limit` query params (default 25, max 200); every list returns the envelope `{ offset, limit, count, totalCount, data[] }`
- **Filtering:** structured `filter` query parameter — `property.function(args)` expressions with `and()`/`or()`/`not()` composition, typed properties (STRING/INTEGER/DECIMAL/TIMESTAMP/BOOLEAN/UUID/SET), 16 functions including `like` with `.`/`*` patterns
- **Error model:** `{ code, message, statusCode, statusName, timestamp, requestId, requestPath }`
- **Rate limits:** not documented for the local API — recorded as residual risk

Resource areas: Sites, UniFi Devices (incl. pending adoption, statistics, actions), Clients (incl. guest authorization), Networks, WiFi Broadcasts, Firewall (policies + zones + ordering), ACL Rules (+ ordering), DNS Policies, Traffic Matching Lists, Hotspot Vouchers, Switching (LAGs, MC-LAG, stacks — read-only), Supporting Resources (countries, DPI, device tags, RADIUS profiles, VPN, WANs), Application Info.

---

## Goals

- `standards/repository-standard.md` met in full from the first governed PR.
- Complete typed coverage of all 73 documented operations.
- A tool surface a model navigates correctly on the first attempt (`standards/ai-interface-standard.md`), with a **CI-measured `tools/list` token budget** — adopting gap-report item 1 from RFC-003 as a self-imposed standard.
- Security posture that survives public scrutiny; live contract verification before release.

## Non-Goals

- Undocumented API surface (`CONSTITUTION.md` Article IV) — no legacy `/api/s/...` controller endpoints, which are explicitly unsupported by Ubiquiti.
- Other UniFi APIs (Protect, Access, Site Manager). The vendor's own AI guidance says stay scoped to Network; so does the repo name.
- Multi-tenant hosting, OAuth brokering. stdio for v0.1 (Hudu/NetBox precedent); Streamable HTTP deferred.

---

## Proposed Design

### D1 — Tool surface: resource-grouped, fully typed, ~15 tools

73 one-tool-per-operation tools would repeat Hudu's flagged usability risk (70 tools). The NetBox 5-tool layered pattern is wrong here for the opposite reason: it exists to absorb a 446-operation surface via runtime schema discovery, and this API has no runtime schema endpoint — but it _does_ have a stable, committed, vendor-owned spec, which makes fully-typed grouped tools cheap and drift-safe.

Proposal: **one tool per resource area** (~15), each with an `operation` discriminator and a Zod discriminated-union input schema derived from the committed spec:

`unifi_sites`, `unifi_info`, `unifi_devices`, `unifi_clients`, `unifi_networks`, `unifi_wifi_broadcasts`, `unifi_firewall_policies`, `unifi_firewall_zones`, `unifi_acl_rules`, `unifi_dns_policies`, `unifi_traffic_matching_lists`, `unifi_vouchers`, `unifi_switching`, `unifi_supporting_resources`.

- Every operation's description names its class (Read/Create/Update/Admin/Destructive) per `standards/security-standard.md`.
- **Destructive and Admin operations require `confirm: true`** in the input schema — schema-level explicitness rather than environment gates. The API key's permissions remain the real control (Owner decision), but a model cannot delete a network or power-cycle a port by accident.
- All input schemas `.strict()` — hallucinated parameters fail locally, not as confusing upstream 400s (NetBox audit finding C2).
- Pagination, `filter` syntax (with a cheat-sheet in each list tool's description), and the response envelope surface uniformly.
- CI asserts the measured `tools/list` cost stays under **25,000 tokens** via a real `initialize` + `tools/list` handshake.

### D2 — Language, runtime, tooling (RFC-001 D1, unchanged)

TypeScript 5.7+ `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; Node ≥ 20 LTS; ESM `NodeNext`; npm with committed lockfile; ESLint flat config + Prettier; Vitest with HTTP mocked at the transport boundary; Zod at every tool boundary; native `fetch`.

### D3 — Repository layout (RFC-001 D2 shape)

```
src/
  index.ts          # thin bin: shebang, arg parse, delegate — no import side effects
  server.ts         # buildServer(), exported for in-process testing
  transport/        # stdio.ts
  api/              # typed UniFi client: confined path building, auth, retry, redaction
  domain/           # types derived from the committed spec
  tools/            # one module per resource area, defineTool factory
  presentation/     # output shaping and token-budget control
docs/
  rfc/ adr/ reference/ compatibility.md    # reference/ holds openapi.json + conventions doc
tests/
.github/            # workflows, issue templates, PR template, dependabot.yml
```

CLI verbs per the Hudu/NetBox precedent: `--version`, `--check` (exit 78 unconfigured / 0 configured), `--list-tools`.

### D4 — Connectivity and configuration

- `UNIFI_API_KEY` (required) and `UNIFI_CONSOLE_URL` (e.g. `https://192.168.1.1`) — the client appends `/proxy/network/integration`.
- Local consoles ship **self-signed certificates**. `UNIFI_INSECURE=1` disables TLS verification for the configured host only, warns on every start, and is documented as residual risk (NetBox S3 precedent). Refuse non-`http(s)` schemes; warn on `http:`.
- The cloud Site Manager Connector proxy is supported by setting `UNIFI_CONSOLE_URL` to the documented `api.ui.com` connector base — same path shape, same header. Documented in `docs/compatibility.md`, verified in the live run if the Owner's console permits.

### D5 — Security posture

- API key only ever read from env; never logged; redacted from error/diagnostic output centrally, in the single choke point every tool passes through (Hudu lesson).
- Confined path builder with encoding regression tests (Lumics prototype defect class).
- Upstream error bodies scrubbed before reaching tool results.
- README token guidance is load-bearing: how to scope an API key, and that the key — not the server — is the write control.
- No secret material committed; secret scan in CI.

### D6 — Testing (proportionate per `standards/testing-standard.md`)

Unit (path building, filter builder, pagination mapping, redaction); integration (mocked HTTP per operation, all 73); contract (opt-in, against the Owner's live console — the "highest-value hour" per two prior adoptions); security (redaction, path encoding, confirm-gate, TLS handling); installation (README commands actually work); regression (one test per defect found). Coverage threshold: open question, as in RFC-001/003.

### D7 — Distribution and release

`0.1.0`, semantic versioning, tagged releases, CHANGELOG. npm identity `@zenixsolutions/unifi-network-mcp` reserved; publish per `claude/hudu-mcp-release-playbook.md` (granular token first publish, pinned npm major, dry-run gate, then trusted publishing). Branch protection with the NetBox-recorded exception (`required_approving_review_count: 0`, single-maintainer reality).

### D8 — Licensing and identity

MIT (full canonical text). Prominent README disclaimer: community project, not affiliated with or endorsed by Ubiquiti Inc.; "UniFi" used nominatively only.

---

## Open questions for the Owner

1. **Tool surface shape** — the ~15 resource-grouped tools of D1 (recommended), or one tool per operation (73)?
2. **npm publish** — publish `0.1.0` to npm as part of this effort (release playbook path), or GitHub-only now and npm later?
3. **Coverage threshold** — adopt the 85%-on-`src/` proposal that RFC-001 and RFC-003 both left open?

## Gap report — input to Engineering OS v0.2

1. Vendor OpenAPI spec declares no `securitySchemes` despite documented header auth — first case of _vendor_ spec gaps; standards assume our captures are the weak point.
2. Local-API rate limits undocumented by vendor; no standard says how to represent unknown limits to a model.
3. (Reaffirms RFC-003 items 1–2: tool-surface token ceiling and live contract testing belong in the standards.)

## Recommendation

Approve D1–D8 and resolve the three open questions. Sequence: repository conformance and CI first, then the tool surface behind tests, then the live contract run, then release. Per `CONSTITUTION.md` Article I, silence is not approval.
