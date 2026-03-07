# vSphere 8.x REST API — Available VM Fields Research

**Purpose:** Comprehensive field inventory for vSphere 8.x `/api/` endpoints used by VsphereApiClient.java.
**Sources:** VMware vSphere Automation SDK samples (Python/Java), vSphere 8.0 SDK type definitions, live API behavior documented in code comments.
**Legend:**
- `[HAVE]` — already collected and stored in the `vsphere` table
- `[ADD]` — recommended addition; high inventory value
- `[SKIP]` — available but low value or not relevant to inventory use case
- `[TOOLS]` — requires VMware Tools to be running in the guest
- `[COMPUTED]` — derived/computed from raw API data, not a direct field

---

## 1. GET /api/vcenter/vm/{vm} — VM Detail

This is the primary detail endpoint. All sub-objects are returned in a single response body. The response is a JSON object (not wrapped in `value:`), reflecting the `/api/` path convention in vSphere 8.x.

### 1.1 cpu object

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `cpu.count` | integer | Total number of virtual CPUs (sockets × cores_per_socket) | `[HAVE]` → `cpu_count` |
| `cpu.cores_per_socket` | integer | Number of cores per virtual socket | `[HAVE]` → `cpu_cores` |
| `cpu.hot_add_enabled` | boolean | Whether vCPUs can be added while VM is powered on | `[ADD]` → `cpu_hot_add_enabled` |
| `cpu.hot_remove_enabled` | boolean | Whether vCPUs can be removed while VM is powered on | `[SKIP]` — rarely queried |

**Notes:**
- `cpu.count` is the total vCPU count (what vSphere shows as "CPUs").
- The number of sockets = `count / cores_per_socket`. Neither sockets count nor a dedicated "cpu_sockets" field exists in the API; it must be derived.
- `hot_add_enabled` is an indicator of the VM's configuration flexibility — useful for capacity-planning dashboards.

### 1.2 memory object

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `memory.size_MiB` | integer | Allocated RAM in mebibytes (MiB) | `[HAVE]` → `memory_mb` (and `memory_gb`) |
| `memory.hot_add_enabled` | boolean | Whether memory can be added while VM is powered on | `[ADD]` → `memory_hot_add_enabled` |
| `memory.hot_add_limit_MiB` | integer | Maximum memory if hot-add is enabled (MiB); only present when `hot_add_enabled=true` | `[SKIP]` — niche use |
| `memory.hot_add_increment_size_MiB` | integer | Granularity of hot-add increments (MiB); only present when `hot_add_enabled=true` | `[SKIP]` — niche use |

**Notes:**
- The API uses `size_MiB` (mebibytes). The current code already converts MiB → GB correctly (`memoryMb / 1024`).
- `hot_add_limit_MiB` is only populated when `hot_add_enabled` is `true` — must be treated as optional.

### 1.3 disks map

The `disks` field is a **JSON object (map)** keyed by disk ID (e.g., `"2000"`, `"2001"`). Each value is a disk info object.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `disks.<key>.label` | string | User-visible label (e.g., `"Hard disk 1"`) | `[ADD]` — useful for per-disk UI |
| `disks.<key>.type` | enum | Host bus adapter type: `SCSI`, `SATA`, `IDE`, `NVME` | `[ADD]` → `disk_controller_type` or per-disk detail |
| `disks.<key>.capacity` | long | Disk size in bytes | `[HAVE]` (summed into `disk_gb`) |
| `disks.<key>.backing.type` | enum | Backing type: `VMDK_FILE` | `[SKIP]` — always VMDK_FILE for persistent disks |
| `disks.<key>.backing.vmdk_file` | string | Datastore path, e.g. `"[DatastoreName] folder/disk.vmdk"` | `[HAVE]` (parsed to extract `datastore`) |
| `disks.<key>.scsi.bus` | integer | SCSI bus number (0–3); only present for SCSI disks | `[SKIP]` |
| `disks.<key>.scsi.unit` | integer | SCSI unit number (0–15, excluding 7); only present for SCSI disks | `[SKIP]` |
| `disks.<key>.sata.bus` | integer | SATA bus number; only present for SATA disks | `[SKIP]` |
| `disks.<key>.sata.unit` | integer | SATA unit number (0–29); only present for SATA disks | `[SKIP]` |
| `disks.<key>.ide.master` | boolean | True=master, false=slave; only present for IDE disks | `[SKIP]` |
| `disks.<key>.ide.primary` | boolean | True=primary channel; only present for IDE disks | `[SKIP]` |

