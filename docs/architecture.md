# Architecture Overview
## Server Inventory System

**Version:** 1.5
**Author:** Solo Developer
**Last Updated:** 2026-03-10
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Style](#2-architecture-style)
3. [System Diagram](#3-system-diagram)
4. [Services](#4-services)
   - [Backend Service](#41-backend-service)
   - [Frontend (Angular)](#42-frontend-angular)
5. [Data Flow](#5-data-flow)
6. [Database Design](#6-database-design)
7. [API Design](#7-api-design)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Security](#9-security)
10. [Technology Stack Summary](#10-technology-stack-summary)

---

## 1. Overview

The Server Inventory System is built as a **monolith architecture** deployed on **Kubernetes** using **Docker containers**. It consists of a single Spring Boot backend service, an Angular frontend, and a **single SQLite database** containing all tables.

The backend service handles all responsibilities in one place — inventory management, vSphere sync, New Relic sync, ServiceNow CMDB sync, credentials management, and schedule management. The Angular frontend communicates directly with the backend service. External data is pulled from **VMware vSphere**, **New Relic**, and **ServiceNow CMDB** via scheduled sync jobs running inside the backend service.

---

## 2. Architecture Style

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Structure | Monolith (single Spring Boot app) | Simpler to develop, deploy, and maintain for a solo project |
| Communication | Direct internal calls | No inter-service HTTP overhead |
| Frontend | Separate Angular SPA | Decoupled UI, better developer experience |
| Database | Single SQLite file | Lightweight, no external DB server required |
| Credentials | Stored in database, editable via UI | No redeployment needed when credentials change |
| Deployment | Kubernetes | Container orchestration, scaling, and self-healing |
| Containerization | Docker | Consistent runtime across environments |

---

## 3. System Diagram

```
                        ┌─────────────────────────┐
                        │    Angular Frontend       │
                        │  (Kubernetes Deployment)  │
                        └────────────┬────────────┘
                                     │ HTTPS / REST
                                     ▼
                        ┌─────────────────────────────────────┐
                        │         Backend Service              │
                        │         (Spring Boot)                │
                        │         Port: 8080                   │
                        │  ─────────────────────────────────  │
                        │  InventoryController                 │
                        │  DashboardController                 │
                        │  VsphereController                   │
                        │  NewRelicController                  │
                        │  CmdbController                      │
                        │  CredentialController                │
                        │  ReportController                    │
                        │  ScheduleController                  │
                        │  ─────────────────────────────────  │
                        │  VsphereSyncJob (scheduled)          │
                        │  NewRelicSyncJob (scheduled)         │
                        │  CmdbSyncJob (scheduled)             │
                        └────────────────┬────────────────────┘
                                         │
                                         ▼
                        ┌────────────────────────┐
                        │   data/inventory.db     │
                        │      (SQLite)           │
                        │  ─────────────────────  │
                        │  inventory              │
                        │  vsphere                │
                        │  newrelic               │
                        │  cmdb                   │
                        │  credentials            │
                        │  sync_schedule          │
                        └────────────────────────┘

  External Systems:
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐
  │   VMware vSphere │   │    New Relic API  │   │  ServiceNow CMDB     │
  │   (vCenter API)  │   │   (NerdGraph API) │   │  (OAuth2 REST API)   │
  └──────────────────┘   └──────────────────┘   └──────────────────────┘
```

---

## 4. Services

### 4.1 Backend Service

**Technology:** Spring Boot 3.2, Spring Data JPA, Spring Scheduler, SQLite
**Port:** 8080
**Kubernetes:** Deployment + LoadBalancer Service

**Responsibilities:**
- Expose unified read-only search and filter endpoints over the `inventory` VIEW
- Provide dashboard aggregation endpoint (`GET /api/dashboard/assets`) for the Angular frontend
- Seed initial credentials on startup from `credentials-seed.json` if present on the classpath
- Sync VM data from vSphere on a configurable schedule
- Sync entity data from New Relic on a configurable schedule
- Sync asset data from ServiceNow CMDB on a configurable schedule (OAuth2 password grant)
- Manage credentials for vSphere, New Relic, and CMDB (create, update, enable, disable, delete)
- Manage sync schedules for vSphere, New Relic, and CMDB (save, update, enable, disable)
- Enforce authentication (JWT) — **planned, not yet enforced**; currently `permitAll()`
- Handle CORS for the Angular frontend

**Key Endpoints:**
```
GET    /api/inventory                    List all assets from inventory VIEW (paginated; filters: search, operationalStatus, sources)
GET    /api/inventory/counts             Return asset counts: total, vsphere, newrelic, cmdb
GET    /api/inventory/{hostname}         Get full flat asset detail (from inventory VIEW)

GET    /api/dashboard/assets             Paginated search over inventory VIEW (search, page, size)

GET    /api/vsphere                      List all vSphere records (paginated; filters: search, sourceUrls[], powerStates[], guestOsTypes[])
GET    /api/vsphere/vcenter-urls         List distinct source_url values (multi-select filter population)
GET    /api/vsphere/guest-os-types       List distinct guest_os values (multi-select filter population)
GET    /api/vsphere/{hostname}           Get vSphere record by hostname
POST   /api/vsphere/sync                 Trigger manual vSphere sync
GET    /api/vsphere/sync/status          Get last vSphere sync status and timestamp

GET    /api/newrelic                     List all New Relic records (paginated; filters: search, service, environment, accountIds[], linuxDistros[])
GET    /api/newrelic/environments        List distinct environment values (multi-select filter population)
GET    /api/newrelic/accounts            List distinct account_id values (multi-select filter population)
GET    /api/newrelic/linux-distros       List distinct linux_distribution values (multi-select filter population)
GET    /api/newrelic/{hostname}          Get New Relic record by hostname
POST   /api/newrelic/sync                Trigger manual New Relic sync
GET    /api/newrelic/sync/status         Get last New Relic sync status and timestamp

GET    /api/cmdb                         List all CMDB records (paginated; filters: search, opStatuses[], osVersions[])
GET    /api/cmdb/os-versions             List distinct os_version values (multi-select filter population)
GET    /api/cmdb/operational-statuses     List distinct operational_status values (multi-select filter population)
GET    /api/cmdb/{hostname}              Get CMDB record by hostname
POST   /api/cmdb/sync                    Trigger manual CMDB sync
GET    /api/cmdb/sync/status             Get last CMDB sync status and timestamp

GET    /api/settings/credentials                  List all credentials (config never returned)
GET    /api/settings/credentials/{id}             Get credential by ID (sensitive fields masked)
POST   /api/settings/credentials                  Create new credential entry
PUT    /api/settings/credentials/{id}             Update credential entry
PATCH  /api/settings/credentials/{id}/enable      Enable a credential
PATCH  /api/settings/credentials/{id}/disable     Disable a credential
DELETE /api/settings/credentials/{id}             Delete a credential

GET    /api/settings/schedule                     List all sync schedules
GET    /api/settings/schedule/{service}           Get schedule for a service
PUT    /api/settings/schedule/{service}           Save or update schedule for a service
PATCH  /api/settings/schedule/{service}/enable    Enable schedule for a service
PATCH  /api/settings/schedule/{service}/disable   Pause schedule for a service

GET    /api/reports/missing-from-cmdb             Hosts in vSphere/NR but not in CMDB (filters: search, powerState, sources, page, size)
GET    /api/reports/missing-from-cmdb/count       Count of hosts missing from CMDB
GET    /api/reports/ip-discrepancy                Hosts with source IPs not found in CMDB IP list (filters: search, page, size)
```

**Unified Search Query Example:**
```sql
-- inventory is a VIEW — the JOIN logic is inside the VIEW definition.
-- Application queries run directly against it.
SELECT * FROM inventory
WHERE sources LIKE '%vsphere%'
  AND operational_status = '1'
  AND hostname LIKE '%web-prod%'
ORDER BY hostname
LIMIT 20 OFFSET 0;
```

**vSphere Sync Job:**
```
Schedule: Fixed polling interval (every 1 minute) to check sync_schedule table
1. Load sync schedule WHERE service = 'vsphere' AND enabled = 1
2. Check if current time matches the configured cron expression
3. If match:
   a. Query all credentials WHERE service = 'vsphere' AND enabled = 1
   b. For each enabled credential:
      i.  Decrypt config JSON using AES-256 + ENCRYPTION_KEY
      ii. Connect to vCenter API using decrypted host, username, password
      iii.Fetch all VM inventory from that vCenter
      iv. Upsert records into vsphere table
      v.  Update last_synced_at timestamp
      vi. Log sync result (success/failure, record count)
4. Skip if no schedule is enabled or current time does not match
```

**New Relic Sync Job:**
```
Schedule: Fixed polling interval (every 1 minute) to check sync_schedule table
1. Load sync schedule WHERE service = 'newrelic' AND enabled = 1
2. Check if current time matches the configured cron expression
3. If match:
   a. Query all credentials WHERE service = 'newrelic' AND enabled = 1
   b. For each enabled credential:
      i.  Decrypt config JSON using AES-256 + ENCRYPTION_KEY
      ii. Connect to New Relic NerdGraph API using decrypted apiKey and accountId
      iii.Query all infrastructure entities for that account
      iv. Upsert records into newrelic table
      v.  Update last_synced_at timestamp
      vi. Log sync result (success/failure, record count)
4. Skip if no schedule is enabled or current time does not match
```

**CMDB (ServiceNow) Sync Job:**
```
Schedule: Fixed polling interval (every 1 minute) to check sync_schedule table
1. Load sync schedule WHERE service = 'cmdb' AND enabled = 1
2. Check if current time matches the configured cron expression
3. If match:
   a. Query all credentials WHERE service = 'cmdb' AND enabled = 1
   b. For each enabled credential:
      i.   Decrypt config JSON using AES-256 + ENCRYPTION_KEY
      ii.  Extract token_url, api_url, client_id, client_secret, username, password
      iii. POST to token_url with OAuth2 password grant → obtain Bearer token
      iv.  GET api_url with Authorization: Bearer header → receive CMDB asset list
      v.   Map ServiceNow fields to internal model:
             u_ci_name            → hostname
             u_server_os          → os
             u_server_os_version  → osVersion
             u_ci_ip_address      → ipAddress
             u_env_name           → environment
             u_ci_sys_class_name  → classification
             u_ci_install_status  → operationalStatus
      vi.  Upsert records into cmdb table
      vii. Update last_synced_at timestamp
      viii.Log sync result (success/failure, record count)
4. Skip if no schedule is enabled or current time does not match
```

**Package Structure:**
```
com.cox.inventorysystem
├── controller
│   ├── InventoryController.java
│   ├── DashboardController.java
│   ├── VsphereController.java
│   ├── NewRelicController.java
│   ├── CmdbController.java
│   ├── CredentialController.java
│   ├── ReportController.java
│   └── ScheduleController.java
├── service
│   ├── InventoryService.java
│   ├── DashboardService.java
│   ├── CredentialSeedLoader.java
│   ├── VsphereService.java
│   ├── NewRelicService.java
│   ├── CmdbService.java
│   ├── CredentialService.java
│   ├── ScheduleService.java
│   ├── SyncStatusService.java
│   └── EncryptionService.java
├── sync
│   ├── VsphereSyncJob.java
│   ├── NewRelicSyncJob.java
│   └── CmdbSyncJob.java
├── repository
│   ├── InventoryRepository.java
│   ├── VsphereRepository.java
│   ├── NewRelicRepository.java
│   ├── CmdbRepository.java
│   ├── CredentialRepository.java
│   └── ScheduleRepository.java
├── model
│   ├── Inventory.java
│   ├── Vsphere.java
│   ├── NewRelic.java
│   ├── Cmdb.java
│   ├── Credential.java
│   └── SyncSchedule.java
├── dto
│   ├── InventoryResponse.java
│   ├── InventoryCountsResponse.java
│   ├── PagedResponse.java
│   ├── VsphereResponse.java
│   ├── NewRelicResponse.java
│   ├── CmdbResponse.java
│   ├── CredentialRequest.java
│   ├── CredentialResponse.java
│   ├── IpDiscrepancyResponse.java
│   ├── SyncScheduleRequest.java
│   ├── SyncScheduleResponse.java
│   ├── SyncStatusResponse.java
│   └── ErrorResponse.java
├── client
│   ├── VsphereApiClient.java
│   ├── NewRelicApiClient.java
│   └── CmdbApiClient.java
└── exception
    ├── GlobalExceptionHandler.java
    ├── ResourceNotFoundException.java
    ├── ResourceAlreadyExistsException.java
    └── SyncAlreadyRunningException.java
```

---

### 4.2 Frontend (Angular)


**Technology:** Angular 18, Angular CLI, Angular HttpClient, TailwindCSS
**Port:** 4200 (dev) / 80 (production via Nginx)
**Kubernetes:** Deployment + LoadBalancer Service

**Responsibilities:**
- Serve the dashboard UI to system administrators and stakeholders
- Communicate with backend exclusively via REST API
- Display searchable, filterable inventory table
- Display asset detail view with vSphere, New Relic, and CMDB data
- Display summary metrics (total assets by source: vSphere, New Relic, CMDB, and total)

**UI Filter Pattern — Inline Column Header Filters:**

All list screens (Dashboard, vSphere, New Relic, CMDB) use inline column header filters instead of a top filter bar:
- **Hostname column:** debounced text input (`Subject<string>` + 300 ms debounce + `distinctUntilChanged`)
- **Multi-value columns:** reusable `MultiSelectComponent` (checkbox panel, Select All / Clear All, outside-click close)
- Filter params are sent as repeated query string values (`explode: true`); the backend accepts `List<String>` and uses a JPQL `IS NULL` guard (`nullIfEmpty()` helper) so an empty list returns all rows

| Screen | Column Header Filters |
|--------|-----------------------|
| Dashboard | Hostname (text, debounced) |
| vSphere | Hostname (text), vCenter URL (multi-select), Power State (multi-select), Guest OS (multi-select) |
| New Relic | Hostname (text), Service (text), Environment (text), Account ID (multi-select), Linux Distro (multi-select) |
| Missing from CMDB | Hostname (text), Sources (multi-select), Power State (multi-select) |
| IP Discrepancy | Hostname (text) |
| CMDB | Hostname (text), OS Version (multi-select), Op Status (multi-select) |

**Shared Components (`frontend/src/app/shared/components/`):**
- `multi-select/multi-select.component.ts` — Standalone Angular component; accepts `options: string[]`, optional `labelFn`, emits `selectionChange: string[]`; renders a checkbox panel with Select All / Clear All and closes on outside click

**CSV Export:**
Both report pages (Missing from CMDB and IP Discrepancy) include an "Export CSV" button. CSV export is implemented entirely in the frontend — it re-requests the same API endpoint with `size=10000` and `page=0`, respecting all currently active filters, so it exports all matching records (up to 10,000), not just the current page. No dedicated CSV export backend endpoint exists.

**Key Routes:**
```
/                             Dashboard (summary metrics + inventory table)
/inventory/:hostname          Asset detail page
/vsphere                      vSphere data view
/newrelic                     New Relic data view
/cmdb                         CMDB (ServiceNow) data view
/reports/missing-from-cmdb    Hosts in vSphere/NR but not in CMDB
/reports/ip-discrepancy       Hosts with IP address discrepancies vs CMDB
/settings/credentials         Credentials management page (vSphere, New Relic, CMDB)
/settings/schedule            Sync schedule management (day + time picker per service)
```

**Environment Configuration (`src/environments/environment.prod.ts`):**
```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'http://backend-service:8080'
};
```

---

## 5. Data Flow

### 5.1 User Views Inventory (Read Flow)
```
1. User opens Angular app in browser
2. Angular fetches GET /api/dashboard/assets from Backend Service
3. Backend Service queries the inventory VIEW (JOIN logic handled inside the VIEW)
4. Response flows back to Angular
5. Angular renders the enriched inventory table
```

### 5.2 vSphere Sync (Scheduled Flow)
```
1. Backend Service polls sync_schedule table every 1 minute
2. If current time matches the configured cron for 'vsphere' and enabled = 1
3. VsphereApiClient connects to each enabled vCenter
4. All VM records are fetched per vCenter
5. Records are upserted into vsphere table in data/inventory.db
6. last_synced_at is updated
7. Sync result is logged
```

### 5.3 CMDB Sync (Scheduled Flow)
```
1. Backend Service polls sync_schedule table every 1 minute
2. If current time matches the configured cron for 'cmdb' and enabled = 1
3. CmdbApiClient obtains OAuth2 Bearer token from ServiceNow token_url
4. CmdbApiClient calls api_url with Bearer token to retrieve asset list
5. Each record is mapped from ServiceNow field names to internal model
6. Records are upserted into cmdb table in data/inventory.db
7. last_synced_at is updated
8. Sync result is logged
```

### 5.4 Manual Sync Trigger (On-Demand Flow)
```
1. Admin clicks "Sync Now" in Angular UI
2. Angular calls POST /api/{service}/sync to Backend Service
3. Backend marks status as 'running' and spawns a background thread
4. HTTP 202 Accepted returned immediately
5. Frontend polls GET /api/{service}/sync/status every 3 seconds
6. Badge updates automatically when status changes to 'success' or 'failed'
```

### 5.5 User Updates Sync Schedule (Config Flow)
```
1. Admin opens /settings/schedule in Angular UI
2. Admin selects service (vsphere, newrelic, or cmdb), day(s), and time
3. Angular calls PUT /api/settings/schedule/{service} to Backend Service
4. Backend Service converts selection to cron expression
5. Cron expression saved to sync_schedule table in data/inventory.db
6. Sync job picks up new schedule on its next 1-minute poll
```

---

## 6. Database Design

All data is stored in a **single SQLite database file** (`data/inventory.db`) owned by the Backend Service and mounted via a PersistentVolumeClaim in Kubernetes.

| Table | Access Type |
|-------|-------------|
| `inventory` | Read Only (SQL VIEW — never written to directly) |
| `vsphere` | Read / Write (upsert during sync, query via API) |
| `newrelic` | Read / Write (upsert during sync, query via API) |
| `cmdb` | Read / Write (upsert during sync, query via API) |
| `credentials` | Read / Write (save via API, load at sync time) |
| `sync_schedule` | Read / Write (save via API, checked on each poll) |

**Credentials Table**

vSphere, New Relic, and CMDB connection credentials are stored in a `credentials` table in the database. Multiple accounts per service are supported — for example, multiple vCenter instances, multiple New Relic accounts, or multiple ServiceNow instances. Each credential entry has an `enabled` flag that controls whether the sync job will use it. Passwords and API keys are encrypted at rest using AES-256. The Backend Service reloads enabled credentials before each sync job run, so changes take effect without restarting.

```sql
CREATE TABLE credentials (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    service     TEXT        NOT NULL,             -- 'vsphere', 'newrelic', or 'cmdb'
    name        TEXT        NOT NULL,             -- user-defined label e.g. 'Name|AccountId'
    config      TEXT        NOT NULL,             -- AES-256 encrypted JSON
    enabled     INTEGER     NOT NULL DEFAULT 1,   -- 1 = enabled, 0 = disabled
    created_at  DATETIME    NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME    NOT NULL DEFAULT (datetime('now')),

    UNIQUE(service, name)
);

CREATE INDEX idx_credentials_service_enabled ON credentials(service, enabled);
```

The `config` column stores an encrypted JSON string. When decrypted, the structure is:

For vSphere:
```json
{
  "host": "vcenter.example.com",
  "username": "admin@vsphere.local",
  "password": "secret"
}
```

For New Relic:
```json
{
  "apiKey": "NRAK-xxxxxxxxxxxx",
  "accountId": "12345"
}
```

For CMDB (ServiceNow):
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

**Example rows:**

| id | service   | name                    | enabled | config (encrypted) |
|----|-----------|-------------------------|---------|--------------------|
| 1  | vsphere   | Name|AccountId      | 1       | xxxxxxxx           |
| 2  | vsphere   | DR vCenter              | 0       | xxxxxxxx           |
| 3  | newrelic  | Production Account      | 1       | xxxxxxxx           |
| 4  | newrelic  | Dev Account             | 1       | xxxxxxxx           |

Sync services query only `enabled = 1` credentials and iterate over all matching rows, syncing data from each active account in sequence.

**Sync Schedule Table**

The sync schedule for each service is stored in the `sync_schedule` table. Users can configure the day(s) and time the sync should run via the UI. The schedule is stored as a cron expression, which the Backend Service evaluates on every 1-minute poll.

```sql
CREATE TABLE sync_schedule (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    service     TEXT        NOT NULL UNIQUE,   -- 'vsphere', 'newrelic', or 'cmdb'
    cron_expr   TEXT        NOT NULL,          -- standard cron e.g. '0 0 2 * * MON-FRI'
    enabled     INTEGER     NOT NULL DEFAULT 1, -- 1 = active, 0 = paused
    description TEXT,                          -- human-readable e.g. 'Weekdays at 2:00 AM'
    last_run_at DATETIME,                      -- timestamp of last successful trigger
    updated_at  DATETIME    NOT NULL DEFAULT (datetime('now'))
);
```

**Cron Expression Format:** `seconds minutes hours day-of-month month day-of-week`

| Example Schedule | Cron Expression |
|-----------------|-----------------|
| Every day at 2:00 AM | `0 0 2 * * *` |
| Weekdays at 6:00 AM | `0 0 6 * * MON-FRI` |
| Every Monday at midnight | `0 0 0 * * MON` |
| Weekends at 11:00 PM | `0 0 23 * * SAT,SUN` |
| Every 6 hours | `0 0 0/6 * * *` |

**Example rows:**

| id | service  | cron_expr           | enabled | description            |
|----|----------|---------------------|---------|------------------------|
| 1  | vsphere  | `0 0 2 * * *`       | 1       | Every day at 2:00 AM   |
| 2  | newrelic | `0 0 6 * * MON-FRI` | 1       | Weekdays at 6:00 AM    |
| 3  | cmdb     | `0 0 3 * * *`       | 0       | Every day at 3:00 AM   |

The AES encryption key itself is the **only secret** that remains in a Kubernetes Secret (one key, not per-service credentials):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: encryption-key
type: Opaque
stringData:
  ENCRYPTION_KEY: your-32-byte-aes-key-here
```

**WAL Mode (Recommended)**

WAL mode is recommended to improve read concurrency between the REST API threads and the background sync jobs running within the same service:

```sql
PRAGMA journal_mode=WAL;
```

Configured via JDBC URL parameters in `application.properties`:
```properties
spring.datasource.url=jdbc:sqlite:${DB_PATH:./data/inventory.db}?journal_mode=WAL&busy_timeout=5000
```

See `@docs/database-schema.md` for full DDL and column definitions.

---

## 7. API Design

- All APIs follow REST conventions
- All responses are JSON
- All list endpoints support pagination: `?page=0&size=20`
- All list endpoints support filtering: `?environment=production&status=active`
- HTTP status codes: `200`, `201`, `204`, `400`, `404`, `409`, `500`
- **Authentication is not currently enforced** — Spring Security is configured with `permitAll()` for all routes; 401 is never returned
- Error response format:

```json
{
  "status": 404,
  "error": "Not Found",
  "message": "Asset with hostname 'web-01' not found",
  "timestamp": "2026-02-27T10:00:00Z"
}
```

See `docs/openapi.yaml` for full OpenAPI specification.

---

## 8. Infrastructure & Deployment

### 8.1 Kubernetes Resources

Each service has the following Kubernetes resources:

```
├── k8s/
│   ├── backend-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml          # LoadBalancer
│   │   ├── configmap.yaml
│   │   ├── persistentvolumeclaim.yaml   # inventory.db PVC
│   │   └── secret.yaml                 # AES encryption key
│   └── frontend/
│       ├── deployment.yaml
│       └── service.yaml          # LoadBalancer
```

### 8.2 Persistent Volumes

The Backend Service uses a single **PersistentVolumeClaim** mounted at `/data/inventory.db` to persist the SQLite database across pod restarts:

```yaml
# PVC for inventory.db
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: inventory-db-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 2Gi
```

### 8.3 Secrets Management

vSphere and New Relic credentials are **stored in the database** (encrypted) and managed by the user via the UI. The only Kubernetes Secret required is the **AES encryption key** used to encrypt/decrypt credentials at rest:

```yaml
# Shared encryption key - the only Kubernetes Secret needed
apiVersion: v1
kind: Secret
metadata:
  name: encryption-key
type: Opaque
stringData:
  ENCRYPTION_KEY: your-32-byte-aes-key-here
```

This key is injected as an environment variable into the Backend Service so it can encrypt and decrypt credentials:

```yaml
env:
  - name: ENCRYPTION_KEY
    valueFrom:
      secretKeyRef:
        name: encryption-key
        key: ENCRYPTION_KEY
```

**Credential flow:**
```
1. Admin opens /settings/credentials in Angular UI
2. Admin creates a new credential entry (e.g. "Name|AccountId")
3. Admin enters service type, name, host/username/password or API key
4. Admin sets enabled = true or false
5. Angular calls POST /api/settings/credentials to Backend Service
6. Backend Service encrypts the config JSON using AES-256 + ENCRYPTION_KEY
7. Encrypted credential is saved to credentials table in data/inventory.db
8. At next sync, Backend Service queries WHERE service = 'vsphere' AND enabled = 1
9. Each enabled credential is decrypted and used to sync from that account
10. Disabled credentials are silently skipped
```

### 8.4 Docker Images

Two Docker images are built — one for the backend, one for the frontend.

**Backend (`Dockerfile`):** Multi-stage build using `eclipse-temurin:17` builder and `eclipse-temurin:17-jre-alpine` runtime. The SQLite CLI (`sqlite3`) is installed via `apk add --no-cache sqlite` for in-container DB inspection. The `data/` directory is created at image build time and the JAR is the entrypoint.

**Frontend (`frontend/Dockerfile`):** Multi-stage build — `node:20-alpine` compiles the Angular app, then `nginx:alpine` serves the compiled SPA. The `frontend/nginx.conf` provides SPA fallback (`try_files $uri /index.html`), `/api/` reverse-proxy to the backend, gzip compression, and security headers.

---

## 9. Security

| Concern | Approach |
|---------|----------|
| Authentication | JWT (JJWT 0.12) — **planned, not yet enforced**; Spring Security currently uses `permitAll()` |
| vSphere, New Relic & CMDB credentials | Stored encrypted (AES-256) in database, editable via UI |
| Encryption key | AES key stored as Kubernetes Secret, injected as env variable |
| Credential masking | `GET /api/settings/credentials` list endpoint returns metadata only — `config` is never decrypted on list; `GET /api/settings/credentials/{id}` decrypts and returns config with sensitive fields (`password`, `apiKey`, `client_secret`) masked as `"********"` |
| HTTPS | TLS terminated at Backend Service (LoadBalancer) |
| CORS | Configured in Backend Service to allow Angular frontend origin only |
| No internal traffic | Single service — no inter-service communication needed |

---

## 10. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Angular + Angular CLI + TailwindCSS | Angular 18 |
| Backend Service | Spring Boot + Spring Data JPA + Spring Scheduler | 3.2 |
| Database | SQLite | 3.x |
| ORM | Hibernate + SQLite Dialect | 6.x |
| Build Tool | Gradle | 8.x |
| Java | Eclipse Temurin | 17 (LTS) |
| Logging | Logback (rolling file, `logs/`, 30-day retention) | (Spring Boot default) |
| Containerization | Docker | latest |
| Orchestration | Kubernetes | 1.29+ |
| CI/CD | GitHub Actions | - |
