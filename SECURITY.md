# Security

## Reporting a vulnerability

Please report suspected vulnerabilities privately via GitHub Security Advisories
(**Security → Report a vulnerability** on the repository). Do not open a public
issue for an unpatched vulnerability. We aim to acknowledge reports within 72 hours.

## Security posture

- **Credentials.** The API key is read only from the `UNIFI_API_KEY` environment
  variable, is never written to disk or logs, and is redacted (`[REDACTED]`) from
  every error and diagnostic message at a single choke point.
- **Authorization.** The server adds _friction_ (confirm gates, local validation),
  but the API key's permission scope — configured at unifi.ui.com — is the real
  control. Create a key scoped to what you actually want an assistant to do.
- **Operation classes.** Every operation is classified Read / Create / Update /
  Admin / Destructive (per our security standard); Destructive and Admin
  operations require `confirm: true` and are marked in tool descriptions.
- **Input validation.** Tool envelopes are validated with strict Zod schemas
  (unknown fields rejected); request bodies are validated against the vendor's
  own OpenAPI schemas before any request is sent. Path parameters are URL-encoded
  through a confined path builder — a value can never add path segments.
- **Transport.** `https:` expected; `http:` produces a warning on every start.
  Non-http(s) schemes are refused.

## Residual risks (documented, not hidden)

- **`UNIFI_INSECURE=1` disables TLS verification.** UniFi consoles ship
  self-signed certificates, so this option exists — but it also accepts
  man-in-the-middle attacks on the path to your console. Prefer a console
  certificate your machine trusts, or the `api.ui.com` connector base. The
  server warns on every start when this is set.
- **Rate limits are undocumented** for the local Integration API. The server
  retries idempotent GETs on 429/5xx with backoff, but cannot promise
  documented limits.
- **Nested discriminated unions are validated shallowly.** Top-level
  discriminators (e.g. network `type`, action names) are pinned and enforced;
  some deeply nested variant fields are checked by the console rather than
  locally. A request that passes local validation can still be rejected
  upstream with the documented error shape.

## Secrets in the repository

No secret material is committed. CI runs a secret scan on every push and pull
request.