**Notes:**
- `capacity` is in bytes. The current code sums all disk capacities and converts to GB correctly.
- `label` is the most human-readable identifier per disk (e.g., "Hard disk 1", "Hard disk 2").
- The disk count (number of keys in the map) is derivable and `[ADD]` worthy as `disk_count`.
- `backing.vmdk_file` follows the pattern `[DatastoreName] vm-name/vm-name.vmdk`. The current code extracts the datastore name by parsing the text between `[` and `]`.

### 1.4 nics map

The `nics` field is a **JSON object (map)** keyed by NIC ID (e.g., `"4000"`, `"4001"`).

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `nics.<key>.label` | string | User-visible label (e.g., `"Network adapter 1"`) | `[ADD]` — useful for per-NIC UI |
| `nics.<key>.type` | enum | Adapter type: `E1000`, `E1000E`, `VMXNET3`, `VMXNET3VRDMA`, `VMXNET2`, `PCNET32` | `[ADD]` → `nic_type` or per-NIC detail |
| `nics.<key>.mac_address` | string | Current MAC address (may be generated or manual) | `[ADD]` — very useful for network reconciliation |
| `nics.<key>.mac_type` | enum | How MAC is assigned: `MANUAL`, `GENERATED`, `ASSIGNED` | `[SKIP]` — niche |
| `nics.<key>.backing.type` | enum | Network backing: `STANDARD_PORTGROUP`, `DISTRIBUTED_PORTGROUP`, `OPAQUE_NETWORK` | `[SKIP]` |
| `nics.<key>.backing.network` | string | MoRef ID of the connected network/portgroup | `[ADD]` — resolves to network name |
| `nics.<key>.backing.network_name` | string | Display name of the connected network (available in list endpoint summary) | `[ADD]` → `network_name` |
| `nics.<key>.state` | enum | Connection state: `CONNECTED`, `DISCONNECTED`, `NOT_CONNECTED` | `[ADD]` → useful for troubleshooting |
| `nics.<key>.start_connected` | boolean | Whether NIC connects at power-on | `[SKIP]` |
| `nics.<key>.allow_guest_control` | boolean | Whether guest OS can disconnect NIC | `[SKIP]` |
| `nics.<key>.wake_on_lan_enabled` | boolean | WoL capability | `[SKIP]` |
| `nics.<key>.upt_compatibility_enabled` | boolean | Uniform Passthrough enabled (VMXNET3 only) | `[SKIP]` |

**Notes:**
- `mac_address` is extremely useful for correlating VMs with network switches, IPAM, and DHCP records.
- `nics.<key>.backing.network_name` appears in the **GET /api/vcenter/vm** list summary but may not be present in the detail endpoint — cross-reference with GET /api/vcenter/network to resolve network MoRef IDs to names.
- The NIC count (number of keys in the map) is derivable as `nic_count`.

### 1.5 boot object

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `boot.type` | enum | Firmware type: `BIOS`, `EFI` | `[ADD]` → `firmware_type` |
| `boot.efi_legacy_boot` | boolean | Use legacy BIOS compatibility with EFI; only when `type=EFI` | `[SKIP]` |
| `boot.network_protocol` | enum | PXE protocol: `IPV4`, `IPV6`; only when `type=EFI` | `[SKIP]` |
| `boot.delay` | long | Boot delay in milliseconds before firmware starts | `[SKIP]` |
| `boot.retry` | boolean | Auto-retry on boot failure | `[SKIP]` |
| `boot.retry_delay` | long | Delay between retries in milliseconds | `[SKIP]` |
| `boot.enter_setup_mode` | boolean | Enter firmware setup (BIOS/EFI) on next boot | `[SKIP]` |

