# Tool reference

Generated from the committed vendor contract (UniFi Network API v10.4.57) — do not edit by hand; run `npm run generate`.

Every tool takes an `operation` argument. Operations marked ⚠️ require `confirm: true`.
For exact request-body shapes, call `unifi_spec` with `{ "operation": "<tool>.<operation>" }`.

## `unifi_supporting`

Supporting resources (countries, DPI, device tags, RADIUS, VPN, WANs)

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list_countries` (offset?, limit?, filter?) | Read | `GET /v1/countries` | List Countries |
| `list_dpi_applications` (offset?, limit?, filter?) | Read | `GET /v1/dpi/applications` | List DPI Applications |
| `list_dpi_categories` (offset?, limit?, filter?) | Read | `GET /v1/dpi/categories` | List DPI Application Categories |
| `list_device_tags` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/device-tags` | List Device Tags |
| `list_radius_profiles` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/radius/profiles` | List Radius Profiles |
| `list_vpn_servers` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/vpn/servers` | List VPN Servers |
| `list_site_to_site_vpn_tunnels` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/vpn/site-to-site-tunnels` | List Site-To-Site VPN Tunnels |
| `list_wans` (siteId, offset?, limit?) | Read | `GET /v1/sites/{siteId}/wans` | List WAN Interfaces |

## `unifi_info`

UniFi Network application info

| Operation | Class | API call | Summary |
|---|---|---|---|
| `get` | Read | `GET /v1/info` | Get Application Info |

## `unifi_devices`

UniFi devices (adoption, details, statistics, restart, PoE port power-cycle)

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list_pending` (offset?, limit?, filter?) | Read | `GET /v1/pending-devices` | List Devices Pending Adoption |
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/devices` | List Adopted Devices |
| `adopt` (siteId, body) | Create | `POST /v1/sites/{siteId}/devices` | Adopt Devices |
| `remove` (siteId, deviceId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/devices/{deviceId}` | Remove (Unadopt) Device |
| `get` (siteId, deviceId) | Read | `GET /v1/sites/{siteId}/devices/{deviceId}` | Get Adopted Device Details |
| `execute_action` (siteId, deviceId, body) | Admin ⚠️ | `POST /v1/sites/{siteId}/devices/{deviceId}/actions` | Execute Adopted Device Action |
| `execute_port_action` (portIdx, siteId, deviceId, body) | Admin ⚠️ | `POST /v1/sites/{siteId}/devices/{deviceId}/interfaces/ports/{portIdx}/actions` | Execute Port Action |
| `get_statistics` (siteId, deviceId) | Read | `GET /v1/sites/{siteId}/devices/{deviceId}/statistics/latest` | Get Latest Adopted Device Statistics |

## `unifi_sites`

Sites on this UniFi Network console

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (offset?, limit?, filter?) | Read | `GET /v1/sites` | List Local Sites |

## `unifi_acl_rules`

