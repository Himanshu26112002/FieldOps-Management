# Firestore Database Schema — FieldOps AI

Last updated: 2026-11-02 (Milestone 0 design; becomes binding when implemented and tested)

## Conventions

- `{orgId}` = the single organization ID (D1). Every business collection lives under `organizations/{orgId}/`.
- **IDs:** clients and users use Firestore auto-IDs, except `users/{uid}`, which uses the Firebase Auth UID. Visits and photos use IDs **generated on the device** (Firestore auto-ID format) so that retried offline writes never create duplicates.
- **Timestamps:** `createdAt` and `updatedAt` are always `serverTimestamp()`, and rules enforce `== request.time`. Device-captured times (GPS) are stored separately as `capturedAt` (see `GPS_AND_PRIVACY.md`).
- **No hard deletes** of clients, users, visits, assignments, follow-ups or audit logs. Records are deactivated, cancelled or ended instead.
- All enums are defined once in `packages/shared-types` and validated by both the Zod schemas and the Security Rules.

## Collections

### `memberships/{uid}` (top level)
Purpose: the authority for identity and authorization. Rules `get()` this document on every request.

| Field | Type | Req | Validation |
|---|---|---|---|
| orgId | string | ✓ | must equal an existing organization |
| role | string | ✓ | `ADMIN` \| `USER` |
| status | string | ✓ | `ACTIVE` \| `INACTIVE` |
| createdAt / updatedAt | timestamp | ✓ | server time |
| createdBy / updatedBy | string (uid) | ✓ | actor |

- **Read:** the owner (own document); Admins of the same organization.
- **Write:** active Admins of the same organization only. An Admin cannot change their own role or status (no accidental self-lockout or self-escalation). The first Admin is created by hand in the Firebase Console.

### `organizations/{orgId}`
Fields: `name` (string ✓), `settings` (map ✓: `clientCategories` string[], `visitOutcomes` string[], `activityTypes` string[], `maxPhotosPerVisit` int = 5, `minGpsAccuracyWarnM` int), `createdAt`, `updatedAt`.

- **Read:** active members.
- **Write:** active Admins (settings only).

### `organizations/{orgId}/users/{uid}`
Salesperson and Admin profiles. **No passwords.**

| Field | Type | Req |
|---|---|---|
| fullName | string 1–100 | ✓ |
| email | string (email) | ✓ (copy of the Auth email) |
| phone | string 7–20 | ✓ |
| role | `ADMIN` \| `USER` | ✓ (a display copy of the membership; never used for authorization) |
| status | `ACTIVE` \| `INACTIVE` | ✓ (kept in sync with the membership in the same batch) |
| employeeCode | string ≤ 30 | – |
| designation | string ≤ 60 | – |
| photoThumb | string (base64 JPEG ≤ 30 KB) | – |
| createdAt, updatedAt, createdBy, updatedBy | | ✓ |

- **Read:** the owner; Admins.
- **Write:** Admins. The owner may update only `phone` and `photoThumb`.

**Queries:** Admin list ordered by `fullName`, filtered by `status`.

### `organizations/{orgId}/clients/{clientId}`

| Field | Type | Req | Notes |
|---|---|---|---|
| name | string 1–150 | ✓ | |
| nameLower | string | ✓ | Prefix search (`>=` / `<`) |
| contactPerson | string ≤ 100 | ✓ | |
| phone | string 7–20 | ✓ | |
| email | string | – | Not every client has one |
| address, city, state | string | ✓ | |
| postalCode | string | – | |
| geo | map `{lat: number −90..90, lng: number −180..180}` | – | Entered by Admin, never invented |
| category | string | – | Must be in `settings.clientCategories` |
| notes | string ≤ 2000 | – | |
| status | `ACTIVE` \| `INACTIVE` | ✓ | |
| assignedUserIds | string[] (≤ 20) | ✓ | Copy of the currently active assignments (D2) |
| assignmentCount | int ≥ 0 | ✓ | Always equals `assignedUserIds.size()` (rule-enforced). Lets the dashboard `count()` assigned clients. |
| lastVisitAt | timestamp | – | Set when a visit is approved |
| createdAt, updatedAt, createdBy, updatedBy | | ✓ | |

- **Read:** Admins; a USER only if their uid is in `assignedUserIds`. List queries must include `where('assignedUserIds', 'array-contains', uid)`.
- **Write:** Admins only. `assignedUserIds` may only change in the same batch as an assignment document (checked with `getAfter`).

