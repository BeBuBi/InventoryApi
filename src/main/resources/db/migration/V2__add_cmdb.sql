-- ============================================================
-- V2__add_cmdb.sql
-- Add ServiceNow CMDB data source support
-- ============================================================

-- Recreate credentials with 'cmdb' added to the service check
CREATE TABLE credentials_new (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic', 'cmdb')),
    name        TEXT    NOT NULL,
    config      TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL,
    UNIQUE (service, name)
);
INSERT INTO credentials_new SELECT * FROM credentials;
DROP TABLE credentials;
ALTER TABLE credentials_new RENAME TO credentials;

-- Recreate sync_schedule with 'cmdb' added
CREATE TABLE sync_schedule_new (
    id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL CHECK (service IN ('vsphere', 'newrelic', 'cmdb')),
    cron_expr   TEXT    NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    description TEXT,
    last_run_at TEXT,
    updated_at  TEXT    NOT NULL,
    UNIQUE (service)
);
INSERT INTO sync_schedule_new SELECT * FROM sync_schedule;
DROP TABLE sync_schedule;
ALTER TABLE sync_schedule_new RENAME TO sync_schedule;

-- New cmdb table
CREATE TABLE cmdb (
    hostname            TEXT    NOT NULL,
    sys_id              TEXT,
    asset_tag           TEXT,
    serial_number       TEXT,
    manufacturer        TEXT,
    model_name          TEXT,
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

-- Seed sync schedule for cmdb
INSERT INTO sync_schedule (service, cron_expr, enabled, description, updated_at)
VALUES ('cmdb', '0 0 3 * * *', 0, 'Every day at 3:00 AM', datetime('now'));
