import { Agent, fetch as undiciFetch, type Dispatcher, type Response } from 'undici';
import { CLOUD_BASE, type UnifiConfig } from './config.js';
import { makeRedactor } from './redact.js';
import { UnifiApiError, UnifiUsageError } from '../domain/types.js';

export interface RequestSpec {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path template with {placeholders}, e.g. /v1/sites/{siteId}/devices */
  readonly pathTemplate: string;
  readonly pathParams: Readonly<Record<string, string | number>>;
  readonly queryParams: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
  /** Cloud mode (ADR-002): the console to route this call to. */
  readonly consoleId?: string;
}

/** One console visible to the API key, via Site Manager GET /v1/hosts (ADR-002). */
export interface ConsoleSummary {
  readonly id: string;
  readonly name: string;
  readonly type?: string;
  readonly ipAddress?: string;
}

interface ErrorBody {
  code?: string;
  message?: string;
  requestId?: string;
  statusCode?: number;
  statusName?: string;
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;

/**
 * Confined path builder: every substituted value is URL-encoded, and the
 * template is the only source of path structure. A value can never add
 * path segments (Lumics prototype defect class).
 */
export function buildPath(
  template: string,
  params: Readonly<Record<string, string | number>>,
): string {
  const seen = new Set<string>();
  const built = template.replace(/\{([^}]+)\}/g, (_m, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new UnifiUsageError(`Missing required path parameter "${name}"`);
    }
    seen.add(name);
    return encodeURIComponent(String(value));
  });
  for (const name of Object.keys(params)) {
    if (!seen.has(name)) {
      throw new UnifiUsageError(`Unknown path parameter "${name}" for template ${template}`);
    }
  }
  return built;
}

export class UnifiClient {
  private readonly dispatcher: Dispatcher | undefined;
  private readonly redact: (text: string) => string;
  private hostsCache: ConsoleSummary[] | undefined;

  constructor(
    private readonly config: UnifiConfig,
    private readonly fetchImpl: typeof undiciFetch = undiciFetch,
  ) {
    this.redact = makeRedactor([config.apiKey]);
    this.dispatcher = config.insecure
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;
  }

  get mode(): 'direct' | 'cloud' {
    return this.config.mode;
  }

  /** Integration base for one call: the configured console, or the connector proxy. */
  private baseFor(consoleId?: string): string {
    if (this.config.mode === 'direct') {
      if (!this.config.consoleUrl) {
        throw new UnifiUsageError('Direct mode requires UNIFI_CONSOLE_URL');
      }
      return this.config.consoleUrl.toString().replace(/\/+$/, '');
    }
    if (!consoleId) {
      throw new UnifiUsageError(
        'Cloud mode: consoleId is required. Call unifi_consoles { operation: "list" } and pass the chosen consoleId.',
      );
    }
    return `${CLOUD_BASE}/v1/connector/consoles/${encodeURIComponent(consoleId)}/proxy/network/integration`;
  }

  /**
   * Lists the consoles visible to this API key via the Site Manager API
   * (GET https://api.ui.com/v1/hosts). Discovery only — the Network API
   * remains the sole operational surface (ADR-002). Cached per process.
   */
  async listConsoles(forceRefresh = false): Promise<ConsoleSummary[]> {
    if (this.hostsCache && !forceRefresh) return this.hostsCache;
    const raw = await this.fetchJson(new URL(`${CLOUD_BASE}/v1/hosts`), { method: 'GET' });
    const data =
      typeof raw === 'object' && raw !== null && Array.isArray((raw as { data?: unknown }).data)
        ? ((raw as { data: unknown[] }).data as Record<string, unknown>[])
        : [];
    this.hostsCache = data
      .filter((h) => typeof h['id'] === 'string')
      .map((h) => {
        const reported =
          typeof h['reportedState'] === 'object' && h['reportedState'] !== null
            ? (h['reportedState'] as Record<string, unknown>)
            : {};
        const name =
          firstString(reported['name'], reported['hostname'], h['hardwareId'], h['id']) ??
          'unknown';
        return {
          id: h['id'] as string,
          name,
          ...(typeof h['type'] === 'string' ? { type: h['type'] } : {}),
          ...(typeof h['ipAddress'] === 'string' ? { ipAddress: h['ipAddress'] } : {}),
        };
      });
    return this.hostsCache;
  }

  /** Performs one API request; retries idempotent GETs on 429/5xx/network errors. */
  async request(spec: RequestSpec): Promise<unknown> {
    const path = buildPath(spec.pathTemplate, spec.pathParams);
    const url = new URL(this.baseFor(spec.consoleId) + path);
    for (const [k, v] of Object.entries(spec.queryParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    return this.fetchJson(url, {
      method: spec.method,
      ...(spec.body === undefined ? {} : { body: spec.body }),
    });
  }

  private async fetchJson(
    url: URL,
    init: { method: RequestSpec['method']; body?: unknown },
  ): Promise<unknown> {
    const attempts = init.method === 'GET' ? MAX_RETRIES + 1 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await sleep(250 * 2 ** (attempt - 1));
      try {
        const response = await this.fetchImpl(url, {
          method: init.method,
          headers: {
            'X-API-KEY': this.config.apiKey,
            Accept: 'application/json',
            ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
          ...(this.dispatcher ? { dispatcher: this.dispatcher } : {}),
        });
        if (RETRYABLE_STATUS.has(response.status) && attempt < attempts - 1) {
          lastError = await this.toApiError(response);
          continue;
        }
        if (!response.ok) throw await this.toApiError(response);
        return await this.parseBody(response);
      } catch (error) {
        if (error instanceof UnifiApiError) throw error;
        lastError = error;
        if (attempt === attempts - 1) {
          const message = error instanceof Error ? error.message : String(error);
          throw new UnifiApiError(this.redact(`Request to the UniFi API failed: ${message}`), 0);
        }
      }
    }
    if (lastError instanceof UnifiApiError) throw lastError;
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new UnifiApiError(this.redact(`Request to the UniFi API failed: ${message}`), 0);
  }

  private async parseBody(response: Response): Promise<unknown> {
    if (response.status === 204) return { ok: true };
    const text = await response.text();
    if (text.length === 0) return { ok: true };
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UnifiApiError(
        this.redact(
          `Received a non-JSON response (status ${response.status}). ` +
            'Check that the configured URL points at a UniFi Network console or api.ui.com.',
        ),
        response.status,
      );
    }
  }

  private async toApiError(response: Response): Promise<UnifiApiError> {
    let parsed: ErrorBody = {};
    try {
      parsed = (await response.json()) as ErrorBody;
    } catch {
      /* non-JSON error body — fall through to status-only error */
    }
    const detail = typeof parsed.message === 'string' ? parsed.message : response.statusText;
    return new UnifiApiError(
      this.redact(`UniFi API error ${response.status}: ${detail}`),
      response.status,
      typeof parsed.code === 'string' ? parsed.code : undefined,
      typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
    );
  }
}

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
