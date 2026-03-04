# Architecture Overview
## Server Inventory System

**Version:** 1.0
**Author:** Solo Developer
**Last Updated:** 2026-02-27
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Style](#2-architecture-style)
3. [System Diagram](#3-system-diagram)
4. [Services](#4-services)
   - [Backend Service](#41-backend-service)
   - [Frontend (React)](#42-frontend-react)
5. [Data Flow](#5-data-flow)
6. [Database Design](#6-database-design)
7. [API Design](#7-api-design)
8. [Infrastructure & Deployment](#8-infrastructure--deployment)
9. [Security](#9-security)
10. [Technology Stack Summary](#10-technology-stack-summary)

---

## 1. Overview

The Server Inventory System is built as a **monolith architecture** deployed on **Kubernetes** using **Docker containers**. It consists of a single Spring Boot backend service, a React frontend, and a **single SQLite database** containing all tables.

The backend service handles all responsibilities in one place — inventory management, vSphere sync, New Relic sync, credentials management, and schedule management. The React frontend communicates directly with the backend service. External data is pulled from **VMware vSphere** and **New Relic** via scheduled sync jobs running inside the backend service.

---

## 2. Architecture Style

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Structure | Monolith (single Spring Boot app) | Simpler to develop, deploy, and maintain for a solo project |
| Communication | Direct internal calls | No inter-service HTTP overhead |
| Frontend | Separate React SPA | Decoupled UI, better developer experience |
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
                        │  VsphereController                   │
                        │  NewRelicController                  │
                        │  CredentialsController               │
                        │  ScheduleController                  │
                        │  ─────────────────────────────────  │
                        │  VsphereSyncJob (scheduled)          │
                        │  NewRelicSyncJob (scheduled)         │
                        └────────────────┬────────────────────┘
                                         │
                                         ▼
                        ┌────────────────────────┐
                        │      inventory.db       │
                        │      (SQLite)           │
                        │  ─────────────────────  │
                        │  inventory              │
                        │  vsphere                │
                        │  newrelic               │
                        │  credentials            │
                        │  sync_schedule          │
                        └────────────────────────┘

  External Systems:
  ┌──────────────────┐     ┌──────────────────┐
  │   VMware vSphere │     │    New Relic API  │
  │   (vCenter API)  │     │   (NerdGraph API) │
  └──────────────────┘     └──────────────────┘
```

---

## 4. Services

### 4.1 Backend Service

**Technology:** Spring Boot 3.2, Spring Data JPA, Spring Scheduler, SQLite
**Port:** 8080
**Kubernetes:** Deployment + LoadBalancer Service

**Responsibilities:**
- Manage the `inventory` table (CRUD operations)
- Expose unified search and filter endpoints across all three tables
- Perform SQL JOINs across `inventory`, `vsphere`, and `newrelic` tables
- Sync VM data from vSphere on a configurable schedule
- Sync entity data from New Relic on a configurable schedule
- Manage credentials for vSphere and New Relic (create, update, enable, disable, delete)
- Manage sync schedules for vSphere and New Relic (save, update, enable, disable)
- Enforce authentication (JWT)
- Handle CORS for the React frontend

**Key Endpoints:**
```
GET    /api/inventory                    List all assets with vsphere+newrelic data (paginated, filterable)
GET    /api/inventory/{hostname}         Get full asset detail (inventory + vsphere + newrelic)
POST   /api/inventory                    Create new asset
PUT    /api/inventory/{hostname}         Update asset
DELETE /api/inventory/{hostname}         Delete asset

GET    /api/vsphere                      List all vSphere records (paginated)
GET    /api/vsphere/{hostname}           Get vSphere record by hostname
POST   /api/vsphere/sync                 Trigger manual vSphere sync
GET    /api/vsphere/sync/status          Get last vSphere sync status and timestamp

GET    /api/newrelic                     List all New Relic records (paginated)
GET    /api/newrelic/{hostname}          Get New Relic record by hostname
POST   /api/newrelic/sync                Trigger manual New Relic sync
GET    /api/newrelic/sync/status         Get last New Relic sync status and timestamp

GET    /api/credentials                  List all credentials (passwords masked)
GET    /api/credentials/{id}             Get credential by ID (password masked)
POST   /api/credentials                  Create new credential entry
PUT    /api/credentials/{id}             Update credential entry
PATCH  /api/credentials/{id}/enable      Enable a credential
PATCH  /api/credentials/{id}/disable     Disable a credential
DELETE /api/credentials/{id}             Delete a credential

GET    /api/schedule                     List all sync schedules
GET    /api/schedule/{service}           Get schedule for a service
PUT    /api/schedule/{service}           Save or update schedule for a service
PATCH  /api/schedule/{service}/enable    Enable schedule for a service
PATCH  /api/schedule/{service}/disable   Pause schedule for a service
```

**Unified Search Query Example:**
```sql
SELECT i.*, v.*, n.*
FROM inventory i
LEFT JOIN vsphere v ON i.hostname = v.hostname
LEFT JOIN newrelic n ON i.hostname = n.hostname
WHERE i.environment = 'production'
  AND i.status = 'active'
  AND v.power_state = 'poweredOn'
  AND n.reporting = 1
ORDER BY i.hostname
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

**Package Structure:**
```
com.example.inventorysystem
├── controller
│   ├── InventoryController.java
│   ├── VsphereController.java
│   ├── NewRelicController.java
│   ├── CredentialsController.java
│   └── ScheduleController.java
├── service
│   ├── InventoryService.java
│   ├── VsphereService.java
│   ├── NewRelicService.java
│   ├── CredentialsService.java
│   ├── ScheduleService.java
│   ├── VsphereSyncJob.java
│   └── NewRelicSyncJob.java
├── repository
│   ├── InventoryRepository.java
│   ├── VsphereRepository.java
│   ├── NewRelicRepository.java
│   ├── CredentialsRepository.java
│   └── ScheduleRepository.java
├── model
│   ├── Inventory.java
│   ├── Vsphere.java
│   ├── NewRelic.java
│   ├── Credential.java
│   └── SyncSchedule.java
├── dto
│   ├── InventoryRequest.java
│   ├── InventoryResponse.java
│   ├── VsphereResponse.java
│   ├── NewRelicResponse.java
│   ├── CredentialRequest.java
│   ├── CredentialResponse.java
│   └── SyncStatusResponse.java
├── client
│   ├── VsphereApiClient.java
│   └── NewRelicApiClient.java
└── exception
    └── GlobalExceptionHandler.java
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
- Display asset detail view with vSphere and New Relic data
- Display summary metrics (total assets, by environment, by status)

**Key Routes:**
```
/                          Dashboard (summary metrics + inventory table)
/inventory/:hostname       Asset detail page
/vsphere                   vSphere data view
/newrelic                  New Relic data view
/settings/credentials      Credentials management page (vSphere + New Relic)
/settings/schedule         Sync schedule management (day + time picker per service)
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
1. User opens React app in browser
2. React fetches GET /api/inventory from Backend Service
3. Backend Service executes JOIN query across inventory, vsphere, newrelic tables
4. Response flows back to React
5. React renders the enriched inventory table
```

### 5.2 vSphere Sync (Scheduled Flow)
```
1. Backend Service polls sync_schedule table every 1 minute
2. If current time matches the configured cron for 'vsphere' and enabled = 1
3. VsphereApiClient connects to each enabled vCenter
4. All VM records are fetched per vCenter
5. Records are upserted into vsphere table in inventory.db
6. last_synced_at is updated
7. Sync result is logged
```

### 5.3 Manual Sync Trigger (On-Demand Flow)
```
1. Admin clicks "Sync Now" in React UI
2. React calls POST /api/vsphere/sync to Backend Service
3. Sync job runs immediately
4. Response returns sync status to UI
```

### 5.4 User Updates Sync Schedule (Config Flow)
```
1. Admin opens /settings/sync-schedule in React UI
2. Admin selects service (vsphere or newrelic), day(s), and time
3. React calls PUT /api/schedule/{service} to Backend Service
4. Backend Service converts selection to cron expression
5. Cron expression saved to sync_schedule table in inventory.db
6. Sync job picks up new schedule on its next 1-minute poll
```

---

## 6. Database Design

All data is stored in a **single SQLite database file** (`inventory.db`) owned by the Backend Service and mounted via a PersistentVolumeClaim in Kubernetes.

| Table | Access Type |
|-------|-------------|
| `inventory` | Read / Write + JOIN across all tables |
| `vsphere` | Read / Write (upsert during sync, query via API) |
| `newrelic` | Read / Write (upsert during sync, query via API) |
| `credentials` | Read / Write (save via API, load at sync time) |
| `sync_schedule` | Read / Write (save via API, checked on each poll) |

**Credentials Table**

vSphere and New Relic connection credentials are stored in a `credentials` table in the database. Multiple accounts per service are supported — for example, multiple vCenter instances or multiple New Relic accounts. Each credential entry has an `enabled` flag that controls whether the sync job will use it. Passwords and API keys are encrypted at rest using AES-256. The Backend Service reloads enabled credentials before each sync job run, so changes take effect without restarting.

```sql
CREATE TABLE credentials (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    service     TEXT        NOT NULL,             -- 'vsphere' or 'newrelic'
    name        TEXT        NOT NULL,             -- user-defined label e.g. 'Production vCenter'
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

**Example rows:**

| id | service   | name                    | enabled | config (encrypted) |
|----|-----------|-------------------------|---------|--------------------|
| 1  | vsphere   | Production vCenter      | 1       | xxxxxxxx           |
| 2  | vsphere   | DR vCenter              | 0       | xxxxxxxx           |
| 3  | newrelic  | Production Account      | 1       | xxxxxxxx           |
| 4  | newrelic  | Dev Account             | 1       | xxxxxxxx           |

Sync services query only `enabled = 1` credentials and iterate over all matching rows, syncing data from each active account in sequence.

**Sync Schedule Table**

The sync schedule for each service is stored in the `sync_schedule` table. Users can configure the day(s) and time the sync should run via the UI. The schedule is stored as a cron expression, which the Backend Service evaluates on every 1-minute poll.

```sql
CREATE TABLE sync_schedule (
    id          INTEGER     PRIMARY KEY AUTOINCREMENT,
    service     TEXT        NOT NULL UNIQUE,   -- 'vsphere' or 'newrelic'
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

| id | service  | cron_expr        | enabled | description            |
|----|----------|------------------|---------|------------------------|
| 1  | vsphere  | `0 0 2 * * *`    | 1       | Every day at 2:00 AM   |
| 2  | newrelic | `0 0 6 * * MON-FRI` | 1    | Weekdays at 6:00 AM    |

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

Configure in `application.properties`:
```properties
spring.datasource.url=jdbc:sqlite:/data/inventory.db
spring.datasource.hikari.connection-init-sql=PRAGMA journal_mode=WAL;
```

See `@docs/database-schema.md` for full DDL and column definitions.

---

## 7. API Design

- All APIs follow REST conventions
- All responses are JSON
- All list endpoints support pagination: `?page=0&size=20`
- All list endpoints support filtering: `?environment=production&status=active`
- HTTP status codes: `200`, `201`, `204`, `400`, `401`, `404`, `500`
- Error response format:

```json
{
  "timestamp": "2026-02-27T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "message": "Asset with hostname 'web-01' not found",
  "path": "/api/inventory/web-01"
}
```

See `@docs/api-spec.yaml` for full OpenAPI specification.

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
1. Admin opens /settings/credentials in React UI
2. Admin creates a new credential entry (e.g. "Production vCenter")
3. Admin enters service type, name, host/username/password or API key
4. Admin sets enabled = true or false
5. React calls POST /api/credentials to Backend Service
6. Backend Service encrypts the config JSON using AES-256 + ENCRYPTION_KEY
7. Encrypted credential is saved to credentials table in inventory.db
8. At next sync, Backend Service queries WHERE service = 'vsphere' AND enabled = 1
9. Each enabled credential is decrypted and used to sync from that account
10. Disabled credentials are silently skipped
```

### 8.4 Docker Images

Two Docker images are needed — one for the backend, one for the frontend:

```dockerfile
# Backend Service
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/inventory-system.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

```dockerfile
# Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build -- --output-path=dist

FROM nginx:alpine
COPY --from=build /app/dist/inventory-app/browser /usr/share/nginx/html
```

---

## 9. Security

| Concern | Approach |
|---------|----------|
| Authentication | JWT token — issued on login, validated in Backend Service |
| vSphere & New Relic credentials | Stored encrypted (AES-256) in database, editable via UI |
| Encryption key | AES key stored as Kubernetes Secret, injected as env variable |
| Credential masking | GET /api/credentials returns masked password/key (never plaintext) |
| HTTPS | TLS terminated at Backend Service (LoadBalancer) |
| CORS | Configured in Backend Service to allow React frontend origin only |
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
| Java | Eclipse Temurin | 21 (LTS) |
| Containerization | Docker | latest |
| Orchestration | Kubernetes | 1.29+ |
| CI/CD | GitHub Actions | - |