**Notes:**
- `boot.type` (`BIOS` vs `EFI`) is a meaningful inventory field — EFI/Secure Boot is required for Windows 11 and modern Linux security profiles.
- The boot device order is managed via a separate endpoint: `GET /api/vcenter/vm/{vm}/hardware/boot/device` which returns an ordered list of `{ type: DISK|CDROM|ETHERNET|FLOPPY, disks: [...], nic: ... }`. Not typically needed for inventory.

### 1.6 hardware object

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `hardware.version` | enum | VM hardware version: `VMX_08`, `VMX_09`, ..., `VMX_21` (vSphere 8.0 = VMX_21) | `[ADD]` → `hardware_version` |
| `hardware.upgrade_policy` | enum | Auto-upgrade policy: `NEVER`, `AFTER_CLEAN_SHUTDOWN`, `ALWAYS` | `[SKIP]` |
| `hardware.upgrade_status` | enum | Pending upgrade state: `NONE`, `PENDING`, `SUCCESS`, `FAILED` | `[SKIP]` |
| `hardware.upgrade_version` | enum | Target hardware version for upgrade; only when `upgrade_status=PENDING` | `[SKIP]` |

**Notes:**
- `hardware.version` directly maps to the VM compatibility setting in vSphere UI (e.g., "ESXi 8.0 U2 and later" = VMX_21). This is a key inventory field for upgrade planning.
- This is also available via the dedicated endpoint `GET /api/vcenter/vm/{vm}/hardware` which returns the same three fields.

### 1.7 placement object

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `placement.cluster` | string | MoRef ID of the cluster the VM runs on | `[HAVE]` (partially — resolved to name via `buildIdToNameMap`) |
| `placement.datacenter` | string | MoRef ID of the datacenter | `[HAVE]` → resolved to `datacenter` name |
| `placement.datastore` | string | MoRef ID of the primary datastore | `[HAVE]` (datastore name extracted from disk VMDK path instead) |
| `placement.folder` | string | MoRef ID of the VM folder | `[ADD]` → resolve to folder name via `GET /api/vcenter/folder` |
| `placement.host` | string | MoRef ID of the ESXi host the VM is running on | `[ADD]` → resolve to `host_name` via `GET /api/vcenter/host` |
| `placement.resource_pool` | string | MoRef ID of the resource pool | `[SKIP]` — rarely needed for inventory |

**Notes:**
- `placement.cluster` MoRef is already partially handled. A `buildIdToNameMap` pre-fetch for clusters would give the cluster name — this is already a column in the `vsphere` table schema (`cluster`) but the current code does not populate it.
- `placement.host` resolves to the ESXi host name — very useful for host-level capacity planning and maintenance windows.
- `placement.folder` gives the organizational folder path — relevant for environment classification in large vCenter inventories.

### 1.8 Top-level fields

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `guest_OS` | string | Guest OS identifier from vSphere guest catalog (e.g., `RHEL_9_64`, `WINDOWS_2022_SERVER_FULL_64`) | `[HAVE]` → `guest_os` |
| `name` | string | VM display name | `[HAVE]` → `vm_name` (from list endpoint) |
| `power_state` | enum | `POWERED_ON`, `POWERED_OFF`, `SUSPENDED` | `[HAVE]` → `power_state` |
| `instant_clone_frozen` | boolean | True if this is a frozen instant clone parent | `[SKIP]` |

---

## 2. GET /api/vcenter/vm/{vm}/guest/identity

**Requires:** VMware Tools running in the guest (`[TOOLS]`).
Returns `404` or an error response when Tools are not running — must be handled gracefully.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `host_name` | string | Hostname as reported by the guest OS | `[HAVE]` — used to derive `hostname` and `fqdn` |
| `ip_address` | string | Primary IP address as reported by VMware Tools (single value) | `[SKIP]` — superseded by `/guest/networking/interfaces` which gives all IPs |
| `full_name` | string | Full OS name as reported by the guest (e.g., `"Red Hat Enterprise Linux 9 (64-bit)"`) | `[ADD]` → `guest_os_full_name` — more descriptive than `guest_OS` enum |
| `name` | string | OS family identifier (e.g., `"rhel9_64Guest"`) | `[SKIP]` — duplicate of `guest_OS` from main detail |
| `family` | string | OS family category: `LINUX`, `WINDOWS`, `OTHER` | `[ADD]` → `guest_os_family` — enables OS-family-level filtering |

