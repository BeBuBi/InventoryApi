# Data Model
## Server Inventory System

**Version:** 1.0
**Last Updated:** 2026-03-06
**Database:** SQLite 3.x

---

## Table of Contents

1. [Overview](#1-overview)
2. [Entity Diagram](#2-entity-diagram)
3. [Tables](#3-tables)
   - [inventory](#31-inventory)
   - [vsphere](#32-vsphere)
   - [newrelic](#33-newrelic)
   - [credentials](#34-credentials)
   - [sync_schedule](#35-sync_schedule)
4. [Design Decisions](#4-design-decisions)
5. [SQLite Type Conventions](#5-sqlite-type-conventions)

---

## 1. Overview

The data model consists of five tables stored in a single SQLite database file (`inventory.db`). All tables are independent — there are no foreign key constraints between them. The `hostname` field serves as the natural common key across `inventory`, `vsphere`, and `newrelic`, allowing the application layer to correlate data via JOIN queries.

| Table | Purpose |
|-------|---------|
| `inventory` | Core asset registry — all managed servers, VMs, and containers |
| `vsphere` | VMware vSphere VM metadata, synced from vCenter API |
| `newrelic` | New Relic monitoring data, synced from NerdGraph API |
| `credentials` | Encrypted connection credentials for vSphere and New Relic accounts |
| `sync_schedule` | User-configured sync schedule (day + time) per service |

---

## 2. Entity Diagram

```
┌─────────────────────────┐     ┌─────────────────────────┐
│         inventory        │     │          vsphere         │
│─────────────────────────│     │─────────────────────────│
│ hostname (PK)           │     │ hostname (PK)            │
│ ip_address              │     │ vm_name                  │
│ asset_type              │     │ cpu_count                │
│ environment             │     │ cpu_cores                │
│ owner                   │     │ memory_mb                │
│ location                │     │ memory_gb                │
│ status                  │     │ power_state              │
│ warranty_expiry         │     │ guest_os                 │
│ last_patched_at         │     │ tools_status             │
│ created_at              │     │ ipv4_address             │
│ updated_at              │     │ ipv6_address             │
└─────────────────────────┘     │ last_synced_at           │
                                 │ tools_status             │
                                 │ ipv4_address             │
  Correlated by hostname         │ created_at               │
  at application layer ─────────│ updated_at               │
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
└─────────────────────────┘     ┌─────────────────────────┐
                                 │       sync_schedule      │
                                 │─────────────────────────│
                                 │ id (PK)                  │
                                 │ service                  │
                                 │ cron_expr                │
                                 │ enabled                  │
                                 │ description              │
                                 │ last_run_at              │
                                 │ updated_at               │
                                 └─────────────────────────┘
```

---

## 3. Tables

### 3.1 `inventory`

Core asset registry. Every managed server, VM, or container must have a record here. The `hostname` is the primary key and the natural identifier used to correlate data with `vsphere` and `newrelic` tables.

| Column          | Type    | Constraints               | Description                                      |
|-----------------|---------|---------------------------|--------------------------------------------------|
| hostname        | TEXT    | PK                        | Unique asset hostname — primary identifier       |
| ip_address      | TEXT    | NOT NULL                  | Primary IPv4 or IPv6 address                     |
| asset_type      | TEXT    | NOT NULL                  | `server`, `vm`, `container`, `network`           |
| environment     | TEXT    | NOT NULL                  | `production`, `staging`, `dev`, `dr`             |
| owner           | TEXT    |                           | Team or person responsible                       |
| location        | TEXT    |                           | Data center, rack, or cloud region               |
| status          | TEXT    | NOT NULL DEFAULT `active` | `active`, `maintenance`, `decommissioned`, `unknown` |
| warranty_expiry | TEXT    |                           | Hardware warranty expiry date (ISO 8601)         |
| last_patched_at | TEXT    |                           | Date/time of last OS patch (ISO 8601 UTC)        |
| created_at      | TEXT    | NOT NULL                  | Record creation time (ISO 8601 UTC)              |
| updated_at      | TEXT    | NOT NULL                  | Last update time (ISO 8601 UTC)                  |

**Allowed values:**

| Column      | Allowed Values                                           |
|-------------|----------------------------------------------------------|
| asset_type  | `server`, `vm`, `container`, `network`                   |
| environment | `production`, `staging`, `dev`, `dr`                     |
| status      | `active`, `maintenance`, `decommissioned`, `unknown`     |

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

### 3.4 `credentials`

Stores encrypted connection credentials for vSphere and New Relic accounts. Supports multiple accounts per service. Managed by the user via the Settings UI.

| Column     | Type    | Constraints             | Description                                  |
|------------|---------|-------------------------|----------------------------------------------|
| id         | INTEGER | PK, AUTOINCREMENT       | Unique identifier                            |
| service    | TEXT    | NOT NULL                | `vsphere` or `newrelic`                      |
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

| Column  | Allowed Values               |
|---------|------------------------------|
| service | `vsphere`, `newrelic`        |
| enabled | `1` (active), `0` (disabled) |

**Example rows:**

| id | service  | name               | enabled |
|----|----------|--------------------|---------|
| 1  | vsphere  | Name|AccountId | 1       |
| 2  | vsphere  | DR vCenter         | 0       |
| 3  | newrelic | Production Account | 1       |
| 4  | newrelic | Dev Account        | 1       |

---

### 3.5 `sync_schedule`

Stores the user-configured sync schedule per service. The Backend Service polls this table every minute and triggers the appropriate sync job when the current time matches the cron expression.

| Column      | Type    | Constraints        | Description                                               |
|-------------|---------|--------------------|-----------------------------------------------------------|
| id          | INTEGER | PK, AUTOINCREMENT  | Unique identifier                                         |
| service     | TEXT    | NOT NULL, UNIQUE   | `vsphere` or `newrelic`                                   |
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

---

## 4. Design Decisions

| Decision | Rationale |
|----------|-----------|
| `hostname` as PK on `inventory`, `vsphere`, `newrelic` | Natural, human-readable unique key; avoids surrogate key joins |
| No foreign keys between tables | Tables are populated independently by different sync sources; decoupled by design |
| `credentials` uses `id` (INTEGER) as PK | Supports multiple credentials per service; no natural unique single column key |
| `sync_schedule` uses `id` (INTEGER) as PK | Allows future expansion to multiple schedules per service |
| Credentials stored as encrypted JSON | Flexible config structure per service type without needing extra columns |
| `tags` stored as JSON string in `newrelic` | New Relic tags are dynamic key-value pairs; avoids a rigid schema |
| All timestamps stored as TEXT in ISO 8601 UTC | SQLite has no native DATETIME type; ISO 8601 TEXT is portable and lexicographically sortable |
| `reporting` and `enabled` stored as INTEGER | SQLite has no native BOOLEAN type; `1`/`0` is the standard SQLite convention |

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
