-- ============================================================
-- V1__init_schema.sql
-- Initial schema for Server Inventory System
-- Database: SQLite 3.x
-- ============================================================

-- ------------------------------------------------------------
-- inventory
-- Core asset registry. hostname is the natural primary key
-- and the join key across vsphere, newrelic, and cmdb tables.
-- ------------------------------------------------------------
CREATE TABLE inventory (
    hostname        TEXT    NOT NULL,
    ip_address      TEXT    NOT NULL,
    asset_type      TEXT    NOT NULL CHECK (asset_type IN ('server', 'vm', 'container', 'network')),
    environment     TEXT    NOT NULL CHECK (environment IN ('production', 'staging', 'dev', 'dr')),
    owner           TEXT,
    location        TEXT,
    status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'decommissioned', 'unknown')),
    warranty_expiry TEXT,
    last_patched_at TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);

-- ------------------------------------------------------------
-- vsphere
-- VMware vSphere VM metadata. Populated by the vSphere sync
-- job. Correlated to inventory via hostname.
-- ------------------------------------------------------------
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
    last_synced_at  TEXT,
    created_at      TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    PRIMARY KEY (hostname)
);

-- ------------------------------------------------------------
-- newrelic
-- New Relic NetworkSample data. Populated by the New Relic
-- sync job. Correlated to inventory via hostname.
-- Column names match New Relic NetworkSample attribute names.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- cmdb
-- ServiceNow CMDB asset data. Populated by the CMDB sync job.
-- Correlated to inventory via hostname.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- credentials
-- AES-256 encrypted connection credentials for vSphere,
-- New Relic, and CMDB accounts. Multiple accounts per service.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- sync_schedule
-- One row per service. Polled every minute by the backend
-- to determine if a sync job should be triggered.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Seed data: default sync schedules (disabled by default)
-- ------------------------------------------------------------
INSERT INTO sync_schedule (service, cron_expr, enabled, description, updated_at)
VALUES
    ('vsphere',  '0 0 2 * * *',       0, 'Every day at 2:00 AM',  datetime('now')),
    ('newrelic', '0 0 6 * * MON-FRI', 0, 'Weekdays at 6:00 AM',   datetime('now')),
    ('cmdb',     '0 0 3 * * *',       0, 'Every day at 3:00 AM',  datetime('now'));
