import { describe, expect, it, vi } from 'vitest';
import type { fetch as undiciFetch } from 'undici';
import { UnifiClient, buildPath } from '../../src/api/client.js';
import { loadConfig } from '../../src/api/config.js';
import { UnifiApiError, UnifiUsageError } from '../../src/domain/types.js';

const { config } = loadConfig({
  UNIFI_CONSOLE_URL: 'https://console.example',
  UNIFI_API_KEY: 'top-secret-key',
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

type FetchImpl = typeof undiciFetch;

describe('buildPath', () => {
  it('substitutes and URL-encodes parameters', () => {
    expect(
      buildPath('/v1/sites/{siteId}/devices/{deviceId}', { siteId: 'a b', deviceId: 'x/y' }),
    ).toBe('/v1/sites/a%20b/devices/x%2Fy');
  });

  it('a value cannot add path segments (injection regression)', () => {
    const built = buildPath('/v1/sites/{siteId}', { siteId: '../../admin' });
    expect(built).toBe('/v1/sites/..%2F..%2Fadmin');
    expect(built.split('/').length).toBe(4); // same as the template itself
  });

  it('throws on a missing parameter', () => {
    expect(() => buildPath('/v1/sites/{siteId}', {})).toThrow(UnifiUsageError);
  });

  it('throws on an unknown parameter', () => {
    expect(() => buildPath('/v1/sites/{siteId}', { siteId: 'a', extra: 'b' })).toThrow(
      /Unknown path parameter/,
    );
  });
});

describe('UnifiClient.request', () => {
  it('sends the API key header and query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: 1 }));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    await client.request({
      method: 'GET',
      pathTemplate: '/v1/sites/{siteId}/clients',
      pathParams: { siteId: 's1' },
      queryParams: { offset: 0, limit: 25, filter: undefined },
    });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      'https://console.example/proxy/network/integration/v1/sites/s1/clients?offset=0&limit=25',
    );
    expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('top-secret-key');
  });

  it('serialises the body and sets content-type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    await client.request({
      method: 'POST',
      pathTemplate: '/v1/x',
      pathParams: {},
      queryParams: {},
      body: { a: 1 },
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('retries GET on 503 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, {}))
      .mockResolvedValueOnce(jsonResponse(200, { fine: true }));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    const result = await client.request({
      method: 'GET',
      pathTemplate: '/v1/info',
      pathParams: {},
      queryParams: {},
    });
    expect(result).toEqual({ fine: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-GET requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, {}));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    await expect(
      client.request({ method: 'DELETE', pathTemplate: '/v1/x', pathParams: {}, queryParams: {} }),
    ).rejects.toBeInstanceOf(UnifiApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the documented error fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        code: 'api.authentication.missing-credentials',
        message: 'Missing credentials',
        requestId: 'req-1',
        statusCode: 401,
      }),
    );
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    const error = await client
      .request({ method: 'GET', pathTemplate: '/v1/info', pathParams: {}, queryParams: {} })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnifiApiError);
    const apiError = error as UnifiApiError;
    expect(apiError.statusCode).toBe(401);
    expect(apiError.code).toBe('api.authentication.missing-credentials');
    expect(apiError.requestId).toBe('req-1');
  });

  it('never leaks the API key in error messages', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('connect failed for key top-secret-key'));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    const error = await client
      .request({ method: 'GET', pathTemplate: '/v1/info', pathParams: {}, queryParams: {} })
      .catch((e: unknown) => e);
    expect((error as Error).message).not.toContain('top-secret-key');
    expect((error as Error).message).toContain('[REDACTED]');
  });

  it('rejects a non-JSON success body with a helpful error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('<html>login</html>', { status: 200 }));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    await expect(
      client.request({ method: 'GET', pathTemplate: '/v1/info', pathParams: {}, queryParams: {} }),
    ).rejects.toThrow(/non-JSON/);
  });

  it('treats 204 and empty bodies as success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new UnifiClient(config, fetchMock as unknown as FetchImpl);
    const result = await client.request({
      method: 'DELETE',
      pathTemplate: '/v1/x',
      pathParams: {},
      queryParams: {},
    });
    expect(result).toEqual({ ok: true });
  });
});
