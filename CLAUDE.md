# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Spring Boot)
```bash
# Build
./gradlew build

# Run (dev)
./gradlew bootRun

# Run tests
./gradlew test

# Run a single test class
./gradlew test --tests "com.cox.inventorysystem.service.InventoryServiceTest"

# Clean build
./gradlew clean build
```

### Frontend (Angular)
```bash
cd frontend

# Install dependencies (required before first run)
npm install

# Dev server (http://localhost:4200)
npm start

# Production build
npm run build:prod

# Run tests
npm test
```

### Required Environment Variables
- `ENCRYPTION_KEY` — 32-byte (256-bit) key for AES-256-GCM credential encryption (mandatory at runtime; a dev default is set in `application.properties`)
- `app.cors.allowed-origins` — CORS origin for frontend (default: `http://localhost:4200`)
- `DB_PATH` — SQLite file path (default: `./data/inventory.db`)

### Git Remotes
Two remotes are configured:
```bash
# Push to GitHub (main branch)
git -c http.sslVerify=false push origin main

# Push to Cox Bitbucket (staging branch)
git push cox main:staging

# Pull / fetch (GitHub only)
git -c http.sslVerify=false pull --rebase
```
`http.sslVerify=false` is required for GitHub due to the corporate SSL proxy. The `cox` remote uses SSH and does not need it.

---

## Architecture

### Overview
Monolith with two independently deployed services:
- **Backend:** Spring Boot 3.2 / Java 17 on port 8080
- **Frontend:** Angular 18 on port 4200 (dev) / 80 (prod via nginx)
- **Database:** Single SQLite 3.45 file with WAL mode, HikariCP pool size forced to 1 (`data/inventory.db`)

### Backend Layer Structure
```
controller/ → service/ → repository/ → model/
                ↓
            client/    (external API calls: VsphereApiClient, NewRelicApiClient, CmdbApiClient)
            sync/      (scheduled jobs: VsphereSyncJob, NewRelicSyncJob, CmdbSyncJob)
            dto/       (request/response DTOs — never expose entities directly)
            exception/ (GlobalExceptionHandler + ResourceNotFoundException, ResourceAlreadyExistsException, SyncAlreadyRunningException)
            config/    (WebConfig: CORS + Spring Security permitAll)
```

All controllers use constructor injection via Lombok `@RequiredArgsConstructor`. Services own all business logic; repositories are pure Spring Data JPA interfaces.

### Critical Design Constraints

**`inventory` is a read-only SQL VIEW**, not a table. It is defined in `V1__init_schema.sql` as a UNION + LEFT JOIN over `vsphere`, `newrelic`, and `cmdb` keyed on `hostname`. The `Inventory` JPA entity maps to this view. Never try to write to it.

**No foreign keys** — `hostname` (String PK) is the natural join key across `vsphere`, `newrelic`, and `cmdb` tables. Joins are resolved at the application layer.

**No JPA relationships** (`@OneToOne`, etc.) between entities by design.

**JPQL filter guard pattern** — repositories use `IS NULL` (not `IS EMPTY`) as the "no filter" guard. Services pass `null` (via `nullIfBlank()`) rather than an empty list. Pattern:
```java
// Service
nullIfBlank(search)   // returns null if blank, value otherwise

// Repository JPQL
AND (:param IS NULL OR field LIKE CONCAT('%', :param, '%'))
```

**Credentials** are AES-256-GCM encrypted via `EncryptionService` before writing to the `credentials` table. The `GET /api/settings/credentials` list endpoint never decrypts `config` — secrets never travel over the wire on list calls.

**`operationalStatus`** is stored as ServiceNow numeric codes (`'1'`=Operational, `'2'`=Repair in Progress, `'3'`=Do Not Use, `'6'`=Retired, `'7'`=Stolen) — **never** English labels. All `opStatusClass()` and `opStatusLabel()` methods must match on these numeric strings.

