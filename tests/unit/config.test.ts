import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/api/config.js';
import { UnifiUsageError } from '../../src/domain/types.js';

const BASE = { UNIFI_CONSOLE_URL: 'https://192.168.1.1', UNIFI_API_KEY: 'k-123' };

describe('loadConfig', () => {
  it('appends the integration path to a bare console URL', () => {
    const { config } = loadConfig(BASE);
    expect(config.consoleUrl!.toString()).toBe('https://192.168.1.1/proxy/network/integration');
  });

  it('does not double-append when the integration path is already present', () => {
    const { config } = loadConfig({
      ...BASE,
      UNIFI_CONSOLE_URL: 'https://192.168.1.1/proxy/network/integration',
    });
    expect(config.consoleUrl!.toString()).toBe('https://192.168.1.1/proxy/network/integration');
  });

  it('supports the documented api.ui.com connector base', () => {
    const { config } = loadConfig({
      ...BASE,
      UNIFI_CONSOLE_URL:
        'https://api.ui.com/v1/connector/consoles/abc:123/proxy/network/integration',
    });
    expect(config.consoleUrl!.pathname).toBe(
      '/v1/connector/consoles/abc:123/proxy/network/integration',
    );
  });

  it('enters cloud multi-console mode when no console URL is set (ADR-002)', () => {
    const { config, warnings } = loadConfig({ UNIFI_API_KEY: 'k' });
    expect(config.mode).toBe('cloud');
    expect(config.consoleUrl).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  it('ignores UNIFI_INSECURE in cloud mode with a warning', () => {
    const { config, warnings } = loadConfig({ UNIFI_API_KEY: 'k', UNIFI_INSECURE: '1' });
    expect(config.insecure).toBe(false);
    expect(warnings.some((w) => w.includes('cloud mode'))).toBe(true);
  });

  it('uses direct mode when a console URL is set', () => {
    const { config } = loadConfig(BASE);
    expect(config.mode).toBe('direct');
  });

  it('rejects a missing API key', () => {
    expect(() => loadConfig({ UNIFI_CONSOLE_URL: 'https://x' })).toThrow(UnifiUsageError);
    expect(() => loadConfig({ UNIFI_CONSOLE_URL: 'https://x' })).toThrow(/UNIFI_API_KEY/);
  });

  it('rejects an invalid URL', () => {
    expect(() => loadConfig({ ...BASE, UNIFI_CONSOLE_URL: 'not a url' })).toThrow(
      /not a valid URL/,
    );
  });

  it('refuses non-http(s) schemes', () => {
    expect(() => loadConfig({ ...BASE, UNIFI_CONSOLE_URL: 'file:///etc/passwd' })).toThrow(
      /must use http/,
    );
  });

  it('warns on plain http', () => {
    const { warnings } = loadConfig({ ...BASE, UNIFI_CONSOLE_URL: 'http://192.168.1.1' });
    expect(warnings.some((w) => w.includes('unencrypted'))).toBe(true);
  });

  it('warns when TLS verification is disabled', () => {
    const { config, warnings } = loadConfig({ ...BASE, UNIFI_INSECURE: '1' });
    expect(config.insecure).toBe(true);
    expect(warnings.some((w) => w.includes('DISABLED'))).toBe(true);
  });

  it('does not treat UNIFI_INSECURE=0 as insecure', () => {
    const { config } = loadConfig({ ...BASE, UNIFI_INSECURE: '0' });
    expect(config.insecure).toBe(false);
  });
});
