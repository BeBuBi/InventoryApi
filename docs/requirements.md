# Requirements Document
## Server Inventory System

**Version:** 1.0
**Author:** Solo Developer
**Last Updated:** 2026-02-27
**Status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Goals & Objectives](#2-goals--objectives)
3. [Target Users](#3-target-users)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Out of Scope](#6-out-of-scope)
7. [Assumptions & Constraints](#7-assumptions--constraints)
8. [Glossary](#8-glossary)

---

## 1. Project Overview

The **Server Inventory System** is a backend application that consolidates server asset data from multiple sources — VMware vSphere and New Relic — into a single, searchable inventory. It exposes a REST API for external access and provides a dashboard UI for system administrators and management stakeholders to view, search, and monitor the health of all managed assets.

---

## 2. Goals & Objectives

| # | Goal | Success Criteria |
|---|------|-----------------|
| G1 | Single source of truth for all server assets | All servers visible in one place regardless of source |
| G2 | Automated data sync from vSphere and New Relic | Data refreshed on a scheduled basis without manual intervention |
| G3 | Fast, searchable inventory | Search results returned in under 300ms |
| G4 | Visibility for non-technical stakeholders | Dashboard accessible without technical knowledge |
| G5 | Extensible via REST API | External tools can query inventory via API |

---

## 3. Target Users

### 3.1 System Administrators
- Primary technical users
- Need to search and filter servers by hostname, IP, environment, status
- Need to see vSphere and New Relic data side by side
- Need to identify servers with alert issues or out-of-date patches

### 3.2 Management / Stakeholders
- Non-technical users
- Need high-level visibility into fleet size, environment breakdown, and alert status
- Access the dashboard for reporting and oversight
- Do not need raw API access

---

## 4. Functional Requirements

### 4.1 Inventory Management

| ID | Requirement | Priority |
|----|-------------|----------|
| INV-01 | The system shall maintain a list of all managed server assets | High |
| INV-02 | Each asset shall be uniquely identified by its hostname | High |
| INV-03 | Assets shall include metadata: IP address, asset type, environment, owner, location, status | High |
| INV-04 | Assets shall track warranty expiry and last patched date | Medium |
| INV-05 | Assets shall support the following statuses: active, maintenance, decommissioned, unknown | High |

### 4.2 vSphere Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| VSP-01 | The system shall sync VM data from VMware vSphere on a configurable schedule | High |
| VSP-02 | Synced data shall include: VM name, VM ID, datastore, CPU, memory, disk, power state, guest OS, VMware Tools status | High |
| VSP-03 | The system shall record the timestamp of the last successful sync per VM | Medium |
| VSP-04 | If a VM no longer exists in vSphere, its record shall be flagged or removed | Medium |
| VSP-05 | Sync errors shall be logged with sufficient detail for troubleshooting | High |

### 4.3 New Relic Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| NR-01 | The system shall sync entity data from New Relic on a configurable schedule | High |
| NR-02 | Synced data shall include: entity ID, entity name, entity type, account ID, alert status, reporting status, APM language, agent version, tags | High |
| NR-03 | The system shall record the timestamp of the last successful sync per entity | Medium |
| NR-04 | If an entity is no longer reporting in New Relic, its reporting flag shall be updated to false | Medium |
| NR-05 | Sync errors shall be logged with sufficient detail for troubleshooting | High |

### 4.4 Search & Filtering

| ID | Requirement | Priority |
|----|-------------|----------|
| SCH-01 | Users shall be able to search inventory by hostname | High |
| SCH-02 | Users shall be able to filter by environment (production, staging, dev, dr) | High |
| SCH-03 | Users shall be able to filter by status (active, maintenance, decommissioned, unknown) | High |
| SCH-04 | Users shall be able to filter by alert status from New Relic | Medium |
| SCH-07 | Search and filter results shall be paginated | High |

### 4.5 REST API

| ID | Requirement | Priority |
|----|-------------|----------|
| API-01 | The system shall expose a REST API for all inventory data | High |
| API-02 | The API shall support GET endpoints for inventory, vsphere, and newrelic data | High |
| API-03 | The API shall support search and filter query parameters | High |
| API-04 | The API shall return responses in JSON format | High |
| API-05 | The API shall support pagination via `page` and `size` query parameters | High |
| API-06 | The API shall return appropriate HTTP status codes (200, 400, 404, 500) | High |
| API-07 | The API shall include an OpenAPI (Swagger) specification | Medium |

### 4.6 Dashboard & UI

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-01 | The system shall provide a web-based dashboard accessible via browser | High |
| UI-02 | The dashboard shall display a summary of total assets by environment | High |
| UI-03 | The dashboard shall display a summary of assets by alert status | High |
| UI-04 | The dashboard shall display a searchable, filterable inventory table | High |
| UI-05 | Clicking an asset shall show its full details including vSphere and New Relic data | High |
| UI-06 | The dashboard shall display the last sync time for vSphere and New Relic | Medium |
| UI-07 | The UI shall be responsive and usable on desktop browsers | Medium |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement |
|----|-------------|
| PER-01 | API search responses shall return in under 300ms for datasets up to 10,000 records |
| PER-02 | Dashboard page load shall complete within 2 seconds |
| PER-03 | vSphere and New Relic sync jobs shall complete within 5 minutes for up to 1,000 assets |

### 5.2 Reliability

| ID | Requirement |
|----|-------------|
| REL-01 | Sync failures shall not corrupt existing data |
| REL-02 | The application shall recover gracefully from external API failures (vSphere, New Relic) |
| REL-03 | All sync jobs shall log success/failure outcomes |

### 5.3 Security

| ID | Requirement |
|----|-------------|
| SEC-01 | API keys for vSphere and New Relic shall be stored as environment variables, not in source code |
| SEC-02 | The REST API shall require authentication (API key or JWT) |
| SEC-03 | The dashboard shall require login |

### 5.4 Maintainability

| ID | Requirement |
|----|-------------|
| MAI-01 | All schema changes shall be managed via Flyway migrations |
| MAI-02 | Application configuration shall be externalized in `application.properties` or environment variables |
| MAI-03 | Code shall follow standard Spring Boot layered architecture (Controller → Service → Repository) |

### 5.5 Portability

| ID | Requirement |
|----|-------------|
| POR-01 | The application shall run as a single JAR file |
| POR-02 | The SQLite database file location shall be configurable |
| POR-03 | The application shall be runnable on macOS and Linux |

---

## 6. Out of Scope

The following are explicitly not part of this project:

- **User management / role-based access control** — a single admin account is sufficient for now
- **Multi-tenancy** — the system is designed for a single organization
- **Historical data / time-series tracking** — only current state is stored, not change history
- **Provisioning or decommissioning servers** — read-only view of existing assets
- **Integration with other monitoring tools** (Datadog, Zabbix, etc.) — only vSphere and New Relic
- **Alerts & notifications** — no email or webhook notifications
- **Mobile app** — web dashboard only

---

## 7. Assumptions & Constraints

| # | Assumption / Constraint |
|---|------------------------|
| A1 | vSphere and New Relic APIs are accessible from the host where the application runs |
| A2 | Hostnames are consistent and unique across vSphere, New Relic, and inventory |
| A3 | The application will be run and maintained by a single developer |
| A4 | SQLite is sufficient for the expected data volume (up to 10,000 assets) |
| A5 | The application does not need to run in a high-availability (clustered) configuration |
| A6 | Internet access is available for syncing from New Relic's cloud API |

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Asset | A managed server, virtual machine, or container tracked in the inventory |
| Hostname | The unique network name of an asset, used as the primary identifier |
| vSphere | VMware's virtualization platform used to manage VMs |
| moId | Managed Object ID — vSphere's internal identifier for a VM |
| New Relic | Cloud-based monitoring and observability platform |
| Entity | New Relic's term for a monitored resource (host, application, container) |
| Sync | The process of pulling data from an external source (vSphere or New Relic) and updating the local database |
| REST API | A web-based API following REST conventions, returning JSON responses |