### Sync Scheduling
All three sync jobs (`VsphereSyncJob`, `NewRelicSyncJob`, `CmdbSyncJob`) run on `@Scheduled(fixedDelay = 60_000)`. Each job reads its row from `sync_schedule`, evaluates the cron expression with Spring's `CronExpression.parse()`, and runs only if due. `SyncStatusService` (in-memory `ConcurrentHashMap`) prevents concurrent runs and tracks last error. `markSuccess()` clears `lastError` — do not preserve it.

### IP Discrepancy Report
`listIpDiscrepancies()` in `InventoryService` loads all CMDB candidates into memory (no DB-level pagination), filters with `IpDiscrepancyResponse.isDiscrepancy()`, sorts by first IPv4, then paginates in Java. `IpDiscrepancyResponse` sorts IPv4s in its constructor via `sortedIpv4()` → `ipToLong()`.

### Credential Seeding
`CredentialSeedLoader` seeds from `credentials-seed.json` on the classpath at startup. This file is gitignored and must be created locally.

### Security Status
Spring Security is configured in `WebConfig.java` with `permitAll()` for all routes — **JWT authentication is not yet implemented**. Do not add auth guards without implementing the backend JWT filter first.

### Database Migrations
Flyway 10 manages schema via `src/main/resources/db/migration/V1__init_schema.sql`. All schema changes must go through a new versioned migration file (`V2__`, `V3__`, etc.). `ddl-auto=none`.

---

## Frontend Patterns

### Component structure
Angular 18 standalone components (no NgModules). Services use `inject(HttpClient)` pattern. All list screens follow the same shape: inline column-header filters, debounced search, `loadImmediate()` for filter/page changes.

### Debounced search
All list screens use a `Subject<string>` (not `Subject<void>`) fed into `debounceTime(300) + distinctUntilChanged() + switchMap`. The subject carries the current search string so `distinctUntilChanged()` compares values correctly.

### Multi-select filters
`MultiSelectComponent` (`shared/components/multi-select/`) is used for all dropdown column filters. It emits `string[]` via `(selectedChange)`. Multi-value params are sent as repeated query params (`?powerState=poweredOn&powerState=poweredOff`). When only one value is selected, send as a single `@RequestParam`; the backend receives `List<String>` and uses the `IS NULL` JPQL guard via `nullIfEmpty()`.

### Page-size select binding
Always use `[ngValue]` (not `[value]`) on `<option>` elements for numeric page-size values. `[value]` coerces to string and breaks `[(ngModel)]` two-way binding.

### CSV export
Export buttons re-request the same endpoint with `page=0, size=10000` and all active filters, then build a `Blob` and trigger a download. There is no dedicated backend export endpoint.

### `toDisplayRow()` pattern
List components precompute a display-shape object (`VsphereDisplayRow`, etc.) once per row to avoid calling format/sort helpers on every change-detection cycle. Use this pattern for any derived display values (formatted timestamps, sorted IPs, badge classes).

---

## Key Files

| Purpose | Path |
|---|---|
| Spring Boot entry | `src/main/java/com/cox/inventorysystem/InventorySystemApplication.java` |
| CORS + Security config | `src/main/java/com/cox/inventorysystem/config/WebConfig.java` |
| Encryption service | `src/main/java/com/cox/inventorysystem/service/EncryptionService.java` |
| Sync status tracking | `src/main/java/com/cox/inventorysystem/service/SyncStatusService.java` |
| IP discrepancy DTO (sort + filter logic) | `src/main/java/com/cox/inventorysystem/dto/IpDiscrepancyResponse.java` |
| DB migration | `src/main/resources/db/migration/V1__init_schema.sql` |
| App config | `src/main/resources/application.properties` |
| Logging config | `src/main/resources/logback-spring.xml` |
| Backend Dockerfile | `Dockerfile` (runtime user: `coxapp`) |
| Frontend Dockerfile | `frontend/Dockerfile` |
| Frontend nginx config | `frontend/nginx.conf` |
| API contract | `docs/openapi.yaml` |
| Angular routes | `frontend/src/app/app.routes.ts` |
| API base URL | `frontend/src/environments/environment.ts` |
| Shared multi-select | `frontend/src/app/shared/components/multi-select/multi-select.component.ts` |
