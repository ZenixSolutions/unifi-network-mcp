/**
 * Minimal request bodies that must satisfy the vendor schemas for every
 * body-carrying operation. Keyed by vendor operationId. If an operation
 * gains a body in a future spec, the all-operations test fails until a
 * fixture is added here — deliberate.
 */
export const BODY_FIXTURES: Readonly<Record<string, unknown>> = {
  adoptDevice: { macAddress: 'aa:bb:cc:dd:ee:ff', ignoreDeviceLimit: false },
  executeAdoptedDeviceAction: { action: 'RESTART' },
  executePortAction: { action: 'POWER_CYCLE' },
  executeConnectedClientAction: { action: 'AUTHORIZE_GUEST_ACCESS', timeLimitMinutes: 60 },

  createNetwork: {
    type: 'GATEWAY',
    name: 'test-network',
    enabled: true,
    internetAccessEnabled: true,
    isolationEnabled: false,
    cellularBackupEnabled: false,
    management: 'GATEWAY',
    vlanId: 100,
    ipv4Configuration: { autoScaleEnabled: false, hostIpAddress: '10.10.0.1', prefixLength: 24 },
  },
  updateNetwork: {
    type: 'GATEWAY',
    name: 'test-network',
    enabled: true,
    internetAccessEnabled: true,
    isolationEnabled: false,
    cellularBackupEnabled: false,
    management: 'GATEWAY',
    vlanId: 100,
    ipv4Configuration: { autoScaleEnabled: false, hostIpAddress: '10.10.0.1', prefixLength: 24 },
  },

  createWifiBroadcast: {
    type: 'STANDARD',
    name: 'test-ssid',
    enabled: true,
    hideName: false,
    advertiseDeviceName: false,
    arpProxyEnabled: false,
    broadcastingFrequenciesGHz: [2.4, 5],
    bssTransitionEnabled: false,
    channel2gLockedTo6: false,
    clientIsolationEnabled: false,
    dtimPeriod2gLockedTo3: false,
    multicastToUnicastConversionEnabled: false,
    uapsdEnabled: false,
    securityConfiguration: { type: 'OPEN' },
  },
  updateWifiBroadcast: {
    type: 'STANDARD',
    name: 'test-ssid',
    enabled: true,
    hideName: false,
    advertiseDeviceName: false,
    arpProxyEnabled: false,
    broadcastingFrequenciesGHz: [2.4],
    bssTransitionEnabled: false,
    channel2gLockedTo6: false,
    clientIsolationEnabled: false,
    dtimPeriod2gLockedTo3: false,
    multicastToUnicastConversionEnabled: false,
    uapsdEnabled: false,
    securityConfiguration: { type: 'OPEN' },
  },

  createFirewallPolicy: {
    name: 'test-policy',
    enabled: true,
    loggingEnabled: false,
    action: { type: 'ALLOW', allowReturnTraffic: true },
    source: { zoneId: '11111111-2222-4333-8444-555555555555' },
    destination: { zoneId: '99999999-8888-4777-8666-555555555555' },
    ipProtocolScope: { ipVersion: 'IPV4' },
  },
  updateFirewallPolicy: {
    name: 'test-policy',
    enabled: true,
    loggingEnabled: false,
    action: { type: 'BLOCK' },
    source: { zoneId: '11111111-2222-4333-8444-555555555555' },
    destination: { zoneId: '99999999-8888-4777-8666-555555555555' },
    ipProtocolScope: { ipVersion: 'IPV4' },
  },
  patchFirewallPolicy: { name: 'renamed-policy' },
  updateFirewallPolicyOrdering: {
    orderedFirewallPolicyIds: { afterSystemDefined: [], beforeSystemDefined: [] },
  },

  createFirewallZone: { name: 'test-zone', networkIds: ['11111111-2222-4333-8444-555555555555'] },
  updateFirewallZone: { name: 'test-zone', networkIds: ['11111111-2222-4333-8444-555555555555'] },

  createAclRule: { type: 'IPV4', name: 'test-rule', enabled: true, action: 'ALLOW' },
  updateAclRule: { type: 'IPV4', name: 'test-rule', enabled: true, action: 'BLOCK' },
  updateAclRuleOrdering: { orderedAclRuleIds: ['11111111-2222-4333-8444-555555555555'] },

  createDnsPolicy: {
    type: 'A_RECORD',
    domain: 'test.example.com',
    enabled: true,
    ipv4Address: '10.0.0.5',
    ttlSeconds: 300,
  },
  updateDnsPolicy: {
    type: 'A_RECORD',
    domain: 'test.example.com',
    enabled: true,
    ipv4Address: '10.0.0.6',
    ttlSeconds: 300,
  },

  createTrafficMatchingList: { type: 'PORTS', name: 'test-list', items: [{ type: 'PORT' }] },
  updateTrafficMatchingList: { type: 'PORTS', name: 'test-list', items: [{ type: 'PORT' }] },

  createVouchers: { name: 'test-voucher', timeLimitMinutes: 60 },
};
