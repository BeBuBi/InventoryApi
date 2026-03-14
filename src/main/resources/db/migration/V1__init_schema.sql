-- ============================================================
-- V1__init_schema.sql
-- Initial schema for Server Inventory System
-- Database: SQLite 3.x
-- ============================================================

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
    source_url      TEXT,
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
-- inventory (VIEW)
-- Unified read-only view aggregating vsphere, newrelic, and
-- cmdb by hostname. Each field is sourced directly from its
-- origin table with no merging.
-- ------------------------------------------------------------
CREATE VIEW inventory AS
SELECT
    h.hostname,
    -- vSphere fields
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
    -- New Relic fields
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
    -- CMDB fields
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
    -- Meta
    CASE
        WHEN v.hostname IS NOT NULL AND n.hostname IS NOT NULL AND c.hostname IS NOT NULL THEN 'vsphere,newrelic,cmdb'
        WHEN v.hostname IS NOT NULL AND n.hostname IS NOT NULL                           THEN 'vsphere,newrelic'
        WHEN v.hostname IS NOT NULL AND c.hostname IS NOT NULL                           THEN 'vsphere,cmdb'
        WHEN n.hostname IS NOT NULL AND c.hostname IS NOT NULL                           THEN 'newrelic,cmdb'
        WHEN v.hostname IS NOT NULL                                                      THEN 'vsphere'
        WHEN n.hostname IS NOT NULL                                                      THEN 'newrelic'
        ELSE                                                                                  'cmdb'
    END AS sources
FROM (
    SELECT hostname FROM vsphere
    UNION
    SELECT hostname FROM newrelic
    UNION
    SELECT hostname FROM cmdb
) h
LEFT JOIN vsphere  v ON h.hostname = v.hostname
LEFT JOIN newrelic n ON h.hostname = n.hostname
LEFT JOIN cmdb     c ON h.hostname = c.hostname;

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
-- Indexes
-- Covering all filter, lookup, and sort columns used by the
-- repository queries. hostname PKs are already indexed.
-- ------------------------------------------------------------

-- vsphere: power_state/source_url/guest_os used in IN filters and DISTINCT lookups
CREATE INDEX IF NOT EXISTS idx_vsphere_power_state ON vsphere (power_state);
CREATE INDEX IF NOT EXISTS idx_vsphere_source_url  ON vsphere (source_url);
CREATE INDEX IF NOT EXISTS idx_vsphere_guest_os    ON vsphere (guest_os);

-- newrelic: equality and IN filters + DISTINCT lookups
CREATE INDEX IF NOT EXISTS idx_newrelic_service            ON newrelic (service);
CREATE INDEX IF NOT EXISTS idx_newrelic_environment        ON newrelic (environment);
CREATE INDEX IF NOT EXISTS idx_newrelic_account_id         ON newrelic (account_id);
CREATE INDEX IF NOT EXISTS idx_newrelic_linux_distribution ON newrelic (linux_distribution);

-- cmdb: IN filters + DISTINCT lookups
CREATE INDEX IF NOT EXISTS idx_cmdb_operational_status ON cmdb (operational_status);
CREATE INDEX IF NOT EXISTS idx_cmdb_os_version         ON cmdb (os_version);

-- credentials: findByService / findByServiceAndEnabledTrue
CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials (service);

-- ------------------------------------------------------------
-- Seed data: default sync schedules (disabled by default)
-- ------------------------------------------------------------
INSERT INTO sync_schedule (service, cron_expr, enabled, description, updated_at)
VALUES
    ('vsphere',  '0 0 2 * * *',       0, 'Every day at 2:00 AM',  datetime('now')),
    ('newrelic', '0 0 6 * * MON-FRI', 0, 'Weekdays at 6:00 AM',   datetime('now')),
    ('cmdb',     '0 0 3 * * *',       0, 'Every day at 3:00 AM',  datetime('now'));
