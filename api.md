# VK Server API Reference

Base URL: `http://localhost:8080`. All endpoints except `POST /login` require `Authorization: Bearer <token>`. Send JSON bodies with `Content-Type: application/json`. Errors use `{ "error": "message" }`. UUIDs are strings and timestamps are RFC3339.

Roles: `admin`, `manager`, `factory_manager`, `site_engineer`. `/login` is limited to 5 requests per minute. Login and registration return `{ "siteId": "<uuid-or-null>", "role": "...", "Name": "...", "email": "...", "token": "<jwt>" }`. Registration (`POST /register`) is admin-only; body: `{ "name", "email", "password", "role", "site_id" }` (`site_id` may be null/omitted).

> **Response casing:** Site and user responses, attendance records, report rows, and explicit response maps use the field names shown below (mostly `snake_case`). Several model-backed responses currently serialize Go field names in `PascalCase`: inventory items, requisitions, dispatch tickets, petty cash entries, and stock ledger history. Examples for these are labeled accordingly; frontend clients should use those exact names.

## Users and Sites

| Method and path | Access | Behavior |
|---|---|---|
| `GET /users?role=&site_id=` | admin | List users; filters optional. |
| `GET /users/:id` | admin | Get one user. |
| `PUT /users/:id` | admin | Update `{ "name", "role", "site_id" }`; returns `204`. |
| `DELETE /users/:id` | admin | Soft-deactivate; returns `204`. Cannot deactivate self. |
| `POST /sites` | admin | Create site. |
| `GET /sites`, `GET /sites/:id` | any authenticated role | List/get sites. |
| `PUT /sites/:id`, `DELETE /sites/:id` | admin | Update/delete site. |

Create/update site JSON fields: `name`, `code`, `is_hub`, `latitude`, `longitude`, `address`. Site responses use `id`, `name`, `code`, `is_hub`, `latitude`, `longitude`, `address`, `is_active`, `created_at`, `updated_at` in snake case. User responses use `id`, `name`, `email`, `role`, `site_id`, `created_at`, `is_active`.

## Inventory and Stock

| Method and path | Access | Behavior |
|---|---|---|
| `POST /inventory-items` | admin | Create item. |
| `GET /inventory-items`, `GET /inventory-items/:id` | any authenticated role | List/get items. |
| `PUT /inventory-items/:id`, `DELETE /inventory-items/:id` | admin | Update/delete item; delete returns `204`. |
| `POST /inventory/factory-inflow` | factory_manager, admin | Add stock from factory/external source. |
| `GET /inventory/stock/site/:site_id` | any authenticated role | Balances by item for a site. |
| `GET /inventory/stock/site/:site_id/item/:item_id` | any authenticated role | One item balance. |
| `GET /inventory/stock/site/:site_id/item/:item_id/history` | any authenticated role | Ledger history. |
| `GET /inventory/stock/site/:site_id/low-stock` | any authenticated role | Items at or below reorder threshold. |

Site engineers are limited to their assigned `site_id` on stock routes. Item create/update body: `{ "name", "code", "unit", "category", "reorder_threshold" }`. Item responses currently use PascalCase, e.g. `{ "ID", "Name", "Code", "Unit", "Category", "ReorderThreshold", "IsActive", "CreatedAt", "UpdatedAt" }` (nullable values may be `null`). Factory inflow body: `{ "item_id": "<uuid>", "quantity": 500, "source": "production" }`; `source` is `production` or `external`, and quantity must be positive. Site balance rows use snake_case `{ "item_id", "item_name", "unit", "balance" }`; a single balance is `{ "site_id", "item_id", "balance" }`. Ledger entries use PascalCase model fields.

## Requisitions and Dispatch Tickets

| Method and path | Access | Behavior |
|---|---|---|
| `POST /requisitions` | site_engineer, manager | Create requisition. Site engineers can submit only for their site. |
| `GET /requisitions/:id` | any authenticated role | Get requisition and lines. |
| `GET /requisitions/site/:site_id` | any authenticated role | List by site; site engineers are site-scoped. |
| `GET /requisitions?status=` | manager, factory_manager, admin | Cross-site list filtered by status (`draft`, `submitted`, `approved`, `rejected`, `closed`). |
| `PUT /requisitions/:id/approve`, `/reject` | manager | Transition requisition; returns `204`. |
| `PUT /requisitions/:id/close` | manager, site_engineer | Close requisition; engineers can close only their site. Returns `204`. |
| `POST /dispatch-tickets/dispatch` | manager | Dispatch approved requisition quantity. |
| `PUT /dispatch-tickets/:id/receive` | site_engineer | Record received quantity; ticket must belong to engineer's site. |
| `PUT /dispatch-tickets/:id/close` | site_engineer | Record consumed quantity and close ticket; site-scoped. |
| `GET /dispatch-tickets?status=` | admin, manager, factory_manager | Cross-site ticket list; optional status `dispatched`, `received`, or `closed`. |
| `GET /dispatch-tickets/:id` | any authenticated role | Get ticket. |
| `GET /dispatch-tickets/requisition/:requisition_id` | any authenticated role | List tickets for requisition. |
| `GET /dispatch-tickets/site/:site_id?status=` | any authenticated role | List tickets by site; optional status filter; engineers are site-scoped. |