### `organizations/{orgId}/client_assignments/{assignmentId}`
Assignment history; documents are only ever added or ended (D2: several active per client).

| Field | Type | Req |
|---|---|---|
| clientId, userId | string | ✓ |
| status | `ACTIVE` \| `ENDED` | ✓ |
| assignedBy, assignedAt | string, timestamp | ✓ |
| endedBy, endedAt | string, timestamp | when ENDED |

- **Read:** Admins; a USER reads their own (`userId == uid`).
- **Write:** Admins. Creating requires the client to be ACTIVE and the user to be an ACTIVE USER. The only update allowed is ACTIVE → ENDED.
- **Assignment ID** = `{clientId}_{userId}_{epochMillis}`, which makes ownership readable at a glance.

### `organizations/{orgId}/visits/{visitId}`

| Field | Type | Req | Notes |
|---|---|---|---|
| clientId | string | ✓ | Immutable |
| clientNameSnapshot | string | ✓ | Client name when the visit was created (history stays readable) |
| userId | string | ✓ | Salesperson; immutable |
| status | `SCHEDULED` \| `IN_PROGRESS` \| `SUBMITTED` \| `RETURNED` \| `APPROVED` \| `CANCELLED` | ✓ | Transitions in `PRODUCT_REQUIREMENTS.md` §6 |
| origin | `AD_HOC` \| `SCHEDULED` | ✓ | |
| scheduledFor | timestamp | if origin = SCHEDULED | |
| scheduledBy | string (uid) | if SCHEDULED | |
| checkIn | GeoCapture | when ≥ IN_PROGRESS | Write-once |
| checkOut | GeoCapture | when ≥ SUBMITTED | Write-once |
| report | VisitReport | when ≥ SUBMITTED | |
| photoCount | int 0–5 | ✓ | |
| submittedAt, approvedAt, returnedAt, cancelledAt | timestamp | per status | |
| approvedBy, returnedBy, cancelledBy | string | per status | |
| returnComment, cancelReason | string ≤ 1000 | per status | |
| nextFollowupId | string | – | Set on approval (A2) |
| revisionCount | int | ✓ | |
| createdAt, updatedAt, createdBy | | ✓ | |

**GeoCapture:** `{ lat: number, lng: number, accuracyM: number|null, mocked: boolean|null, capturedAt: timestamp (device GPS time), recordedAt: timestamp (server time at sync) }`

**VisitReport:**

| Field | Type | Req |
|---|---|---|
| activities | string[] (1–20, values from `settings.activityTypes`) | ✓ |
| summary | string 1–4000 | ✓ |
| outcome | string (from `settings.visitOutcomes`) | ✓ |
| peopleMet | string ≤ 500 | – |
| discussionPoints | string ≤ 4000 | – |
| observations | string ≤ 4000 | – |
| clientResponse | string ≤ 2000 | – |
| pendingActions | string ≤ 2000 | – |
| nextSteps | string ≤ 2000 | – |
| proposedFollowUpDate | timestamp | – (a suggestion; Admin decides on approval) |

Activities are stored **inside** the visit document instead of a separate `visit_activities` collection. The list is short and always read together with the visit, so this saves reads and keeps report updates atomic.

- **Read:** Admins; a USER reads only visits where `userId == uid` (A3).
- **Create:** a USER for themselves (ad hoc, with `checkIn`; or scheduled), when the client is ACTIVE and they are in `assignedUserIds`. Admins create SCHEDULED visits for an assigned salesperson.
- **Update:** only the transitions and fields in the lifecycle table. `clientId`, `userId`, `checkIn`, `checkOut` and `createdAt` are immutable once set.
- **Delete:** never.

**Queries:**
- USER: `userId == uid`, ordered by `createdAt desc`; `userId == uid AND status == SCHEDULED`, ordered by `scheduledFor`.
- Admin: filters on `status`, `userId`, `clientId` and a `createdAt` range.

### `organizations/{orgId}/visits/{visitId}/photos/{photoId}`
Replaces the `visit_photos` collection from the spec (ADR-006).

| Field | Type | Req |
|---|---|---|
| data | string (base64 JPEG), ≤ 300,000 characters | ✓ |
| contentType | `image/jpeg` | ✓ |
| width, height | int ≤ 1600 | ✓ |
| sizeBytes | int ≤ 225,000 | ✓ |
| capturedAt | timestamp (device) | ✓ |
| uploadedBy | string | ✓ |
| createdAt | timestamp | ✓ |

