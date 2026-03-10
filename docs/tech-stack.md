# Technology Stack
## Server Inventory System

**Version:** 1.4
**Last Updated:** 2026-03-10

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backend](#2-backend)
3. [Frontend](#3-frontend)
4. [Database](#4-database)
5. [Security](#5-security)
6. [Infrastructure & Deployment](#6-infrastructure--deployment)
7. [External Integrations](#7-external-integrations)
8. [Summary Table](#8-summary-table)
9. [Code Conventions](#9-code-conventions)
10. [Testing](#10-testing)

---

## 1. Overview

The system is a **monolith** composed of two independently deployed services:

| Service | Role |
|---------|------|
| Backend Service | Spring Boot REST API, sync jobs, credential management |
| Frontend | Angular SPA served via Nginx |

Both run as Docker containers on Kubernetes. All application data lives in a single SQLite file owned by the Backend Service.

---

## 2. Backend

### 2.1 Runtime & Language

| Technology | Version | Purpose |
|------------|---------|---------|
| Java | 17 (LTS) | Primary language |
| Eclipse Temurin | 17 JRE Alpine | Docker base image |

Java 17 LTS is chosen for long-term support and broad compatibility with Spring Boot 3.2.

---

### 2.2 Framework — Spring Boot

| Module | Version | Purpose |
|--------|---------|---------|
| Spring Boot | 3.2.x | Application framework, auto-configuration |
| Spring Web (MVC) | (included) | REST controllers, request mapping |
| Spring Data JPA | (included) | Repository layer, JPQL queries |
| Spring Scheduler | (included) | Background sync job scheduling (1-minute poll) |
| Spring Security | (included) | JWT authentication filter, CORS config |
| Spring Validation | (included) | Request body validation (`@Valid`) |

**Why Spring Boot 3.2:** Compatible with Java 17 LTS, improved observability, and active long-term community support.

---

### 2.3 ORM & Database Access

| Technology | Version | Purpose |
|------------|---------|---------|
| Hibernate | 6.x | JPA provider |
| SQLite JDBC Driver | 3.45.x (`org.xerial:sqlite-jdbc`) | JDBC connectivity to SQLite |
| Hibernate SQLite Dialect | latest (`org.hibernate.orm:hibernate-community-dialects`) | SQLite type mappings for Hibernate |

**Key configuration (`application.properties`):**
```properties
spring.datasource.url=jdbc:sqlite:${DB_PATH:./data/inventory.db}?journal_mode=WAL&busy_timeout=5000
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.jpa.database-platform=org.hibernate.community.dialect.SQLiteDialect
spring.jpa.hibernate.ddl-auto=none
```

---

### 2.4 Schema Migrations — Flyway

| Technology | Version | Purpose |
|------------|---------|---------|
| Flyway | 10.x | Versioned SQL migrations, applied on startup |

Migrations live in `src/main/resources/db/migration/` and follow the naming convention `V{n}__{description}.sql`. Flyway applies pending migrations automatically when the application starts.

**Key configuration:**
```properties
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=false
```

---

### 2.5 HTTP Client (External API Calls)

| Technology | Version | Purpose |
|------------|---------|---------|
| Spring RestClient | (Spring 6.1+, included) | Synchronous HTTP calls to vSphere and New Relic APIs |

`RestClient` is used over `WebClient` because the sync jobs are synchronous by design and run on scheduled threads. A reactive stack is unnecessary for this workload.

---

### 2.6 JWT Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| JJWT | 0.12.x (`io.jsonwebtoken:jjwt-api`) | JWT token creation and validation |
| Spring Security | (included) | Security filter chain, JWT filter |

**Note:** JWT authentication is currently **not yet enforced**. Spring Security is configured with `permitAll()` for all routes. The `OncePerRequestFilter` and `JWT_SECRET` environment variable are not yet wired in. JWT enforcement is planned for a future iteration.

---

### 2.7 Encryption

| Technology | Purpose |
|------------|---------|
| JDK `javax.crypto` (AES-256-GCM) | Encrypt/decrypt credential config stored in database |

The AES-256 encryption key is injected at runtime via the `ENCRYPTION_KEY` environment variable (sourced from a Kubernetes Secret). It is never stored in source code or the database.

---

### 2.8 Cron Expression Parsing

| Technology | Purpose |
|------------|---------|
| Spring `CronExpression` | Parse and evaluate 6-field cron expressions from `sync_schedule` table |

The backend polls the `sync_schedule` table every minute using `@Scheduled(fixedDelay = 60_000)` and evaluates whether the cron expression matches the current time using Spring's built-in `CronExpression.parse()`.

---

### 2.9 Build Tool

| Technology | Version | Purpose |
|------------|---------|---------|
| Gradle | 8.x | Dependency management, build lifecycle, packaging |

The application is packaged as a single executable JAR (`inventory-system.jar`) using the Spring Boot Gradle plugin.

```groovy
plugins {
    id 'org.springframework.boot' version '3.2.x'
    id 'io.spring.dependency-management' version '1.1.x'
    id 'java'
}
```

---

### 2.10 Logging

| Technology | Purpose |
|------------|---------|
| Logback (`logback-spring.xml`) | Structured rolling file appender — writes to `${user.dir}/logs/`, daily rollover, 20 MB max file size, 30-day retention; log pattern includes file name and line number (`%F:%L`) |

---

## 3. Frontend

### 3.1 Framework & Language

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 18.x | Full-featured SPA framework |
| TypeScript | 5.x | Primary language (Angular is TypeScript-first) |
| Angular CLI | 18.x | Project scaffolding, build, and dev server |

**Why Angular:** Opinionated, batteries-included framework with built-in routing, HTTP client, forms, and dependency injection — reduces the number of third-party libraries needed.

---

### 3.2 Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| TailwindCSS | 3.x | Utility-first CSS framework |

TailwindCSS integrates with Angular via PostCSS and works alongside Angular's component-scoped styles.

---

### 3.3 Shared UI Components

| Component | Path | Purpose |
|-----------|------|---------|
| `MultiSelectComponent` | `frontend/src/app/shared/components/multi-select/multi-select.component.ts` | Reusable standalone dropdown with checkbox list, Select All / Clear All, outside-click close, and optional `labelFn` mapping |

The `MultiSelectComponent` is used by vSphere (vCenter URL, Power State, Guest OS), New Relic (Account ID, Linux Distro), CMDB (OS Version, Op Status), and the report pages — Missing from CMDB (Sources, Power State dropdowns) — to render inline column header multi-select filters. The IP Discrepancy report uses a plain text filter for hostname. It emits a `selectionChange: string[]` event that the parent component maps to API query params (`style: form, explode: true`).

**CSV Export (report pages):** Both report pages include an "Export CSV" button implemented entirely in the frontend. On click, the component re-requests the same API endpoint with `size=10000` and `page=0`, respecting all currently active filters. This exports all matching records (up to 10,000), not just the current page. There is no dedicated CSV export backend endpoint.

---

### 3.4 HTTP Client

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular HttpClient | (included) | Built-in HTTP client for API calls to the Backend Service |

`HttpClient` is Angular's built-in HTTP module. It supports interceptors for JWT attachment and centralized error handling — no third-party library needed.

**JWT interceptor pattern (planned — not yet implemented):**
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
```

---

### 3.5 Build & Serving

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20 LTS | Build environment |
| Nginx | Alpine | Serve the compiled Angular SPA in production |

**Dockerfile (multi-stage):**
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist/inventory-app/browser /usr/share/nginx/html
```

**Environment configuration (`src/environments/environment.prod.ts`):**
```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'http://backend-service:8080'
};
```

---

## 4. Database

| Technology | Version | Purpose |
|------------|---------|---------|
| SQLite | 3.45.x | Single-file relational database |

### 4.1 Why SQLite

| Concern | Decision |
|---------|----------|
| Operational simplicity | No external database server to manage, configure, or back up separately |
| Data volume | Expected max ~10,000 assets — well within SQLite's proven range |
| Concurrency | Single backend instance; WAL mode handles API reads + sync writes concurrently |
| Portability | Database is a single file, trivially moved or backed up |
| Kubernetes persistence | Stored on a PersistentVolumeClaim; survives pod restarts |

### 4.2 Key SQLite Settings

| Setting | Value | Set via |
|---------|-------|---------|
| `journal_mode` | `WAL` | JDBC URL parameter |
| `busy_timeout` | `5000` ms | JDBC URL parameter |
| `foreign_keys` | `OFF` | Default (tables decoupled by design) |

---

## 5. Security

| Concern | Technology | Detail |
|---------|------------|--------|
| Authentication | JWT (JJWT 0.12) — **planned, not yet enforced** | Spring Security currently uses `permitAll()`; JWT filter not yet implemented |
| Credential encryption | AES-256-GCM (JDK) | Applied before writing to DB, reversed on read |
| Encryption key storage | Kubernetes Secret | Injected as `ENCRYPTION_KEY` env variable |
| HTTPS | TLS at Kubernetes LoadBalancer | Terminated at the service boundary |
| CORS | Spring Security | Configured to allow Angular frontend origin only |
| Credential list security | Application layer | `GET /api/settings/credentials` (list) returns metadata only — `config` is never decrypted on list; no secrets travel over the wire |

---

## 6. Infrastructure & Deployment

### 6.1 Containerization

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker | latest | Build and run container images |

**Backend (`Dockerfile`):** Multi-stage build — `eclipse-temurin:17` builder compiles the JAR; `eclipse-temurin:17-jre-alpine` is the runtime layer. The SQLite CLI (`sqlite3`) is installed via `apk add --no-cache sqlite` for in-container database inspection. The `data/` directory is created at image build time.

**Frontend (`frontend/Dockerfile`):** Multi-stage build — `node:20-alpine` builds the Angular app; `nginx:alpine` serves it. The `frontend/nginx.conf` handles SPA fallback (`try_files $uri /index.html`), `/api/` reverse-proxy to the backend, gzip compression, and HTTP security headers.

---

### 6.2 Orchestration

| Technology | Version | Purpose |
|------------|---------|---------|
| Kubernetes | 1.29+ | Container scheduling, self-healing, service networking |

**Kubernetes resources per service:**

| Resource | Backend | Frontend |
|----------|---------|----------|
| Deployment | ✓ | ✓ |
| Service (LoadBalancer) | ✓ | ✓ |
| ConfigMap | ✓ | — |
| PersistentVolumeClaim | ✓ (2 Gi, `inventory.db`) | — |
| Secret | ✓ (`ENCRYPTION_KEY`) | — |

---

### 6.3 CI/CD

| Technology | Purpose |
|------------|---------|
| GitHub Actions | Automated build, test, Docker image push, and Kubernetes deploy |

---

## 7. External Integrations

### 7.1 VMware vSphere

| Attribute | Detail |
|-----------|--------|
| API | vSphere REST API (vCenter Server API) |
| Authentication | Session-based (POST `/api/session` — vSphere 8.x REST API) |
| Transport | HTTPS |
| Client | Spring `RestClient` |
| Trigger | Scheduled (cron via `sync_schedule` table) or manual (`POST /api/vsphere/sync`) |

---

### 7.2 New Relic

| Attribute | Detail |
|-----------|--------|
| API | NerdGraph (GraphQL API) |
| Endpoint | `https://api.newrelic.com/graphql` |
| Authentication | Bearer token (`Api-Key` header) |
| Transport | HTTPS |
| Client | Spring `RestClient` |
| Trigger | Scheduled (cron via `sync_schedule` table) or manual (`POST /api/newrelic/sync`) |

---

## 8. Summary Table

| Layer | Technology | Version |
|-------|------------|---------|
| Language | Java | 17 LTS |
| Framework | Spring Boot | 3.2.x |
| REST | Spring Web MVC | (included) |
| Data access | Spring Data JPA + Hibernate | 6.x |
| Migrations | Flyway | 10.x |
| Scheduler | Spring Scheduler | (included) |
| Auth | Spring Security + JJWT | 0.12.x |
| Encryption | JDK AES-256-GCM | (built-in) |
| HTTP client | Spring RestClient | (Spring 6.1+) |
| Database | SQLite | 3.45.x |
| JDBC driver | xerial/sqlite-jdbc | 3.45.x |
| Hibernate dialect | hibernate-community-dialects | (Hibernate 6.x) |
| Build | Gradle | 8.x |
| Frontend framework | Angular + TypeScript | 18.x / 5.x |
| Frontend build | Angular CLI | 18.x |
| Styling | TailwindCSS | 3.x |
| HTTP (frontend) | Angular HttpClient | (included) |
| Node (build) | Node.js | 20 LTS |
| Web server | Nginx Alpine | latest |
| Containers | Docker | latest |
| Orchestration | Kubernetes | 1.29+ |
| CI/CD | GitHub Actions | — |
| Logging | Logback (rolling file) | (Spring Boot default) |
| Base image (backend) | eclipse-temurin | 17-jre-alpine |
| Base image (frontend) | nginx | alpine |

---

## 9. Code Conventions

### 9.1 Backend
- Use constructor injection, never field injection (`@Autowired`)
- Package structure: `controller` → `service` → `repository` → `model`
- DTOs for request/response, never expose entities directly
- Use `@RestController` for REST APIs
- Global exception handling with `@ControllerAdvice`
- Validation with `@Valid` and Jakarta Bean Validation annotations

### 9.2 Frontend

**Inline column header filter pattern**

All list screens use inline column header filters instead of a top filter bar:
- Hostname: debounced `<input>` bound to `Subject<string>` (see debounced search pattern below)
- Multi-value columns: `MultiSelectComponent` emits `string[]`; parent maps to repeated query params

**Multi-select filter API param convention**

Filter params that accept multiple values are sent as repeated query string values (e.g. `?powerState=poweredOn&powerState=poweredOff`). The backend receives them as `List<String>` and uses the JPQL pattern:

```java
// Repository — guard so that an empty list returns all rows
// Use nullIfEmpty() in the service layer; the JPQL guard uses IS NULL instead of IS EMPTY
@Query("SELECT v FROM Vsphere v WHERE (:powerStates IS NULL OR v.powerState IN :powerStates)")
Page<Vsphere> findByFilters(@Param("powerStates") List<String> powerStates, Pageable pageable);
```

---

**Debounced search pattern (all list screens)**

Search inputs use a `Subject<string>` (not `Subject<void>`) as the trigger, so that `distinctUntilChanged()` can compare successive search strings and correctly suppress duplicate values while still firing on every unique change — including deletions:

```typescript
private searchTrigger$ = new Subject<string>();

ngOnInit(): void {
  this.searchTrigger$.pipe(
    debounceTime(300),
    distinctUntilChanged(),   // compares string values; works correctly only when Subject carries the term
    switchMap(term => this.service.list({ search: term, ... })),
    takeUntilDestroyed(this.destroyRef)
  ).subscribe(...);
}

onSearchChange(): void {
  this.currentPage = 0;
  this.searchTrigger$.next(this.search);  // pass the current string, not void
}
```

Using `Subject<void>` was a previous bug: every emission carried `undefined`, so `distinctUntilChanged()` swallowed all keystrokes after the first, meaning deleting characters from the search box did not update the list.

**Page-size `<select>` binding**

Page-size `<option>` elements must use `[ngValue]` (not `[value]`) to bind numeric values, and `load()` / `onPageSizeChange()` must read `this.pageSize` (not a hardcoded literal):

```html
<select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
  <option [ngValue]="25">25</option>
  <option [ngValue]="50">50</option>
  <option [ngValue]="100">100</option>
</select>
```

Using `[value]` coerces numbers to strings, which breaks `[(ngModel)]` two-way binding and causes `pageSize` to remain at its initial value regardless of the user's selection.

---

## 10. Testing

- JUnit 5 + Mockito for unit tests
- `@SpringBootTest` for integration tests
- Aim for 80% coverage on service layer

---
