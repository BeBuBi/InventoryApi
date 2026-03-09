# Data Model
## Server Inventory System

**Version:** 1.2
**Last Updated:** 2026-03-07
**Database:** SQLite 3.x

---

## Table of Contents

1. [Overview](#1-overview)
2. [Entity Diagram](#2-entity-diagram)
3. [Tables](#3-tables)
   - [inventory](#31-inventory)
   - [vsphere](#32-vsphere)
   - [newrelic](#33-newrelic)
   - [cmdb](#34-cmdb)
   - [credentials](#35-credentials)
   - [sync_schedule](#36-sync_schedule)
4. [Design Decisions](#4-design-decisions)
5. [SQLite Type Conventions](#5-sqlite-type-conventions)

---

## 1. Overview

The data model consists of five physical tables and one read-only SQL VIEW, all stored in a single SQLite database file (`data/inventory.db`). All tables are independent — there are no foreign key constraints between them. The `hostname` field serves as the natural common key across `vsphere`, `newrelic`, and `cmdb`; the `inventory` VIEW aggregates all three by hostname automatically.

| Table / View | Purpose |
|--------------|---------|
| `inventory` | Read-only SQL VIEW — aggregated hostname index across `vsphere`, `newrelic`, and `cmdb` |
| `vsphere` | VMware vSphere VM metadata, synced from vCenter API |
| `newrelic` | New Relic monitoring data, synced from NerdGraph API |
| `cmdb` | CMDB configuration item data, synced from ServiceNow |
| `credentials` | Encrypted connection credentials for vSphere, New Relic, and CMDB accounts |
| `sync_schedule` | User-configured sync schedule (day + time) per service |

---

## 2. Entity Diagram

```
┌─────────────────────────┐     ┌─────────────────────────┐
│    inventory (VIEW)     │     │          vsphere         │
│─────────────────────────│     │─────────────────────────│
│ hostname                │     │ hostname (PK)            │
│ vsphere_ipv4            │     │ vm_name                  │
│ vsphere_ipv6            │     │ cpu_count                │
│ vm_name                 │     │ cpu_cores                │
│ cpu_count, cpu_cores    │     │ memory_mb                │
│ memory_mb, memory_gb    │     │ memory_gb                │
│ power_state, guest_os   │     │ power_state              │
│ tools_status            │     │ guest_os                 │
│ vsphere_last_synced     │     │ tools_status             │
│ full_hostname           │     │ ipv4_address             │
│ nr_ipv4, nr_ipv6        │     │ ipv6_address             │
│ processor_count         │     │ source_url               │
│ core_count              │     │ last_synced_at           │
│ system_memory_bytes     │     │ created_at               │
│ linux_distribution      │     │ updated_at               │
│ service, nr_environment │     └─────────────────────────┘
│ team, nr_location       │
│ account_id              │  Derived from vsphere, newrelic,
│ sys_id, os, os_version  │  and cmdb via UNION + LEFT JOIN
│ cmdb_ip_address         │  — never written to directly
│ cmdb_location           │
│ department              │
│ cmdb_environment        │
│ operational_status      │
│ classification          │
│ cmdb_last_synced        │
│ sources                 │
└─────────────────────────┘

┌─────────────────────────┐     ┌──────────────────────-───┐
│         newrelic        │     │        credentials       │
│─────────────────────────│     │─────────────────────-────│
│ hostname (PK)           │     │ id (PK)                  │
│ fullHostname            │     │ service                  │
│ ipv4Address             │     │ name                     │
│ ipV6Address             │     │ config (encrypted)       │
│ coreCount               │     │ enabled                  │
│ processorCount          │     │ created_at               │
│ systemMemoryBytes       │     │ updated_at               │
│ linuxDistribution       │     └─────────────────────────┘
│ service                 │
│ environment             │
│ team                    |
| location                │
│ account_id              │
│ created_at              │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐     ┌─────────────────────────┐
│          cmdb           │     │       sync_schedule      │
│─────────────────────────│     │─────────────────────────│
│ hostname (PK)           │     │ id (PK)                  │
│ sys_id                  │     │ service                  │
│ os                      │     │ cron_expr                │
│ os_version              │     │ enabled                  │
│ ip_address              │     │ description              │
│ location                │     │ last_run_at              │
│ department              │     │ updated_at               │
│ environment             │     └─────────────────────────┘
│ operational_status      │
│ classification          │
│ last_synced_at          │
│ created_at              │
│ updated_at              │
└─────────────────────────┘
```

---

## 3. Tables

### 3.1 `inventory` (View — Read Only)

A read-only SQL VIEW that aggregates `vsphere`, `newrelic`, and `cmdb` by hostname. Never written to directly. The VIEW is the primary query target for the inventory API and dashboard.

| Column               | Source                     | Description |
|----------------------|----------------------------|-------------|
| hostname             | UNION of all three tables  | Asset hostname — join key |
| vsphere_ipv4         | vsphere.ipv4_address       | VM IPv4 address |
| vsphere_ipv6         | vsphere.ipv6_address       | VM IPv6 address |
| vm_name              | vsphere.vm_name            | VM display name |
| cpu_count            | vsphere.cpu_count          | Number of vCPUs |
| cpu_cores            | vsphere.cpu_cores          | Number of CPU cores |
| memory_mb            | vsphere.memory_mb          | Memory in MB |
| memory_gb            | vsphere.memory_gb          | Memory in GB |
| power_state          | vsphere.power_state        | VM power state |
| guest_os             | vsphere.guest_os           | Guest OS name |
| tools_status         | vsphere.tools_status       | VMware Tools status |
| vsphere_last_synced  | vsphere.last_synced_at     | Last vSphere sync timestamp |
| full_hostname        | newrelic.full_hostname     | FQDN from New Relic |
| nr_ipv4              | newrelic.ipv4_address      | IPv4 from New Relic |
| nr_ipv6              | newrelic.ipv6_address      | IPv6 from New Relic |
| processor_count      | newrelic.processor_count   | CPU count from New Relic |
| core_count           | newrelic.core_count        | Core count from New Relic |
| system_memory_bytes  | newrelic.system_memory_bytes | Memory in bytes from New Relic |
| linux_distribution   | newrelic.linux_distribution | Linux distro |
| service              | newrelic.service           | Service custom attribute |
| nr_environment       | newrelic.environment       | Environment from New Relic |
| team                 | newrelic.team              | Team custom attribute |
| nr_location          | newrelic.location          | Location from New Relic |
| account_id           | newrelic.account_id        | New Relic account ID |
| sys_id               | cmdb.sys_id                | ServiceNow sys_id |
| os                   | cmdb.os                    | OS name from CMDB |
| os_version           | cmdb.os_version            | OS version from CMDB |
| cmdb_ip_address      | cmdb.ip_address            | IP address from CMDB |
| cmdb_location        | cmdb.location              | Location from CMDB |
| department           | cmdb.department            | Department from CMDB |
| cmdb_environment     | cmdb.environment           | Environment from CMDB |
| operational_status   | cmdb.operational_status    | Operational status from CMDB |
| classification       | cmdb.classification        | CI classification from CMDB |
| cmdb_last_synced     | cmdb.last_synced_at        | Last CMDB sync timestamp |
| sources              | computed                   | Comma-separated list: `vsphere`, `newrelic`, `cmdb` |

---

### 3.2 `vsphere`

VMware vSphere VM metadata. Populated by the vSphere sync job. Each record corresponds to one VM in vCenter, identified by `hostname`.

| Column         | Type    | Constraints | Description                                         |
|----------------|---------|-------------|-----------------------------------------------------|
| hostname       | TEXT    | PK          | Asset hostname — primary identifier                 |
| vm_name        | TEXT    | NOT NULL    | VM display name in vSphere                          |
| cpu_count      | INTEGER |             | Number of vCPUs                                     |
| cpu_cores      | INTEGER |             | Number of physical CPU cores                        |
| memory_mb      | INTEGER |             | Allocated memory in MB                              |
| memory_gb      | INTEGER |             | Allocated memory in GB                              |
| power_state    | TEXT    |             | `poweredOn`, `poweredOff`, `suspended`              |
| guest_os       | TEXT    |             | Guest operating system                              |
| tools_status   | TEXT    |             | VMware Tools status                                 |
| ipv4_address   | TEXT    |             | Primary IPv4 address of the VM                      |
| ipv6_address   | TEXT    |             | Primary IPv6 address of the VM                      |
| source_url     | TEXT    |             | vCenter hostname this record was synced from         |
| last_synced_at | TEXT    |             | Last sync timestamp from vSphere API (ISO 8601 UTC) |
| created_at     | TEXT    | NOT NULL    | Record creation time (ISO 8601 UTC)                 |
| updated_at     | TEXT    | NOT NULL    | Last update time (ISO 8601 UTC)                     |

**Allowed values:**

| Column       | Allowed Values                                                        |
|--------------|-----------------------------------------------------------------------|
| power_state  | `poweredOn`, `poweredOff`, `suspended`                                |
| tools_status | `toolsOk`, `toolsOld`, `toolsNotRunning`, `toolsNotInstalled`         |

---

### 3.3 `newrelic`

New Relic infrastructure monitoring data. Populated by the New Relic sync job via `NetworkSample` events. Each record corresponds to one monitored host, identified by `hostname`. Column names match New Relic NetworkSample attribute names.

| Column               | Type    | Constraints | Description                                              |
|----------------------|---------|-------------|----------------------------------------------------------|
| hostname             | TEXT    | PK          | Asset hostname — primary identifier                      |
| full_hostname        | TEXT    |             | FQDN (`fullHostname` in NR)                              |
| ipv4_address         | TEXT    |             | Primary routable IPv4 address (`ipV4Address` in NR)      |
| ipv6_address         | TEXT    |             | Primary routable IPv6 address (`ipV6Address` in NR)      |
| processor_count      | INTEGER |             | Number of CPUs (`processorCount` in NR)                  |
| core_count           | INTEGER |             | Number of CPU cores (`coreCount` in NR)                  |
| system_memory_bytes  | INTEGER |             | Total memory in bytes (`systemMemoryBytes` in NR)        |
| linux_distribution   | TEXT    |             | Linux distro name (`linuxDistribution` in NR)            |
| service              | TEXT    |             | Service name custom attribute                            |
| environment          | TEXT    |             | Environment custom attribute                             |
| team                 | TEXT    |             | Team custom attribute                                    |
| location             | TEXT    |             | Location custom attribute                                |
| account_id           | TEXT    |             | New Relic account ID the record was synced from          |
| created_at           | TEXT    | NOT NULL    | Record creation time (ISO 8601 UTC)                      |
| updated_at           | TEXT    | NOT NULL    | Last update time (ISO 8601 UTC)                          |

---

### 3.4 `cmdb`

CMDB (Configuration Management Database) configuration item data. Populated by the CMDB sync job. Each record corresponds to one CI in the CMDB, identified by `hostname`.

| Column              | Type | Constraints | Description                                          |
|---------------------|------|-------------|------------------------------------------------------|
| hostname            | TEXT | PK          | Asset hostname — primary identifier and join key     |
| sys_id              | TEXT |             | ServiceNow sys_id for the CI record                  |
| os                  | TEXT |             | Operating system name                                |
| os_version          | TEXT |             | Operating system version                             |
| ip_address          | TEXT |             | Primary IP address of the CI                         |
| location            | TEXT |             | Physical or logical location                         |
| department          | TEXT |             | Owning department                                    |
| environment         | TEXT |             | Environment (e.g. production, staging)               |
| operational_status  | TEXT |             | Operational status of the CI                         |
| classification      | TEXT |             | CI classification                                    |
| last_synced_at      | TEXT |             | Last sync timestamp from CMDB (ISO 8601 UTC)         |
| created_at          | TEXT | NOT NULL    | Record creation time (ISO 8601 UTC)                  |
| updated_at          | TEXT | NOT NULL    | Last update time (ISO 8601 UTC)                      |

---

### 3.5 `credentials`

Stores encrypted connection credentials for vSphere, New Relic, and CMDB accounts. Supports multiple accounts per service. Managed by the user via the Settings UI.

| Column     | Type    | Constraints             | Description                                  |
|------------|---------|-------------------------|----------------------------------------------|
| id         | INTEGER | PK, AUTOINCREMENT       | Unique identifier                            |
| service    | TEXT    | NOT NULL                | `vsphere`, `newrelic`, or `cmdb`             |
| name       | TEXT    | NOT NULL                | User-defined label e.g. `Name|AccountId` |
| config     | TEXT    | NOT NULL                | AES-256 encrypted JSON (see structure below) |
| enabled    | INTEGER | NOT NULL DEFAULT 1      | `1` = used by sync job, `0` = disabled       |
| created_at | TEXT    | NOT NULL                | Record creation time (ISO 8601 UTC)          |
| updated_at | TEXT    | NOT NULL                | Last update time (ISO 8601 UTC)              |

**Constraint:** `UNIQUE(service, name)` — no duplicate names within the same service.

**Decrypted `config` structure:**

For `vsphere`:
```json
{
  "host": "vcenter.example.com",
  "username": "admin@vsphere.local",
  "password": "secret"
}
```

For `newrelic`:
```json
{
  "apiKey": "NRAK-xxxxxxxxxxxx",
  "accountId": "12345"
}
```

**Allowed values:**

| Column  | Allowed Values                         |
|---------|----------------------------------------|
| service | `vsphere`, `newrelic`, `cmdb`          |
| enabled | `1` (active), `0` (disabled)           |

**Example rows:**

| id | service  | name               | enabled |
|----|----------|--------------------|---------|
| 1  | vsphere  | Name|AccountId | 1       |
| 2  | vsphere  | DR vCenter         | 0       |
| 3  | newrelic | Production Account | 1       |
| 4  | newrelic | Dev Account        | 1       |

---

### 3.6 `sync_schedule`

Stores the user-configured sync schedule per service. The Backend Service polls this table every minute and triggers the appropriate sync job when the current time matches the cron expression.

| Column      | Type    | Constraints        | Description                                               |
|-------------|---------|--------------------|-----------------------------------------------------------|
| id          | INTEGER | PK, AUTOINCREMENT  | Unique identifier                                         |
| service     | TEXT    | NOT NULL, UNIQUE   | `vsphere`, `newrelic`, or `cmdb`                          |
| cron_expr   | TEXT    | NOT NULL           | Cron expression e.g. `0 0 2 * * *`                       |
| enabled     | INTEGER | NOT NULL DEFAULT 1 | `1` = active, `0` = paused                               |
| description | TEXT    |                    | Human-readable label e.g. `Every day at 2:00 AM`         |
| last_run_at | TEXT    |                    | Timestamp of last successful sync trigger (ISO 8601 UTC) |
| updated_at  | TEXT    | NOT NULL           | Last update time (ISO 8601 UTC)                          |

**Cron expression format:** `seconds minutes hours day-of-month month day-of-week`

| Example Schedule         | Cron Expression        |
|--------------------------|------------------------|
| Every day at 2:00 AM     | `0 0 2 * * *`          |
| Weekdays at 6:00 AM      | `0 0 6 * * MON-FRI`    |
| Every Monday at midnight | `0 0 0 * * MON`        |
| Weekends at 11:00 PM     | `0 0 23 * * SAT,SUN`   |
| Every 6 hours            | `0 0 0/6 * * *`        |

**Example rows:**

| id | service  | cron_expr             | enabled | description          |
|----|----------|-----------------------|---------|----------------------|
| 1  | vsphere  | `0 0 2 * * *`         | 1       | Every day at 2:00 AM |
| 2  | newrelic | `0 0 6 * * MON-FRI`   | 1       | Weekdays at 6:00 AM  |
| 3  | cmdb     | `0 0 3 * * *`         | 0       | Every day at 3:00 AM |

---

## 4. Design Decisions

| Decision | Rationale |
|----------|-----------|
| `hostname` as PK on `vsphere`, `newrelic`, `cmdb` | Natural, human-readable unique key; avoids surrogate key joins |
| `inventory` implemented as a SQL VIEW, not a table | Eliminates manual ETL step — the JOIN logic lives in the DB, not application code; inventory is always consistent with source tables |
| No foreign keys between tables | Tables are populated independently by different sync sources; decoupled by design |
| `credentials` uses `id` (INTEGER) as PK | Supports multiple credentials per service; no natural unique single column key |
| `sync_schedule` uses `id` (INTEGER) as PK | Allows future expansion to multiple schedules per service |
| Credentials stored as encrypted JSON | Flexible config structure per service type without needing extra columns |
| All timestamps stored as TEXT in ISO 8601 UTC | SQLite has no native DATETIME type; ISO 8601 TEXT is portable and lexicographically sortable |
| `enabled` stored as INTEGER | SQLite has no native BOOLEAN type; `1`/`0` is the standard SQLite convention |

---

## 5. SQLite Type Conventions

| Logical Type   | SQLite Type                         | Notes                                        |
|----------------|-------------------------------------|----------------------------------------------|
| String / Text  | `TEXT`                              | Used for all text fields including dates      |
| Integer / ID   | `INTEGER`                           | Used for numeric IDs and counts              |
| Boolean        | `INTEGER`                           | `1` = true, `0` = false                      |
| JSON           | `TEXT`                              | Stored as JSON string, parsed in app layer   |
| Date           | `TEXT`                              | ISO 8601 format: `YYYY-MM-DD`                |
| Datetime (UTC) | `TEXT`                              | ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`     |
| Auto-increment | `INTEGER PRIMARY KEY AUTOINCREMENT` | Only used where a surrogate key is needed    |
