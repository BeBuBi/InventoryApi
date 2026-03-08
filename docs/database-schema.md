# Database Schema
## Server Inventory System

**Version:** 1.3
**Last Updated:** 2026-03-07
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
   - [cmdb](#44-cmdb)
   - [credentials](#45-credentials)
   - [sync_schedule](#46-sync_schedule)
5. [Seed Data](#5-seed-data)
6. [Constraints Summary](#6-constraints-summary)

---

## 1. Overview

All application data is stored in a single SQLite database file (`inventory.db`). The schema is managed by **Flyway** — all changes must be made through versioned migration files, never by editing the database directly.

The database contains five physical tables (`vsphere`, `newrelic`, `cmdb`, `credentials`, `sync_schedule`) and one read-only SQL VIEW (`inventory`). There are no foreign key constraints between tables by design — each table is populated independently by different sync sources. The `hostname` column is the natural join key across `vsphere`, `newrelic`, and `cmdb`; the `inventory` VIEW aggregates all three by hostname.

---

## 2. Migration Files

| File | Description |
|------|-------------|
| `V1__init_schema.sql` | Initial schema — creates three source tables (`vsphere`, `newrelic`, `cmdb`), one read-only aggregation VIEW (`inventory`), two management tables (`credentials`, `sync_schedule`), and seeds default sync schedules |

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

### 4.1 `inventory` (View — Read Only)

A read-only SQL VIEW that aggregates `vsphere`, `newrelic`, and `cmdb` by hostname. It is never written to directly. A UNION of all three source tables drives the hostname list, which is then LEFT JOINed to each source table to produce the flat record.

```sql
CREATE VIEW inventory AS
SELECT
    h.hostname,
    -- vSphere columns
    v.ipv4_address          AS vsphere_ipv4,
    v.ipv6_address          AS vsphere_ipv6,
    v.vm_name,
    v.cpu_count,
    v.cpu_cores,
    v.memory_mb,
    v.memory_gb,
    v.power_state,
    v.guest_os,
    v.tools_status,
    v.last_synced_at        AS vsphere_last_synced,
    -- New Relic columns
    n.full_hostname,
    n.ipv4_address          AS nr_ipv4,
    n.ipv6_address          AS nr_ipv6,
    n.processor_count,
    n.core_count,
    n.system_memory_bytes,
    n.linux_distribution,
    n.service,
    n.environment           AS nr_environment,
    n.team,
    n.location              AS nr_location,
    n.account_id,
    -- CMDB columns
    c.sys_id,
    c.os,
    c.os_version,
    c.ip_address            AS cmdb_ip_address,
    c.location              AS cmdb_location,
    c.department,
    c.environment           AS cmdb_environment,
    c.operational_status,
    c.classification,
    c.last_synced_at        AS cmdb_last_synced,
    -- Computed: comma-separated list of sources that have a record for this hostname
    (CASE WHEN v.hostname IS NOT NULL THEN 'vsphere' ELSE '' END ||
     CASE WHEN n.hostname IS NOT NULL THEN
       CASE WHEN v.hostname IS NOT NULL THEN ',newrelic' ELSE 'newrelic' END ELSE '' END ||
     CASE WHEN c.hostname IS NOT NULL THEN
       CASE WHEN v.hostname IS NOT NULL OR n.hostname IS NOT NULL THEN ',cmdb' ELSE 'cmdb' END ELSE '' END
    ) AS sources
FROM (
    SELECT hostname FROM vsphere
    UNION SELECT hostname FROM newrelic
    UNION SELECT hostname FROM cmdb
) h
LEFT JOIN vsphere  v ON h.hostname = v.hostname
LEFT JOIN newrelic n ON h.hostname = n.hostname
LEFT JOIN cmdb     c ON h.hostname = c.hostname;
```

| Column | Source | Description |
|--------|--------|-------------|
| `hostname` | — | Asset hostname — join key |
| `vsphere_ipv4` | vsphere.ipv4_address | VM IPv4 address |
| `vsphere_ipv6` | vsphere.ipv6_address | VM IPv6 address |
| `vm_name` | vsphere.vm_name | VM display name in vSphere |
| `cpu_count` | vsphere.cpu_count | Number of vCPUs |
| `cpu_cores` | vsphere.cpu_cores | Number of CPU cores |
| `memory_mb` | vsphere.memory_mb | Allocated memory in MB |
| `memory_gb` | vsphere.memory_gb | Allocated memory in GB |
| `power_state` | vsphere.power_state | VM power state |
| `guest_os` | vsphere.guest_os | Guest OS name |
| `tools_status` | vsphere.tools_status | VMware Tools status |
| `vsphere_last_synced` | vsphere.last_synced_at | Last vSphere sync timestamp |
| `full_hostname` | newrelic.full_hostname | FQDN from New Relic |
| `nr_ipv4` | newrelic.ipv4_address | IPv4 from New Relic |
| `nr_ipv6` | newrelic.ipv6_address | IPv6 from New Relic |
| `processor_count` | newrelic.processor_count | CPU count from New Relic |
| `core_count` | newrelic.core_count | Core count from New Relic |
| `system_memory_bytes` | newrelic.system_memory_bytes | Memory in bytes from New Relic |
| `linux_distribution` | newrelic.linux_distribution | Linux distro from New Relic |
| `service` | newrelic.service | Service custom attribute |
| `nr_environment` | newrelic.environment | Environment from New Relic |
| `team` | newrelic.team | Team custom attribute |
| `nr_location` | newrelic.location | Location from New Relic |
| `account_id` | newrelic.account_id | New Relic account ID |
| `sys_id` | cmdb.sys_id | ServiceNow sys_id |
| `os` | cmdb.os | OS name from CMDB |
| `os_version` | cmdb.os_version | OS version from CMDB |
| `cmdb_ip_address` | cmdb.ip_address | IP address from CMDB |
| `cmdb_location` | cmdb.location | Location from CMDB |
| `department` | cmdb.department | Department from CMDB |
| `cmdb_environment` | cmdb.environment | Environment from CMDB |
| `operational_status` | cmdb.operational_status | Operational status from CMDB |
| `classification` | cmdb.classification | CI classification from CMDB |
| `cmdb_last_synced` | cmdb.last_synced_at | Last CMDB sync timestamp |
| `sources` | computed | Comma-separated list: `vsphere`, `newrelic`, `cmdb` |

---

### 4.2 `vsphere`

VMware vSphere VM metadata. Populated by the vSphere sync job. Each record corresponds to one VM in vCenter, identified by `hostname`.

```sql
CREATE TABLE vsphere (
    hostname        TEXT    NOT NULL,
    vm_name         TEXT    NOT NULL,
    cpu_count       INTEGER,
    cpu_cores       INTEGER,
    memory_mb       INTEGER,
    memory_gb       INTEGER,
    power_state     TEXT    CHECK (power_state  IN ('poweredOn', 'poweredOff', 'suspended')),
    guest_os        TEXT,
    tools_status    TEXT    CHECK (tools_status IN ('toolsOk', 'toolsOld', 'toolsNotRunning', 'toolsNotInstalled')),
    ipv4_address    TEXT,
    ipv6_address    TEXT,
    source_url      TEXT,
    last_synced_at  TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hostname` | TEXT | NO | — | Asset hostname — primary key and join key |
| `vm_name` | TEXT | NO | — | VM display name in vSphere |
| `cpu_count` | INTEGER | YES | — | Number of vCPUs |
| `cpu_cores` | INTEGER | YES | — | Number of physical CPU cores |
| `memory_mb` | INTEGER | YES | — | Allocated memory in MB |
| `memory_gb` | INTEGER | YES | — | Allocated memory in GB |
| `power_state` | TEXT | YES | — | `poweredOn`, `poweredOff`, `suspended` |
| `guest_os` | TEXT | YES | — | Guest operating system |
| `tools_status` | TEXT | YES | — | `toolsOk`, `toolsOld`, `toolsNotRunning`, `toolsNotInstalled` |
| `ipv4_address` | TEXT | YES | — | Primary IPv4 address of the VM |
| `ipv6_address` | TEXT | YES | — | Primary IPv6 address of the VM |
| `source_url` | TEXT | YES | — | vCenter hostname this record was synced from |
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

### 4.4 `cmdb`

CMDB (Configuration Management Database) records. Populated by the CMDB sync job. Each record corresponds to one configuration item in the CMDB, identified by `hostname`.

```sql
CREATE TABLE cmdb (
    hostname            TEXT    NOT NULL,
    sys_id              TEXT,
    os                  TEXT,
    os_version          TEXT,
    ip_address          TEXT,
    location            TEXT,
    department          TEXT,
    environment         TEXT,
    operational_status  TEXT,
    classification      TEXT,
    last_synced_at      TEXT,
    created_at          TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);
```

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hostname` | TEXT | NO | — | Asset hostname — primary key and join key |
| `sys_id` | TEXT | YES | — | ServiceNow sys_id for the CI record |
| `os` | TEXT | YES | — | Operating system name |
| `os_version` | TEXT | YES | — | Operating system version |
| `ip_address` | TEXT | YES | — | Primary IP address of the CI |
| `location` | TEXT | YES | — | Physical or logical location |
| `department` | TEXT | YES | — | Owning department |
| `environment` | TEXT | YES | — | Environment (e.g. production, staging) |
| `operational_status` | TEXT | YES | — | Operational status of the CI (e.g. operational, non-operational) |
| `classification` | TEXT | YES | — | CI classification |
| `last_synced_at` | TEXT | YES | — | Last sync timestamp from CMDB (ISO 8601 UTC) |
| `created_at` | TEXT | NO | — | Record creation time (ISO 8601 UTC) |
| `updated_at` | TEXT | NO | — | Last update time (ISO 8601 UTC) |

---

### 4.5 `credentials`

Stores AES-256 encrypted connection credentials for vSphere, New Relic, and CMDB accounts. Multiple accounts per service are supported. Managed via the Settings UI.

```sql
CREATE TABLE credentials (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic', 'cmdb')),
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
| `service` | TEXT | NO | — | `vsphere`, `newrelic`, or `cmdb` |
| `name` | TEXT | NO | — | User-defined label e.g. `Name|AccountId` |
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

For `cmdb`:
```json
{
  "token_url": "https://your-instance.service-now.com/oauth_token.do",
  "api_url": "https://your-instance.service-now.com/api/xci/cmdb_asset/getAssetDetails",
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "username": "sync-user",
  "password": "secret"
}
```

**Encryption:** Config is encrypted with AES-256-GCM using the `ENCRYPTION_KEY` environment variable before storage and decrypted at runtime. The key is never stored in the database or source code.

---

### 4.6 `sync_schedule`

One row per service. The sync jobs poll this table every minute and trigger when the current time matches the cron expression.

```sql
CREATE TABLE sync_schedule (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic', 'cmdb')),
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
| `service` | TEXT | NO | — | `vsphere`, `newrelic`, or `cmdb` — one row per service |
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

The initial migration inserts three default `sync_schedule` rows with `enabled = 0` (disabled). This ensures the sync jobs always find a row to read on first boot. Users enable and configure the schedule via the Settings UI.

```sql
INSERT INTO sync_schedule (service, cron_expr, enabled, description, updated_at)
VALUES
    ('vsphere',  '0 0 2 * * *',       0, 'Every day at 2:00 AM',  datetime('now')),
    ('newrelic', '0 0 6 * * MON-FRI', 0, 'Weekdays at 6:00 AM',   datetime('now')),
    ('cmdb',     '0 0 3 * * *',       0, 'Every day at 3:00 AM',  datetime('now'));
```

---

## 6. Constraints Summary

| Table | Constraint | Type | Definition |
|-------|------------|------|------------|
| `inventory` | — | View | Read-only aggregation VIEW — no constraints |
| `vsphere` | `PK` | Primary Key | `hostname` |
| `vsphere` | `chk_power_state` | CHECK | `power_state IN ('poweredOn','poweredOff','suspended')` |
| `vsphere` | `chk_tools_status` | CHECK | `tools_status IN ('toolsOk','toolsOld','toolsNotRunning','toolsNotInstalled')` |
| `newrelic` | `PK` | Primary Key | `hostname` |
| `newrelic` | — | — | Columns sourced from NR NetworkSample; no additional CHECK constraints |
| `cmdb` | `PK` | Primary Key | `hostname` |
| `cmdb` | — | — | No additional CHECK constraints; values are sourced from CMDB as-is |
| `credentials` | `PK` | Primary Key | `id` (autoincrement) |
| `credentials` | `uq_service_name` | Unique | `(service, name)` |
| `credentials` | `chk_service` | CHECK | `service IN ('vsphere','newrelic','cmdb')` |
| `credentials` | `chk_enabled` | CHECK | `enabled IN (0, 1)` |
| `sync_schedule` | `PK` | Primary Key | `id` (autoincrement) |
| `sync_schedule` | `uq_service` | Unique | `service` |
| `sync_schedule` | `chk_service` | CHECK | `service IN ('vsphere','newrelic','cmdb')` |
| `sync_schedule` | `chk_enabled` | CHECK | `enabled IN (0, 1)` |
