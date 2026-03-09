# Requirements Document
## Server Inventory System

**Version:** 1.2
**Author:** Solo Developer
**Last Updated:** 2026-03-09
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

The **Server Inventory System** is a backend application that consolidates server asset data from multiple sources — VMware vSphere, New Relic, and ServiceNow CMDB — into a single, searchable inventory. It exposes a REST API for external access and provides a dashboard UI for system administrators and management stakeholders to view, search, and monitor the health of all managed assets.

---

## 2. Goals & Objectives

| # | Goal | Success Criteria |
|---|------|-----------------|
| G1 | Single source of truth for all server assets | All servers visible in one place regardless of source |
| G2 | Automated data sync from vSphere, New Relic, and ServiceNow CMDB | Data refreshed on a scheduled basis without manual intervention |
| G3 | Fast, searchable inventory | Search results returned in under 300ms |
| G4 | Visibility for non-technical stakeholders | Dashboard accessible without technical knowledge |
| G5 | Extensible via REST API | External tools can query inventory via API |

---

## 3. Target Users

### 3.1 System Administrators
- Primary technical users
- Need to search and filter servers by hostname, IP, environment, status
- Need to see vSphere, New Relic, and CMDB data side by side
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
| INV-01 | The system shall maintain a consolidated read-only inventory of all managed server assets | High |
| INV-02 | Each asset shall be uniquely identified by its hostname | High |
| INV-03 | The inventory VIEW shall aggregate data from vSphere, New Relic, and CMDB by hostname | High |
| INV-04 | The inventory VIEW shall expose a computed `sources` field indicating which systems have a record for each hostname | Medium |

### 4.2 vSphere Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| VSP-01 | The system shall sync VM data from VMware vSphere on a configurable schedule | High |
| VSP-02 | Synced data shall include: VM name, CPU, memory, power state, guest OS, VMware Tools status, IP addresses, source vCenter URL | High |
| VSP-03 | The system shall record the timestamp of the last successful sync per VM | Medium |
| VSP-04 | If a VM no longer exists in vSphere, its record shall be flagged or removed | Medium |
| VSP-05 | Sync errors shall be logged with sufficient detail for troubleshooting | High |

### 4.3 New Relic Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| NR-01 | The system shall sync entity data from New Relic on a configurable schedule | High |
| NR-02 | Synced data shall include: hostname, full hostname (FQDN), IPv4 address, IPv6 address, processor count, core count, system memory (bytes), Linux distribution, service name, environment, team, location, and account ID | High |
| NR-03 | The system shall record the timestamp of the last successful sync per entity | Medium |
| NR-04 | If an entity is no longer reporting in New Relic, its reporting flag shall be updated to false | Medium |
| NR-05 | Sync errors shall be logged with sufficient detail for troubleshooting | High |

### 4.4 CMDB (ServiceNow) Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| CMDB-01 | The system shall sync asset data from ServiceNow CMDB on a configurable schedule | High |
| CMDB-02 | Synced data shall include: hostname, sys_id, OS, OS version, IP address, location, department, environment, operational status, and classification | High |
| CMDB-03 | The system shall record the timestamp of the last successful sync per CMDB record | Medium |
| CMDB-04 | Authentication shall use OAuth2 password grant flow with configurable token URL and API URL per credential | High |
| CMDB-05 | Sync errors shall be logged with sufficient detail for troubleshooting | High |