ACL rules and their ordering

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/acl-rules` | List ACL Rules |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/acl-rules` | Create ACL Rule |
| `get_ordering` (siteId) | Read | `GET /v1/sites/{siteId}/acl-rules/ordering` | Get User-Defined ACL Rule Ordering |
| `update_ordering` (siteId, body) | Update | `PUT /v1/sites/{siteId}/acl-rules/ordering` | Reorder User-Defined ACL Rules |
| `delete` (aclRuleId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/acl-rules/{aclRuleId}` | Delete ACL Rule |
| `get` (aclRuleId, siteId) | Read | `GET /v1/sites/{siteId}/acl-rules/{aclRuleId}` | Get ACL Rule |
| `update` (aclRuleId, siteId, body) | Update | `PUT /v1/sites/{siteId}/acl-rules/{aclRuleId}` | Update ACL Rule |

## `unifi_clients`

Connected clients (list, details, guest authorization)

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/clients` | List Connected Clients |
| `get` (clientId, siteId) | Read | `GET /v1/sites/{siteId}/clients/{clientId}` | Get Connected Client Details |
| `execute_action` (clientId, siteId, body) | Admin ⚠️ | `POST /v1/sites/{siteId}/clients/{clientId}/actions` | Execute Client Action |

## `unifi_dns_policies`

DNS policies

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/dns/policies` | List DNS Policies |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/dns/policies` | Create DNS Policy |
| `delete` (dnsPolicyId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/dns/policies/{dnsPolicyId}` | Delete DNS Policy |
| `get` (dnsPolicyId, siteId) | Read | `GET /v1/sites/{siteId}/dns/policies/{dnsPolicyId}` | Get DNS Policy |
| `update` (dnsPolicyId, siteId, body) | Update | `PUT /v1/sites/{siteId}/dns/policies/{dnsPolicyId}` | Update DNS Policy |

## `unifi_firewall_policies`

Firewall policies and their ordering

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/firewall/policies` | List Firewall Policies |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/firewall/policies` | Create Firewall Policy |
| `get_ordering` (siteId, sourceFirewallZoneId, destinationFirewallZoneId) | Read | `GET /v1/sites/{siteId}/firewall/policies/ordering` | Get User-Defined Firewall Policy Ordering |
| `update_ordering` (siteId, sourceFirewallZoneId, destinationFirewallZoneId, body) | Update | `PUT /v1/sites/{siteId}/firewall/policies/ordering` | Reorder User-Defined Firewall Policies |
| `delete` (firewallPolicyId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}` | Delete Firewall Policy |
| `get` (firewallPolicyId, siteId) | Read | `GET /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}` | Get Firewall Policy |
| `patch` (firewallPolicyId, siteId, body) | Update | `PATCH /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}` | Patch Firewall Policy |
| `update` (firewallPolicyId, siteId, body) | Update | `PUT /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}` | Update Firewall Policy |

## `unifi_firewall_zones`

Firewall zones

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/firewall/zones` | List Firewall Zones |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/firewall/zones` | Create Custom Firewall Zone |
| `delete` (firewallZoneId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/firewall/zones/{firewallZoneId}` | Delete Custom Firewall Zone |
| `get` (firewallZoneId, siteId) | Read | `GET /v1/sites/{siteId}/firewall/zones/{firewallZoneId}` | Get Firewall Zone |
| `update` (firewallZoneId, siteId, body) | Update | `PUT /v1/sites/{siteId}/firewall/zones/{firewallZoneId}` | Update Firewall Zone |

## `unifi_vouchers`

Hotspot vouchers

| Operation | Class | API call | Summary |
|---|---|---|---|
| `delete_by_filter` (siteId, filter) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/hotspot/vouchers` | Delete Vouchers |
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/hotspot/vouchers` | List Vouchers |
| `generate` (siteId, body) | Create | `POST /v1/sites/{siteId}/hotspot/vouchers` | Generate Vouchers |
| `delete` (voucherId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/hotspot/vouchers/{voucherId}` | Delete Voucher |
| `get` (voucherId, siteId) | Read | `GET /v1/sites/{siteId}/hotspot/vouchers/{voucherId}` | Get Voucher Details |

## `unifi_networks`

Networks (VLANs/subnets) configuration

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/networks` | List Networks |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/networks` | Create Network |
| `delete` (networkId, siteId, force?) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/networks/{networkId}` | Delete Network |
| `get` (networkId, siteId) | Read | `GET /v1/sites/{siteId}/networks/{networkId}` | Get Network Details |
| `update` (networkId, siteId, body) | Update | `PUT /v1/sites/{siteId}/networks/{networkId}` | Update Network |
| `get_references` (networkId, siteId) | Read | `GET /v1/sites/{siteId}/networks/{networkId}/references` | Get Network References |

## `unifi_switching`

Switching read-only views (LAGs, MC-LAG domains, switch stacks)

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list_lags` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/switching/lags` | List LAGs |
| `get_lag` (lagId, siteId) | Read | `GET /v1/sites/{siteId}/switching/lags/{lagId}` | Get LAG Details |
| `list_mc_lag_domains` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/switching/mc-lag-domains` | List MC-LAG Domains |
| `get_mc_lag_domain` (mcLagDomainId, siteId) | Read | `GET /v1/sites/{siteId}/switching/mc-lag-domains/{mcLagDomainId}` | Get MC-LAG Domain |
| `list_switch_stacks` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/switching/switch-stacks` | List Switch Stacks |
| `get_switch_stack` (switchStackId, siteId) | Read | `GET /v1/sites/{siteId}/switching/switch-stacks/{switchStackId}` | Get Switch Stack |

## `unifi_traffic_matching_lists`

Traffic matching lists

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/traffic-matching-lists` | List Traffic Matching Lists |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/traffic-matching-lists` | Create Traffic Matching List |
| `delete` (trafficMatchingListId, siteId) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}` | Delete Traffic Matching List |
| `get` (trafficMatchingListId, siteId) | Read | `GET /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}` | Get Traffic Matching List |
| `update` (trafficMatchingListId, siteId, body) | Update | `PUT /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}` | Update Traffic Matching List |

## `unifi_wifi_broadcasts`

WiFi broadcasts (SSIDs) configuration

| Operation | Class | API call | Summary |
|---|---|---|---|
| `list` (siteId, offset?, limit?, filter?) | Read | `GET /v1/sites/{siteId}/wifi/broadcasts` | List Wifi Broadcasts |
| `create` (siteId, body) | Create | `POST /v1/sites/{siteId}/wifi/broadcasts` | Create Wifi Broadcast |
| `delete` (wifiBroadcastId, siteId, force?) | Destructive ⚠️ | `DELETE /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}` | Delete Wifi Broadcast |
| `get` (wifiBroadcastId, siteId) | Read | `GET /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}` | Get Wifi Broadcast Details |
| `update` (wifiBroadcastId, siteId, body) | Update | `PUT /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}` | Update Wifi Broadcast |

## `unifi_spec`

Vendor API contract lookup (Read). Input: `{ "operation": "<tool>.<operation>" }`. Returns the operation's method, path, class, parameters, request-body schema, and response schema, dereferenced from the committed OpenAPI contract.

## `unifi_consoles`

Console discovery for cloud mode (Read, ADR-002). `{ "operation": "list" }` returns every console visible to the API key via Site Manager `GET /v1/hosts` — pass a returned `id` as `consoleId` to any other tool. `refresh: true` bypasses the per-process cache.

## Cloud mode and `consoleId`

Every tool accepts an optional `consoleId` (cloud mode only; ignored in direct mode). With no `consoleId` in cloud mode: one visible console is used automatically; several visible consoles return the list to choose from.
