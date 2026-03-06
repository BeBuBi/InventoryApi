# Database Schema
## Server Inventory System

**Version:** 1.1
**Last Updated:** 2026-03-06
**Database:** SQLite 3.x
**Migration Tool:** Flyway

---

## Table of Contents

1. [Overview](#1-overview)
2. [Migration Files](#2-migration-files)
3. [SQLite Configuration](#3-sqlite-configuration)
4. [Tables](#4-tables)
   - [inventory](#41-inventory)
   - [vsphere](#42-vsphere)
   - [newrelic](#43-newrelic)
   - [credentials](#44-credentials)
   - [sync_schedule](#45-sync_schedule)
5. [Seed Data](#5-seed-data)
6. [Constraints Summary](#6-constraints-summary)

---

## 1. Overview

All application data is stored in a single SQLite database file (`inventory.db`). The schema is managed by **Flyway** — all changes must be made through versioned migration files, never by editing the database directly.

The database contains five tables. There are no foreign key constraints between tables by design — each table is populated independently by different sources (manual entry, vSphere sync, New Relic sync). The `hostname` column is the natural join key across `inventory`, `vsphere`, and `newrelic`.

---

## 2. Migration Files

| File | Description |
|------|-------------|
| `V1__init_schema.sql` | Initial schema — creates all five tables and seeds default sync schedules |

**Location:** `src/main/resources/db/migration/`

**Naming convention:** `V{version}__{description}.sql`
- Version must be an integer or decimal (e.g., `V1`, `V2`, `V1_1`)
- Description uses underscores (e.g., `add_index_to_inventory`)
- Never modify an already-applied migration file

---

## 3. SQLite Configuration

The following settings must be applied at the JDBC connection level (not in migration files):

| PRAGMA | Value | Purpose |
|--------|-------|---------|
| `journal_mode` | `WAL` | Write-Ahead Logging — allows concurrent reads during writes |
| `foreign_keys` | `OFF` | Foreign keys disabled by design (tables are decoupled) |
| `busy_timeout` | `5000` | Wait up to 5 seconds before returning a lock error |

**Spring Boot datasource configuration (`application.properties`):**
```properties
spring.datasource.url=jdbc:sqlite:${DB_PATH:./inventory.db}?journal_mode=WAL&busy_timeout=5000
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.flyway.locations=classpath:db/migration
```

---

## 4. Tables

### 4.1 `inventory`

Core asset registry. Every managed server, VM, or container must have a record here before it can be correlated with vSphere or New Relic data.

```sql
CREATE TABLE inventory (
    hostname        TEXT    NOT NULL,
    ip_address      TEXT    NOT NULL,
    asset_type      TEXT    NOT NULL CHECK (asset_type IN ('server', 'vm', 'container', 'network')),
    environment     TEXT    NOT NULL CHECK (environment IN ('production', 'staging', 'dev', 'dr')),
    owner           TEXT,
    location        TEXT,
    status          TEXT    NOT NULL DEFAULT 'active'  CHECK (status      IN ('active', 'maintenance', 'decommissioned', 'unknown')),
    warranty_expiry TEXT,
    last_patched_at TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hostname` | TEXT | NO | — | Unique asset hostname — primary key and join key |
| `ip_address` | TEXT | NO | — | Primary IPv4 or IPv6 address |
| `asset_type` | TEXT | NO | — | `server`, `vm`, `container`, `network` |
| `environment` | TEXT | NO | — | `production`, `staging`, `dev`, `dr` |
| `owner` | TEXT | YES | — | Team or person responsible |
| `location` | TEXT | YES | — | Data center, rack, or cloud region |
| `status` | TEXT | NO | `active` | `active`, `maintenance`, `decommissioned`, `unknown` |
| `warranty_expiry` | TEXT | YES | — | Hardware warranty expiry date (ISO 8601) |
| `last_patched_at` | TEXT | YES | — | Last OS patch date/time (ISO 8601 UTC) |
| `created_at` | TEXT | NO | — | Record creation time (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

---

### 4.2 `vsphere`

VMware vSphere VM metadata. Populated by the vSphere sync job. Each record corresponds to one VM in vCenter, identified by `hostname`.

```sql
CREATE TABLE vsphere (
    hostname        TEXT    NOT NULL,
    fqdn            TEXT,
    vm_name         TEXT    NOT NULL,
    vm_id           TEXT    NOT NULL,
    cluster         TEXT,
    datacenter      TEXT,
    datastore       TEXT,
    cpu_count       INTEGER,
    cpu_cores       INTEGER,
    memory_mb       INTEGER,
    memory_gb       INTEGER,
    disk_gb         INTEGER,
    power_state     TEXT    CHECK (power_state  IN ('poweredOn', 'poweredOff', 'suspended')),
    guest_os        TEXT,
    tools_status    TEXT    CHECK (tools_status IN ('toolsOk', 'toolsOld', 'toolsNotRunning', 'toolsNotInstalled')),
    ipv4_address    TEXT,
    ipv6_address    TEXT,
    last_synced_at  TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (hostname),
    UNIQUE (vm_id)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hostname` | TEXT | NO | — | Asset hostname — primary key and join key |
| `fqdn` | TEXT | YES | — | Fully qualified domain name |
| `vm_name` | TEXT | NO | — | VM display name in vSphere |
| `vm_id` | TEXT | NO | — | vSphere managed object ID (moId) — must be unique |
| `cluster` | TEXT | YES | — | vSphere cluster name |
| `datacenter` | TEXT | YES | — | vSphere datacenter name |
| `datastore` | TEXT | YES | — | Assigned datastore |
| `cpu_count` | INTEGER | YES | — | Number of vCPUs |
| `cpu_cores` | INTEGER | YES | — | Number of physical CPU cores |
| `memory_mb` | INTEGER | YES | — | Allocated memory in MB |
| `memory_gb` | INTEGER | YES | — | Allocated memory in GB |
| `disk_gb` | INTEGER | YES | — | Total disk size in GB |
| `power_state` | TEXT | YES | — | `poweredOn`, `poweredOff`, `suspended` |
| `guest_os` | TEXT | YES | — | Guest operating system |
| `tools_status` | TEXT | YES | — | `toolsOk`, `toolsOld`, `toolsNotRunning`, `toolsNotInstalled` |
| `ipv4_address` | TEXT | YES | — | Primary IPv4 address of the VM |
| `ipv6_address` | TEXT | YES | — | Primary IPv6 address of the VM |
| `last_synced_at` | TEXT | YES | — | Last sync timestamp from vSphere API (ISO 8601 UTC) |
| `created_at` | TEXT | NO | — | Record creation time (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

---

### 4.3 `newrelic`

New Relic infrastructure agent data. Populated by the New Relic sync job via `NetworkSample` events. Each record corresponds to one monitored host in New Relic, identified by `hostname`. Column names match New Relic NetworkSample attribute names.

```sql
CREATE TABLE newrelic (
    hostname              TEXT    NOT NULL,
    full_hostname         TEXT,
    ipv4_address          TEXT,
    ipv6_address          TEXT,
    processor_count       INTEGER,
    core_count            INTEGER,
    system_memory_bytes   INTEGER,
    linux_distribution    TEXT,
    service               TEXT,
    environment           TEXT,
    team                  TEXT,
    location              TEXT,
    account_id            TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hostname` | TEXT | NO | — | Asset hostname — primary key and join key |
| `full_hostname` | TEXT | YES | — | Fully qualified domain name (`fullHostname` in NR) |
| `ipv4_address` | TEXT | YES | — | Primary routable IPv4 address (`ipV4Address` in NR) |
| `ipv6_address` | TEXT | YES | — | Primary routable IPv6 address (`ipV6Address` in NR) |
| `processor_count` | INTEGER | YES | — | Number of CPUs (`processorCount` in NR) |
| `core_count` | INTEGER | YES | — | Number of CPU cores (`coreCount` in NR) |
| `system_memory_bytes` | INTEGER | YES | — | Total memory in bytes (`systemMemoryBytes` in NR) |
| `linux_distribution` | TEXT | YES | — | Linux distro name (`linuxDistribution` in NR) |
| `service` | TEXT | YES | — | Service name custom attribute (`service` in NR) |
| `environment` | TEXT | YES | — | Environment custom attribute (`environment` in NR) |
| `team` | TEXT | YES | — | Team custom attribute (`team` in NR) |
| `location` | TEXT | YES | — | Location custom attribute (`location` in NR) |
| `account_id` | TEXT | YES | — | New Relic account ID the record was synced from |
| `created_at` | TEXT | NO | — | Record creation time (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

---

### 4.4 `credentials`

Stores AES-256 encrypted connection credentials for vSphere and New Relic accounts. Multiple accounts per service are supported. Managed via the Settings UI.

```sql
CREATE TABLE credentials (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic')),
    name        TEXT    NOT NULL,
    config      TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    UNIQUE (service, name)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | NO | autoincrement | Surrogate primary key |
| `service` | TEXT | NO | — | `vsphere` or `newrelic` |
| `name` | TEXT | NO | — | User-defined label e.g. `Production vCenter` |
| `config` | TEXT | NO | — | AES-256 encrypted JSON (see structure below) |
| `enabled` | INTEGER | NO | `1` | `1` = used by sync job, `0` = disabled |
| `created_at` | TEXT | NO | — | Record creation time (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

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

**Encryption:** Config is encrypted with AES-256-GCM using the `ENCRYPTION_KEY` environment variable before storage and decrypted at runtime. The key is never stored in the database or source code.

---

### 4.5 `sync_schedule`

One row per service. The sync jobs poll this table every minute and trigger when the current time matches the cron expression.

```sql
CREATE TABLE sync_schedule (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic')),
    cron_expr   TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    description TEXT,
    last_run_at TEXT,
    updated_at  TEXT    NOT NULL,
    UNIQUE (service)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | NO | autoincrement | Surrogate primary key |
| `service` | TEXT | NO | — | `vsphere` or `newrelic` — one row per service |
| `cron_expr` | TEXT | NO | — | Cron expression (6-field: seconds minutes hours dom month dow) |
| `enabled` | INTEGER | NO | `1` | `1` = active, `0` = paused |
| `description` | TEXT | YES | — | Human-readable label e.g. `Every day at 2:00 AM` |
| `last_run_at` | TEXT | YES | — | Timestamp of last successful sync trigger (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

**Cron expression format:** `seconds minutes hours day-of-month month day-of-week`

| Schedule | Cron Expression |
|----------|-----------------|
| Every day at 2:00 AM | `0 0 2 * * *` |
| Weekdays at 6:00 AM | `0 0 6 * * MON-FRI` |
| Every Monday at midnight | `0 0 0 * * MON` |
| Weekends at 11:00 PM | `0 0 23 * * SAT,SUN` |
| Every 6 hours | `0 0 0/6 * * *` |

---

## 5. Seed Data

The initial migration inserts two default `sync_schedule` rows with `enabled = 0` (disabled). This ensures the sync jobs always find a row to read on first boot. Users enable and configure the schedule via the Settings UI.

```sql
INSERT INTO sync_schedule (service, cron_expr, enabled, description, updated_at)
VALUES
    ('vsphere',  '0 0 2 * * *',       0, 'Every day at 2:00 AM',  datetime('now')),
    ('newrelic', '0 0 6 * * MON-FRI', 0, 'Weekdays at 6:00 AM',   datetime('now'));
```

---

## 6. Constraints Summary

| Table | Constraint | Type | Definition |
|-------|------------|------|------------|
| `inventory` | `PK` | Primary Key | `hostname` |
| `inventory` | `chk_asset_type` | CHECK | `asset_type IN ('server','vm','container','network')` |
| `inventory` | `chk_environment` | CHECK | `environment IN ('production','staging','dev','dr')` |
| `inventory` | `chk_status` | CHECK | `status IN ('active','maintenance','decommissioned','unknown')` |
| `vsphere` | `PK` | Primary Key | `hostname` |
| `vsphere` | `uq_vm_id` | Unique | `vm_id` |
| `vsphere` | `chk_power_state` | CHECK | `power_state IN ('poweredOn','poweredOff','suspended')` |
| `vsphere` | `chk_tools_status` | CHECK | `tools_status IN ('toolsOk','toolsOld','toolsNotRunning','toolsNotInstalled')` |
| `newrelic` | `PK` | Primary Key | `hostname` |
| `newrelic` | — | — | Columns sourced from NR NetworkSample; no additional CHECK constraints |
| `credentials` | `PK` | Primary Key | `id` (autoincrement) |
| `credentials` | `uq_service_name` | Unique | `(service, name)` |
| `credentials` | `chk_service` | CHECK | `service IN ('vsphere','newrelic')` |
| `credentials` | `chk_enabled` | CHECK | `enabled IN (0, 1)` |
| `sync_schedule` | `PK` | Primary Key | `id` (autoincrement) |
| `sync_schedule` | `uq_service` | Unique | `service` |
| `sync_schedule` | `chk_service` | CHECK | `service IN ('vsphere','newrelic')` |
| `sync_schedule` | `chk_enabled` | CHECK | `enabled IN (0, 1)` |