**Notes:**
- `host_name` is critical for the `hostname` PK. The current code correctly strips the FQDN to get the short hostname.
- `full_name` is the human-readable OS string shown in vSphere UI (e.g., "Red Hat Enterprise Linux 9.2") — far more useful for reporting than the internal `guest_OS` enum.
- `family` allows simple OS family grouping (Linux vs Windows) without string parsing.
- This endpoint returns `400` or `503` if Tools are installed but not running — `404` is returned if Tools are not installed. Handle all non-2xx responses as "tools unavailable".

---

## 3. GET /api/vcenter/vm/{vm}/guest/networking

**Requires:** VMware Tools running (`[TOOLS]`).

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `dns_values.dns_servers` | string[] | List of DNS server IP addresses configured in the guest OS | `[ADD]` → `dns_servers` (comma-separated) |
| `dns_values.domain_name` | string | Primary DNS domain (e.g., `"corp.example.com"`) | `[ADD]` → `dns_domain` |
| `dns_values.search_domains` | string[] | DNS search domain list | `[SKIP]` — lower priority |
| `dns_values.hostname` | string | Hostname from DNS config (may differ from `guest/identity` hostname) | `[SKIP]` — use identity endpoint instead |
| `route_config.ip_route` | object[] | List of routing table entries | `[SKIP]` — too detailed for inventory |

**Notes:**
- `dns_values.domain_name` is highly useful for verifying that VMs are joined to the correct DNS domain, especially in multi-domain environments.
- `dns_values.dns_servers` helps identify misconfigured VMs pointing to wrong DNS servers.
- The routing table from `route_config` contains gateway and prefix information but is too verbose for a flat inventory schema.

---

## 4. GET /api/vcenter/vm/{vm}/guest/networking/interfaces

**Requires:** VMware Tools running (`[TOOLS]`).
Returns an array of network interface objects.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `[*].nic` | string | NIC identifier (matches key in `nics` map from detail endpoint) | `[SKIP]` — join key only |
| `[*].mac_address` | string | MAC address of this interface | `[ADD]` — complement to NIC mac from hardware endpoint |
| `[*].ip.ip_addresses[*].ip_address` | string | Individual IP address (IPv4 or IPv6) | `[HAVE]` — used to populate `ipv4_address`, `ipv6_address` |
| `[*].ip.ip_addresses[*].prefix_length` | integer | CIDR prefix length (e.g., `24` for /24) | `[ADD]` → store as CIDR notation alongside IP |
| `[*].ip.ip_addresses[*].state` | enum | IP address state: `PREFERRED`, `DEPRECATED`, `INVALID`, `INACCESSIBLE`, `UNKNOWN`, `TENTATIVE`, `DUPLICATE` | `[ADD]` — filter to `PREFERRED` only |
| `[*].ip.dhcp_enabled` | boolean | Whether DHCP is configured on this interface | `[ADD]` → `dhcp_enabled` |
| `[*].dns_values.dns_servers` | string[] | Per-interface DNS servers | `[SKIP]` — prefer network-level DNS |
| `[*].dns_values.domain_name` | string | Per-interface domain name | `[SKIP]` — prefer network-level DNS |
| `[*].wins_servers` | string[] | WINS server list (Windows only) | `[SKIP]` |

**Notes:**
- The current code already iterates this array and collects IPv4/IPv6 addresses separated by comma.
- `ip.ip_addresses[*].state` should be used to filter for `PREFERRED` addresses only. The current code correctly excludes `fe80:` link-local IPv6 but does not filter by state — adding a `PREFERRED` state filter would improve IP data quality.
- `dhcp_enabled` is a useful inventory field: DHCP-enabled VMs are harder to track by IP and may change addresses.
- `prefix_length` allows reconstructing the full CIDR block (e.g., `10.1.2.100/24`).

---

