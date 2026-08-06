import { UnifiUsageError } from '../domain/types.js';

export interface UnifiConfig {
  /** Base URL of the console, e.g. https://192.168.1.1 or the documented api.ui.com connector base. */
  readonly consoleUrl: URL;
  readonly apiKey: string;
  /** Disable TLS verification (self-signed console certificates). Residual risk; warned on start. */
  readonly insecure: boolean;
}

export interface ConfigWarnings {
  readonly warnings: readonly string[];
}

const INTEGRATION_SUFFIX = '/proxy/network/integration';

/**
 * Reads configuration from the environment.
 * UNIFI_CONSOLE_URL — console base URL. The integration path is appended unless already present
 *   (an api.ui.com Site Manager Connector base already contains its own proxy path).
 * UNIFI_API_KEY — API key from unifi.ui.com → Settings → API Keys.
 * UNIFI_INSECURE — set to "1" to accept the console's self-signed certificate.
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): {
  config: UnifiConfig;
  warnings: readonly string[];
} {
  const rawUrl = env['UNIFI_CONSOLE_URL']?.trim();
  const apiKey = env['UNIFI_API_KEY']?.trim();
  if (!rawUrl) {
    throw new UnifiUsageError(
      'UNIFI_CONSOLE_URL is not set. Set it to your console base URL, e.g. https://192.168.1.1',
    );
  }
  if (!apiKey) {
    throw new UnifiUsageError(
      'UNIFI_API_KEY is not set. Create one at unifi.ui.com → Settings → API Keys.',
    );
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
  const warnings: string[] = [];
  if (url.protocol === 'http:') {
    warnings.push(
      'UNIFI_CONSOLE_URL uses plain http: — the API key is sent unencrypted. Use https:.',
    );
  }
  const insecure = env['UNIFI_INSECURE'] === '1';
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
  return { config: { consoleUrl: url, apiKey, insecure }, warnings };
}
