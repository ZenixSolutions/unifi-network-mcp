import { Agent, fetch as undiciFetch, type Dispatcher, type Response } from 'undici';
import type { UnifiConfig } from './config.js';
import { makeRedactor } from './redact.js';
import { UnifiApiError, UnifiUsageError } from '../domain/types.js';

export interface RequestSpec {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Path template with {placeholders}, e.g. /v1/sites/{siteId}/devices */
  readonly pathTemplate: string;
  readonly pathParams: Readonly<Record<string, string | number>>;
  readonly queryParams: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
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

  constructor(
    private readonly config: UnifiConfig,
    private readonly fetchImpl: typeof undiciFetch = undiciFetch,
  ) {
    this.redact = makeRedactor([config.apiKey]);
    this.dispatcher = config.insecure
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;
  }

  /** Performs one API request; retries idempotent GETs on 429/5xx/network errors. */
  async request(spec: RequestSpec): Promise<unknown> {
    const path = buildPath(spec.pathTemplate, spec.pathParams);
    const url = new URL(this.config.consoleUrl.toString().replace(/\/+$/, '') + path);
    for (const [k, v] of Object.entries(spec.queryParams)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const attempts = spec.method === 'GET' ? MAX_RETRIES + 1 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await sleep(250 * 2 ** (attempt - 1));
      try {
        const response = await this.fetchImpl(url, {
          method: spec.method,
          headers: {
            'X-API-KEY': this.config.apiKey,
            Accept: 'application/json',
            ...(spec.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }),
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
          throw new UnifiApiError(
            this.redact(`Request to the UniFi console failed: ${message}`),
            0,
          );
        }
      }
    }
    if (lastError instanceof UnifiApiError) throw lastError;
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new UnifiApiError(this.redact(`Request to the UniFi console failed: ${message}`), 0);
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
          `Console returned a non-JSON response (status ${response.status}). ` +
            'Check that UNIFI_CONSOLE_URL points at a UniFi Network console.',
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