## 5. GET /api/vcenter/vm/{vm}/tools

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `run_state` | enum | `NOT_INSTALLED`, `NOT_RUNNING`, `RUNNING` | `[HAVE]` — used to derive `tools_status` |
| `version_status` | enum | `GUEST_MANAGED`, `UNMANAGED`, `NOT_INSTALLED`, `NOT_RUNNING`, `CURRENT`, `UPGRADE_AVAILABLE`, `TOO_NEW_FOR_HOST`, `TOO_OLD`, `BLACKLISTED_NEW`, `BLACKLISTED_OLD`, `UNKNOWN` | `[HAVE]` — used to derive `tools_status` (`UP_TO_DATE` maps to `toolsOk`) |
| `version` | string | VMware Tools version string (e.g., `"12352"`) | `[ADD]` → `tools_version` |
| `upgrade_policy` | enum | Auto-upgrade policy: `MANUAL`, `UPGRADE_AT_POWER_CYCLE` | `[SKIP]` |
| `install_attempt_count` | integer | Number of failed install attempts; only when `run_state=NOT_INSTALLED` | `[SKIP]` |
| `error` | string | Error detail when install/upgrade failed | `[SKIP]` |

**Notes:**
- `version_status` has a richer set of values than the four the current code maps to. Notably:
  - `UPGRADE_AVAILABLE` → current code maps this to `toolsOld` (correct)
  - `GUEST_MANAGED` → Tools installed but not by VMware (open-vm-tools); maps to `toolsOk` is reasonable
  - `TOO_NEW_FOR_HOST` → Tools newer than host supports; maps to `toolsOk` is acceptable
  - `TOO_OLD` → should map to `toolsOld`
  - `BLACKLISTED_NEW` / `BLACKLISTED_OLD` → known-vulnerable version; could map to `toolsOld`
- `version` is a numeric string representing the internal VMware Tools build number. Human-readable version strings (e.g., "12.3.0") require a lookup table or the `full_name` from guest identity. Still useful for tracking Tools update progress.

---

## 6. GET /api/vcenter/vm/{vm}/hardware

Returns the same `hardware` object that is embedded in the main VM detail response. Provided as a standalone endpoint for targeted queries.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `version` | enum | VM hardware version (`VMX_08` through `VMX_21`) | `[ADD]` → `hardware_version` (same as §1.6) |
| `upgrade_policy` | enum | `NEVER`, `AFTER_CLEAN_SHUTDOWN`, `ALWAYS` | `[SKIP]` |
| `upgrade_status` | enum | `NONE`, `PENDING`, `SUCCESS`, `FAILED` | `[SKIP]` |
| `upgrade_version` | enum | Target version when status=PENDING | `[SKIP]` |

**Notes:**
- No need to call this endpoint separately since `hardware` is already included in `GET /api/vcenter/vm/{vm}`. Avoid the extra HTTP call.

---

## 7. GET /api/vcenter/vm/{vm}/guest/local-filesystem

**Requires:** VMware Tools running (`[TOOLS]`).
Returns a map of filesystem mount points to capacity info.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `<mountpoint>.capacity` | long | Total filesystem capacity in bytes | `[ADD]` — per-partition detail |
| `<mountpoint>.free_space` | long | Free space in bytes | `[ADD]` — disk utilization |
| `<mountpoint>.filesystem` | string | Filesystem type (e.g., `"ext4"`, `"NTFS"`) | `[ADD]` — OS filesystem type |
| `<mountpoint>.mappings` | object[] | Disk-to-filesystem mappings (virtual disk key → partition) | `[SKIP]` — too detailed |