### 4.5 Search & Filtering

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SCH-01 | Users shall be able to search inventory by hostname | High | Implemented (debounced inline column header filter on all list screens) |
| SCH-02 | Users shall be able to filter by environment (production, staging, dev, dr) | High | — |
| SCH-03 | Users shall be able to filter by status (active, maintenance, decommissioned, unknown) | High | — |
| SCH-04 | Users shall be able to filter by alert status from New Relic | Medium | — |
| SCH-05 | Users shall be able to filter the vSphere list by source vCenter URL (multi-select) | Medium | Implemented |
| SCH-06 | The vSphere screen shall provide a multi-select of distinct vCenter URLs loaded from the database | Medium | Implemented (`GET /api/vsphere/vcenter-urls`) |
| SCH-07 | Search and filter results shall be paginated | High | Implemented |
| SCH-08 | Users shall be able to filter the vSphere list by Power State (multi-select) | Medium | Implemented |
| SCH-09 | Users shall be able to filter the vSphere list by Guest OS (multi-select) | Medium | Implemented (`GET /api/vsphere/guest-os-types`) |
| SCH-10 | Users shall be able to filter the New Relic list by Account ID (multi-select) | Medium | Implemented |
| SCH-11 | Users shall be able to filter the New Relic list by Linux Distribution (multi-select) | Medium | Implemented (`GET /api/newrelic/linux-distros`) |
| SCH-12 | Users shall be able to filter the CMDB list by OS Version (multi-select) | Medium | Implemented (`GET /api/cmdb/os-versions`) |
| SCH-13 | Users shall be able to filter the CMDB list by Operational Status (multi-select) | Medium | Implemented (`GET /api/cmdb/op-statuses`) |
| SCH-14 | Multi-select filter panels shall support Select All / Clear All and close on outside click | Medium | Implemented (shared `MultiSelectComponent`) |
| SCH-15 | Backend filter params for dropdown filters shall accept multiple values (list) with `IN` guard | High | Implemented (all `List<String>` + JPQL `IN (:param) OR :param IS EMPTY`) |

### 4.6 REST API

| ID | Requirement | Priority |
|----|-------------|----------|
| API-01 | The system shall expose a REST API for all inventory data | High |
| API-02 | The API shall support GET endpoints for inventory, vsphere, newrelic, and cmdb data | High |
| API-03 | The API shall support search and filter query parameters | High |
| API-04 | The API shall return responses in JSON format | High |
| API-05 | The API shall support pagination via `page` and `size` query parameters | High |
| API-06 | The API shall return appropriate HTTP status codes (200, 400, 404, 500) | High |
| API-07 | The API shall include an OpenAPI (Swagger) specification | Medium |

### 4.7 Dashboard & UI

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| UI-01 | The system shall provide a web-based dashboard accessible via browser | High | Implemented |
| UI-02 | The dashboard shall display a summary of total assets by source (vSphere, New Relic, CMDB, and total) | High | Implemented |
| UI-03 | The dashboard shall display a summary of assets by alert status | High | — |
| UI-04 | The dashboard shall display an inventory table with an inline Hostname column header filter (debounced text) and record count in a slim toolbar above the table | High | Implemented |
| UI-05 | Clicking an asset shall show its full details including vSphere, New Relic, and CMDB data | High | Implemented |
| UI-06 | The dashboard shall display the last sync time for vSphere and New Relic | Medium | — |
| UI-07 | The UI shall be responsive and usable on desktop browsers | Medium | Implemented |
| UI-08 | The vSphere, New Relic, and CMDB list screens shall use inline column header filters instead of a top filter bar | High | Implemented |
| UI-09 | The Power State column shall be visible by default on the vSphere screen (after Hostname) | Medium | Implemented |
| UI-10 | The OS column on the CMDB screen shall be hidden by default | Medium | Implemented |

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
- **Integration with other monitoring tools** (Datadog, Zabbix, etc.) — only vSphere, New Relic, and ServiceNow CMDB
- **Alerts & notifications** — no email or webhook notifications
- **Mobile app** — web dashboard only

---

## 7. Assumptions & Constraints

| # | Assumption / Constraint |
|---|------------------------|
| A1 | vSphere, New Relic, and ServiceNow CMDB APIs are accessible from the host where the application runs |
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
| New Relic | Cloud-based monitoring and observability platform |
| Entity | New Relic's term for a monitored resource (host, application, container) |
| CMDB | Configuration Management Database — a repository of configuration items (CIs) for managed assets |
| ServiceNow | IT service management platform; used here as the source of CMDB data |
| sources | A computed field on the `inventory` VIEW listing which systems (`vsphere`, `newrelic`, `cmdb`) have a record for a given hostname |
| Sync | The process of pulling data from an external source and upserting records in the local database |
| REST API | A web-based API following REST conventions, returning JSON responses |