Create requisition body: `{ "site_id": "<uuid>", "task_description": "...", "lines": [{ "item_id": "<uuid>", "quantity": 10 }] }`. It starts as `submitted`. Create returns the requisition model; GET by ID returns `{ "requisition": {...}, "lines": [...] }`. Both nested model objects currently use PascalCase fields (`ID`, `SiteID`, `TaskDescription`, `Status`, `RequestedBy`, `ApprovedBy`, `CreatedAt`, `ApprovedAt`, `ClosedAt`; line fields `ID`, `RequisitionID`, `ItemID`, `RequestedQuantity`).

Dispatch body: `{ "requisition_id", "site_id", "item_id", "quantity" }`. Receive body: `{ "received_quantity" }`. Close body: `{ "consumed_quantity" }`. Ticket responses currently use PascalCase fields (`ID`, `RequisitionID`, `SiteID`, `ItemID`, `DispatchedQuantity`, `ReceivedQuantity`, `Status`, `DispatchedBy`, `ReceivedBy`, `DispatchedAt`, `ReceivedAt`, `ClosedAt`). Closing a ticket does not automatically close its parent requisition.

## Petty Cash

| Method and path | Access | Behavior |
|---|---|---|
| `POST /petty-cash` | site_engineer, manager | Submit an entry; engineer must use own site. |
| `PUT /petty-cash/:id/approve` | manager, admin | Approve pending entry; returns `204`. |
| `PUT /petty-cash/:id/reject` | manager, admin | Reject pending entry; requires reason; returns `204`. |
| `GET /petty-cash/:id` | any authenticated role | Get entry. |
| `GET /petty-cash/site/:site_id?status=` | any authenticated role | List by site; optional `pending`, `approved`, or `rejected`; engineers are site-scoped. |
| `GET /petty-cash?status=` | manager, factory_manager, admin | Cross-site list; status required (`pending`, `approved`, `rejected`). |

Submit body: `{ "site_id": "<uuid>", "amount": 150.5, "category": "transport", "description": "...", "screenshot_url": "..." }`. Reject body: `{ "rejection_reason": "Receipt is missing" }`. Entry model fields serialize in PascalCase (`ID`, `SiteID`, `Amount`, `Category`, `Description`, `ScreenshotURL`, `Status`, `SubmittedBy`, `ApprovedBy`, `CreatedAt`, `ApprovedAt`); `rejection_reason` is snake_case.

## Attendance

| Method and path | Access | Behavior |
|---|---|---|
| `POST /attendance/check-in` | any authenticated role | Start a shift for the caller. |
| `POST /attendance/check-out` | any authenticated role | End the caller's open shift. |
| `GET /attendance/user/:user_id?from=&to=` | any authenticated role | List user records; site engineers may read only themselves. |
| `GET /attendance/site/:site_id?from=&to=` | any authenticated role | List site records; engineers may read only their assigned site. |

Punch body: `{ "site_id": "<uuid>", "latitude": 12.34, "longitude": 56.78 }`. The caller ID comes from the token. Punch responses use snake_case fields: `id`, `user_id`, `site_id`, `check_in_at`, `check_out_at`, `check_in_latitude`, `check_in_longitude`, `check_out_latitude`, `check_out_longitude`, `check_in_out_of_geofence`, `check_out_out_of_geofence`. One open shift per user is allowed. Punches outside 100 m are accepted and flagged. History requires RFC3339 `from` and `to`; range is inclusive at `from` and exclusive at `to`.

## Uploads

| Method and path | Access | Behavior |
|---|---|---|
| `POST /uploads` | any authenticated role | Multipart upload, field name `file`; JPEG, PNG, or WebP, up to 10 MB. Returns `201` with `{ "filename", "url", "size", "content_type" }`. |
| `GET /uploads/:filename` | any authenticated role | Serves the uploaded image. |

Files are stored in `UPLOAD_DIR` (default `uploads`). The returned URL is relative and requires authentication when fetched.

## Reports

All reports require `admin`, `manager`, or `factory_manager`.

| Method and path | Behavior |
|---|---|
| `GET /reports/stock` | System-wide balance by active site/item, including zero balances. Rows include `site_id`, `site_name`, `item_id`, `item_name`, `unit`, `balance`. |
| `GET /reports/petty-cash?from=&to=&group_by=` | Approved totals by approval time. `group_by` is a comma-separated, unique, non-empty combination of `site`, `month`, `category`; default `site,month,category`. Rows contain selected dimension fields plus `total_amount`. |
| `GET /reports/requisitions/turnaround?from=&to=` | Average submitted-to-closed duration by site for closed requisitions created in range. Rows: `site_id`, `site_name`, `avg_turnaround_seconds`, `requisition_count`. |
| `GET /reports/attendance?from=&to=&site_id=` | Attendance counts by user and site; `site_id` optional. Rows: `user_id`, `user_name`, `site_id`, `site_name`, `check_in_count`, `check_out_count`, `out_of_geofence_count`. |

All report ranges require RFC3339 `from` and `to`, inclusive at `from` and exclusive at `to`.

## Local Configuration

Set `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters in `.env`. `UPLOAD_DIR` is optional. Apply migrations in order before running the server; `schema.sql` contains the fresh-install schema. `go run ./cmd/seed` creates the first admin from `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` after migrations are applied.