**Notes:**
- The map keys are OS-level mount points: `/`, `/boot`, `/home` on Linux; `C:\`, `D:\` on Windows.
- This is different from the vSphere disk map — it reflects the guest OS view (partitions and utilization), not the virtual disk provisioning.
- `free_space` enables actual disk utilization tracking vs. the provisioned `disk_gb` from virtual disks.
- Storing this data requires a new table or JSON column since it is a variable-length per-VM map.

---

## 8. GET /api/vcenter/vm (list endpoint)

The list endpoint (`GET /api/vcenter/vm`) returns summary objects with fewer fields than the detail endpoint. It is used for the initial VM enumeration loop.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `vm` | string | VM MoRef ID (e.g., `"vm-42"`) | `[HAVE]` → `vm_id` |
| `name` | string | VM display name | `[HAVE]` → `vm_name` |
| `power_state` | enum | `POWERED_ON`, `POWERED_OFF`, `SUSPENDED` | `[HAVE]` → `power_state` |
| `cpu_count` | integer | Total vCPU count (same as `cpu.count` in detail) | `[HAVE]` (from detail call) |
| `memory_size_MiB` | integer | RAM in MiB (same as `memory.size_MiB` in detail) | `[HAVE]` (from detail call) |

**Notes:**
- `cpu_count` and `memory_size_MiB` are available in the list response — they can avoid a detail call for VMs where only basic hardware specs are needed. The current code already makes per-VM detail calls for all VMs, so this is a potential optimization (not a missing field).
- Filter parameters available on this endpoint: `filter.vms` (by ID), `filter.names`, `filter.clusters`, `filter.datacenters`, `filter.folders`, `filter.hosts`, `filter.resource_pools` — useful for scoping sync to specific datacenters or clusters.

---

## 9. Other Useful Per-VM Endpoints

### 9.1 GET /api/vcenter/vm/{vm}/hardware/boot/device

Returns the boot device order as an array.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `[*].type` | enum | `CDROM`, `DISK`, `ETHERNET`, `FLOPPY` | `[SKIP]` — not an inventory field |
| `[*].disks` | string[] | Disk IDs included in this boot entry (for `DISK` type) | `[SKIP]` |
| `[*].nic` | string | NIC ID for PXE boot entry (for `ETHERNET` type) | `[SKIP]` |

### 9.2 GET /api/cis/tagging/tag-association?action=list-attached-tags-on-object

Tags are applied to VMs via the CIS Tagging API, not the vcenter/vm path.

**Request body:**
```json
{
  "object_id": {
    "id": "vm-42",
    "type": "VirtualMachine"
  }
}
```

| Response Field | Type | Description | Status |
|---|---|---|---|
| Tag ID list | string[] | Array of tag IDs attached to the VM | Used to call `GET /api/cis/tagging/tag/{id}` |

**Tag detail (`GET /api/cis/tagging/tag/{tag_id}`):**

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `id` | string | Tag UUID | `[SKIP]` |
| `name` | string | Tag name (e.g., `"Production"`, `"Tier-1"`) | `[ADD]` → `tags` (JSON array) |
| `description` | string | Tag description | `[SKIP]` |
| `category_id` | string | ID of the tag's category | Used to call Category endpoint |

**Category detail (`GET /api/cis/tagging/category/{category_id}`):**

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `name` | string | Category name (e.g., `"Environment"`, `"Tier"`) | `[ADD]` → enables `category:tag` key-value structure |
| `cardinality` | enum | `SINGLE` (one tag per VM) or `MULTIPLE` | `[SKIP]` |
| `description` | string | Category description | `[SKIP]` |

**Notes:**
- Tags require 3 API calls per VM (list attached tags → resolve tag names → resolve category names) plus pre-fetch caching of the tag and category name maps.
- Tags are the primary mechanism for encoding `environment`, `owner`, `tier`, and `application` metadata in vSphere. They are the recommended replacement for custom attributes.
- Storing tags requires either a dedicated `vsphere_tags` table or a JSON TEXT column on the `vsphere` table.
- The tagging API uses `POST /api/cis/tagging/tag-association?action=list-attached-tags-on-object` with a body (not a GET with query params).

### 9.3 GET /api/vcenter/vm/{vm}/storage/policy

Returns storage policy compliance per disk.

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `vm_home.policy` | string | Storage policy UUID for VM home directory | `[SKIP]` |
| `vm_home.compliance.status` | enum | `COMPLIANT`, `NON_COMPLIANT`, `UNKNOWN_COMPLIANCE`, `NOT_APPLICABLE` | `[SKIP]` |
| `disks.<key>.policy` | string | Storage policy UUID per virtual disk | `[SKIP]` |
| `disks.<key>.compliance.status` | enum | Compliance status per disk | `[SKIP]` |

**Notes:**
- Storage policy is relevant for vSAN environments. Low value for general inventory unless storage compliance is a specific requirement.

### 9.4 GET /api/vcenter/vm/{vm}/guest/power

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `state` | enum | Guest power state: `RUNNING`, `SHUTTING_DOWN`, `RESETTING`, `STANDBY`, `NOT_RUNNING`, `UNKNOWN` | `[SKIP]` — `power_state` from main endpoint is sufficient |

### 9.5 Snapshots (via vSphere SOAP / Managed Object Browser)

The vSphere REST API (`/api/`) does **not** have a snapshot list endpoint for per-VM snapshots as of vSphere 8.0. Snapshot enumeration requires either:
- The older `/rest/` API path (deprecated in 8.0)
- The SOAP-based VIM API (`RetrievePropertiesEx` on `VirtualMachineSnapshotTree`)
- The `govmomi` library's snapshot traversal via SOAP

If snapshot data is needed, it cannot be collected via the `/api/` REST endpoint that the current client uses.

### 9.6 GET /api/vcenter/network (for network name resolution)

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `network` | string | Network MoRef ID | Used as lookup key |
| `name` | string | Network display name (portgroup name) | `[ADD]` — resolves NIC backing network IDs |
| `type` | enum | `STANDARD_PORTGROUP`, `DISTRIBUTED_PORTGROUP`, `OPAQUE_NETWORK` | `[SKIP]` |

### 9.7 GET /api/vcenter/host (for host name resolution)

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `host` | string | Host MoRef ID | Used as lookup key |
| `name` | string | ESXi host FQDN (e.g., `"esxi01.corp.example.com"`) | `[ADD]` → `host_name` via name map |
| `power_state` | enum | `POWERED_ON`, `POWERED_OFF`, `STANDBY` | `[SKIP]` |
| `connection_state` | enum | `CONNECTED`, `DISCONNECTED`, `NOT_RESPONDING` | `[SKIP]` |

### 9.8 GET /api/vcenter/cluster (for cluster name resolution)

| JSON Key | Type | Description | Status |
|---|---|---|---|
| `cluster` | string | Cluster MoRef ID | Used as lookup key |
| `name` | string | Cluster display name | `[ADD]` → `cluster` column already in schema, not yet populated |
| `ha_enabled` | boolean | vSphere HA enabled on cluster | `[SKIP]` |
| `drs_enabled` | boolean | vSphere DRS enabled on cluster | `[SKIP]` |

---

## 10. Summary: Recommended Fields to Add

The following fields have been evaluated as the highest inventory value additions. They are grouped by the schema change they require.

### Tier 1: Add to `vsphere` table — single Flyway migration

| Proposed Column | Source Endpoint | JSON Path | Notes |
|---|---|---|---|
| `cluster` | already in schema | `placement.cluster` → name lookup | Column exists but not populated; fix in code |
| `host_name` | GET /api/vcenter/vm/{vm} | `placement.host` → host name lookup | Needs `buildIdToNameMap` for `/api/vcenter/host` |
| `firmware_type` | GET /api/vcenter/vm/{vm} | `boot.type` | Values: `BIOS`, `EFI` |
| `hardware_version` | GET /api/vcenter/vm/{vm} | `hardware.version` | Values: `VMX_08` through `VMX_21` |
| `tools_version` | GET /api/vcenter/vm/{vm}/tools | `version` | Numeric string, e.g. `"12352"` |
| `cpu_hot_add_enabled` | GET /api/vcenter/vm/{vm} | `cpu.hot_add_enabled` | Boolean |
| `memory_hot_add_enabled` | GET /api/vcenter/vm/{vm} | `memory.hot_add_enabled` | Boolean |
| `disk_count` | GET /api/vcenter/vm/{vm} | `count(disks)` | Computed from map size |
| `nic_count` | GET /api/vcenter/vm/{vm} | `count(nics)` | Computed from map size |
| `guest_os_full_name` | GET /api/vcenter/vm/{vm}/guest/identity | `full_name` | Requires Tools |
| `guest_os_family` | GET /api/vcenter/vm/{vm}/guest/identity | `family` | `LINUX`, `WINDOWS`, `OTHER`; requires Tools |
| `dns_domain` | GET /api/vcenter/vm/{vm}/guest/networking | `dns_values.domain_name` | Requires Tools |
| `dns_servers` | GET /api/vcenter/vm/{vm}/guest/networking | `dns_values.dns_servers` | Comma-separated; requires Tools |
| `dhcp_enabled` | GET /api/vcenter/vm/{vm}/guest/networking/interfaces | `[*].ip.dhcp_enabled` | True if any interface uses DHCP |

### Tier 2: Add to `vsphere` table — requires careful implementation

| Proposed Column | Source | Notes |
|---|---|---|
| `mac_addresses` | GET /api/vcenter/vm/{vm} nics map | Comma-separated list from `nics.<key>.mac_address`; no Tools required |
| `network_names` | GET /api/vcenter/vm/{vm} + network lookup | Requires pre-fetching network name map |
| `tags` | CIS Tagging API | JSON TEXT column; requires 3-call chain with caching |

### Tier 3: Requires new table (out of scope for vsphere table)

| Data | Reason for Separate Table |
|---|---|
| Per-disk details (label, type, capacity per disk) | Variable number of disks per VM |
| Per-NIC details (label, type, mac, network, state) | Variable number of NICs per VM |
| Per-filesystem details (mount, capacity, free, type) | Variable number of filesystems per VM |

---

## 11. API Behavior Notes for vSphere 8.x

### Authentication
- Session endpoint: `POST /api/session` with Basic Auth
- Response: a plain JSON-quoted string token (e.g., `"abc123def456"`) — must call `.asText()` on the parsed JSON node
- Header for subsequent requests: `vmware-api-session-id: <token>`
- Session expiry: tokens expire after 30 minutes of inactivity by default; handle `401` with re-auth and retry

### Path prefix
- vSphere 8.x uses `/api/` (not `/rest/` which is the deprecated 7.x path)
- The `/rest/` path returns responses wrapped in `{ "value": ... }` — the `/api/` path does not

### Error handling patterns
- `404` from guest endpoints — VM powered off, or Tools not installed
- `400` / `503` from guest endpoints — Tools installed but not running
- `403` — insufficient vCenter privileges for the credential
- `503` — vCenter service temporarily unavailable (e.g., during vMotion of the management VM)

### Disk capacity units
- `disks.<key>.capacity` is in **bytes** (not KB, MB, or GB)
- Convert: `bytes / 1_073_741_824` = GB

### NIC MAC addresses
- `mac_address` from the hardware endpoint (`/api/vcenter/vm/{vm}` nics map) is always present regardless of Tools status
- MAC from `/api/vcenter/vm/{vm}/guest/networking/interfaces` requires Tools and reflects the guest OS view

### Power state values (vSphere 8.x `/api/` path)
- List endpoint: `POWERED_ON`, `POWERED_OFF`, `SUSPENDED` (uppercase with underscores)
- These differ from the `/rest/` path which used `poweredOn`, `poweredOff`, `suspended`
- The current `normalizePowerState()` method correctly handles this

### guest_OS identifier format
- The `guest_OS` field uses VMware's internal guest ID format (e.g., `RHEL_9_64`, `WINDOWS_2022_SERVER_FULL_64`)
- The human-readable OS name comes from `guest/identity.full_name` (requires Tools)
- These are two different representations of the same OS

### Pagination
- `GET /api/vcenter/vm` does not paginate by default but accepts `filter.*` query parameters
- There is no cursor-based pagination — if you have more than ~1000 VMs, use `filter.datacenters` to shard the requests per datacenter
- The cluster, datacenter, and host list endpoints also return flat arrays without pagination

---

## 12. Endpoints Not Available in vSphere 8.x REST API

The following capabilities exist in the SOAP/VIM API but are **not available** via the `/api/` REST path:

- Snapshot enumeration and snapshot tree traversal
- VM event history (e.g., last power-on time, migration history)
- Performance counters (CPU %, memory balloon, disk IOPS) — use the vStats API (`/api/vcenter/vstats/`) for basic metrics
- Custom attributes (non-tag metadata) — still SOAP only
- vSphere alarm state per VM — SOAP only
- VM console access (VMRC ticket generation) — available via `/api/vcenter/vm/{vm}/console/tickets`
- Clone, migrate, reconfigure — available via REST but not relevant for read-only inventory sync
