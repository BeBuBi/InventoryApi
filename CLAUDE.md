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
./gradlew test --tests "com.example.inventorysystem.service.InventoryServiceTest"

# Clean build
./gradlew clean build
```

### Frontend (Angular)
```bash
cd frontend

# Install dependencies
npm install

# Dev server (http://localhost:4200)
npm start

# Production build
npm run build:prod

# Run tests
npm test
```

### Required Environment Variables
- `ENCRYPTION_KEY` — 32-byte (256-bit) key for AES-256-GCM credential encryption (mandatory at runtime)
- `app.cors.allowed-origins` — CORS origin for frontend (default: `http://localhost:4200`)

---

## Architecture

### Overview
Monolith with two independently deployed services:
- **Backend:** Spring Boot 3.2.5 / Java 21 on port 8080
- **Frontend:** Angular 18 on port 4200 (dev) / 80 (prod via nginx)
- **Database:** Single SQLite 3.45 file with WAL mode (`inventory.db` in working directory)

### Backend Layer Structure
```
controller/ → service/ → repository/ → model/
                ↓
            client/   (external API calls: vSphere REST, New Relic NerdGraph)
            sync/     (scheduled jobs: VsphereSyncJob, NewRelicSyncJob)
            dto/      (request/response DTOs — never expose entities directly)
            exception/ (GlobalExceptionHandler + domain exceptions)
            config/   (WebConfig: CORS + Spring Security open permit-all)
```

All controllers use constructor injection via Lombok `@RequiredArgsConstructor`. Services own business logic; repositories are pure Spring Data JPA interfaces.

### Key Design Constraints
- **No foreign keys** — `hostname` (String PK) is the natural join key, resolved at the application layer in `InventoryService.getDetail()` which manually assembles `AssetDetailResponse` from three repositories.
- **No JPA relationships** (`@OneToOne`, etc.) between entities by design.
- **Hostname is the PK** for `inventory`, `vsphere`, and `newrelic` tables.
- **Credentials are AES-256-GCM encrypted** via `EncryptionService` before persisting to the `credentials` table. The key comes from `ENCRYPTION_KEY` env var.

### Sync Scheduling
`VsphereSyncJob` and `NewRelicSyncJob` run on a `@Scheduled(fixedDelay = 60_000)` loop. Each job reads its row from `sync_schedule`, evaluates the stored cron expression with `CronExpression`, and runs only if due. Concurrent runs are prevented via `SyncStatusService`.

### Frontend Structure
Angular 18 standalone components (no NgModules). Services use `inject(HttpClient)` pattern. API base URL is set in `src/environments/environment.ts` as `apiBaseUrl`.

### Security Status
Spring Security is configured in `WebConfig.java` with `permitAll()` for all routes — **JWT authentication is stubbed but not implemented**. JJWT 0.12 dependency is present. Do not add auth guards without implementing the backend JWT filter first.

### Database Migrations
Flyway 10 manages schema via `src/main/resources/db/migration/V1__init_schema.sql`. All schema changes must go through a new versioned migration file (V2__, V3__, etc.).

---

## Key Files

| Purpose | Path |
|---|---|
| Spring Boot entry | `src/main/java/com/example/inventorysystem/InventorySystemApplication.java` |
| CORS + Security config | `src/main/java/com/example/inventorysystem/config/WebConfig.java` |
| Encryption service | `src/main/java/com/example/inventorysystem/service/EncryptionService.java` |
| Sync status tracking | `src/main/java/com/example/inventorysystem/service/SyncStatusService.java` |
| DB migration | `src/main/resources/db/migration/V1__init_schema.sql` |
| App config | `src/main/resources/application.properties` |
| API contract | `docs/openapi.yaml` (28 endpoints) |
| Angular routes | `frontend/src/app/app.routes.ts` |
| API base URL | `frontend/src/environments/environment.ts` |
