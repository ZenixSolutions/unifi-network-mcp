import { UnifiUsageError } from '../domain/types.js';

export const CLOUD_BASE = 'https://api.ui.com';

export interface UnifiConfig {
  /**
   * 'direct'  — UNIFI_CONSOLE_URL points at one console (or a full connector base).
   * 'cloud'   — no console URL configured; calls route through the api.ui.com
   *             Site Manager Connector and each call targets a consoleId
   *             discovered via the unifi_consoles tool (ADR-002).
   */
  readonly mode: 'direct' | 'cloud';
  /** Set in direct mode only: full integration base URL for the one console. */
  readonly consoleUrl?: URL;
  readonly apiKey: string;
  /** Disable TLS verification (self-signed console certificates). Residual risk; warned on start. */
  readonly insecure: boolean;
}

const INTEGRATION_SUFFIX = '/proxy/network/integration';

/**
 * Reads configuration from the environment.
 * UNIFI_API_KEY — required. API key from unifi.ui.com → Settings → API Keys.
 * UNIFI_CONSOLE_URL — optional. When set: direct mode against that console
 *   (the integration path is appended unless already present). When absent:
 *   cloud multi-console mode via api.ui.com (ADR-002).
 * UNIFI_INSECURE — set to "1" to accept a console's self-signed certificate
 *   (direct mode only; api.ui.com has a publicly trusted certificate).
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): {
  config: UnifiConfig;
  warnings: readonly string[];
} {
  const rawUrl = env['UNIFI_CONSOLE_URL']?.trim();
  const apiKey = env['UNIFI_API_KEY']?.trim();
  if (!apiKey) {
    throw new UnifiUsageError(
      'UNIFI_API_KEY is not set. Create one at unifi.ui.com → Settings → API Keys.',
    );
  }
  const warnings: string[] = [];
  const insecure = env['UNIFI_INSECURE'] === '1';

  if (!rawUrl) {
    // Cloud multi-console mode.
    if (insecure) {
      warnings.push(
        'UNIFI_INSECURE=1 is ignored in cloud mode — api.ui.com uses a publicly trusted certificate.',
      );
    }
    return { config: { mode: 'cloud', apiKey, insecure: false }, warnings };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnifiUsageError(`UNIFI_CONSOLE_URL is not a valid URL: ${rawUrl}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnifiUsageError(`UNIFI_CONSOLE_URL must use http(s); got scheme "${url.protocol}"`);
  }
  if (url.protocol === 'http:') {
    warnings.push(
      'UNIFI_CONSOLE_URL uses plain http: — the API key is sent unencrypted. Use https:.',
    );
  }
  if (insecure) {
    warnings.push(
      'UNIFI_INSECURE=1 — TLS certificate verification is DISABLED for the console host. ' +
        'This accepts self-signed certificates but also man-in-the-middle attacks. ' +
        'Residual risk documented in SECURITY.md.',
    );
  }
  if (!url.pathname.replace(/\/+$/, '').endsWith(INTEGRATION_SUFFIX)) {
    url = new URL(url.origin + url.pathname.replace(/\/+$/, '') + INTEGRATION_SUFFIX);
  }
  return { config: { mode: 'direct', consoleUrl: url, apiKey, insecure }, warnings };
}