- **Read:** Admins; the visit owner.
- **Create:** the visit owner, while the visit is IN_PROGRESS or RETURNED, and only if `photoCount` stays ≤ 5 (the parent's `photoCount` is incremented in the same batch and checked with `getAfter`).
- **Update:** never.
- **Delete:** the visit owner, only while the visit is IN_PROGRESS or RETURNED, with `photoCount` decremented in the same batch.

### `organizations/{orgId}/visits/{visitId}/revisions/{revisionId}`
Correction trail (D7). Fields: `editorId`, `reason` (≤ 1000), `before` (map: the changed `report` fields), `after` (map), `photosAdded` (string[]), `photosRemoved` (string[]), `createdAt`.

- **Create:** the visit owner, only in the same batch as a RETURNED → SUBMITTED update.
- **Read:** Admins and the visit owner.
- **Update/Delete:** never.

### `organizations/{orgId}/followups/{followupId}`

| Field | Type | Req |
|---|---|---|
| clientId, userId | string | ✓ |
| clientName, userName | string | ✓ (display snapshots) |
| visitId | string or null | ✓ (source visit, null for standalone) |
| dueDate | `YYYY-MM-DD` string | ✓ |
| title | string (3–160 chars) | ✓ |
| notes | string ≤ 1000 | ✓ |
| status | `OPEN` \| `DONE` \| `CANCELLED` | ✓ |
| completedAt, completedBy, completionNote | timestamp, uid, string | null/empty until completion |
| createdBy, createdAt, updatedAt | | ✓ |

**Overdue** = `status == OPEN AND dueDate < start of today`. It is computed, not stored.

- **Read:** Admins; a USER reads their own.
- **Create:** Admins (including on approval); a USER for themselves, for an assigned client.
- **Update:** Admins; the owner may move OPEN → DONE (with a completion note) or change `dueDate` and `note` while OPEN.
- **Delete:** never.

**Queries:** USER `userId == uid AND status == OPEN`, ordered by `dueDate`; Admin filters on `userId`, `status` and a `dueDate` range.

### `organizations/{orgId}/notifications/{notificationId}`
Fields: `recipientUid`, `type` (`ASSIGNMENT_ADDED` \| `ASSIGNMENT_ENDED` \| `VISIT_SCHEDULED` \| `VISIT_RETURNED` \| `VISIT_APPROVED` \| `ANNOUNCEMENT`), `title`, `body`, `entityType`, `entityId`, `readAt` (nullable), `createdBy`, `createdAt`.

- **Create:** Admins only, in the same batch as the action that triggers the notification.
- Salespeople never write notifications. Admins see newly submitted visits in a live **"Awaiting approval"** queue (`visits where status == SUBMITTED`) instead.
- **Read:** the recipient.
- **Update:** the recipient may set `readAt` only.

Follow-up reminders are **computed in the app** from `followups` (no scheduled jobs on Spark), not stored as notifications.

### `organizations/{orgId}/audit_logs/{auditLogId}`
Fields: `orgId`, `actorId`, `actorRole`, `action` (enum, see `SECURITY.md` §6), `entityType`, `entityId`, `summary`, `metadata` (nullable; never passwords or tokens), `createdAt`.

- **Create only:** `actorId == uid`, `createdAt == request.time`.
- **Read:** Admins.
- **Update/Delete:** never.

## Composite indexes (`firebase/firestore.indexes.json`)

| Collection | Fields |
|---|---|
| clients | assignedUserIds (array-contains), status, nameLower |
| clients | status, nameLower |
| visits | userId, createdAt desc |
| visits | userId, status, scheduledFor |
| visits | clientId, createdAt desc |
| visits | status, createdAt desc |
| visits | userId, status, createdAt desc |
| followups | userId, status, dueDate |
| followups | status, dueDate |
| client_assignments | clientId, status |
| client_assignments | userId, status |
| notifications | recipientUid, createdAt desc |
| audit_logs | entityType, createdAt desc |

The final set is generated from the actual queries in M3–M8 and checked against the emulator.

## Archival and retention

- **Clients and users:** `status = INACTIVE`. History stays linked.
- **Visits:** kept permanently (APPROVED and CANCELLED are final).
- **Photos:** may later be exported and removed by an Admin-only archive procedure, which records a revision. This will be designed in M8/M9 if the quota requires it.
- **Audit logs:** kept permanently.
