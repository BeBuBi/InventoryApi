-- ============================================================
-- V2__add_indexes.sql
-- Indexes for all filter, lookup, and sort columns.
-- ============================================================

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
