# Data Access and Metric Definitions — FieldOps AI

Last updated: 2026-11-06 (implementation caveats reconciled)

There is no custom server API. The web and mobile clients call Firestore through `apps/web/lib/data.ts` and `apps/mobile/src/lib/data.ts`. Zod schemas validate supported user inputs, but the app does not comprehensively validate every Firestore document at runtime; Firestore Rules are the authorization boundary. Some data writes use atomic batches and append audit documents, but rules do not require an audit entry for every sensitive action. See `MVP_AUDIT.md` for integrity gaps.

## 1. Write operation patterns (inspect the current service implementation before relying on audit/side-effect completeness)

| Operation | Documents written | Actor |
|---|---|---|
| Create salesperson | (Auth account via secondary app) → membership, profile, audit | Admin |
| Activate/deactivate user | membership.status, profile.status, audit | Admin |
| Create/update client | client, audit | Admin |
| Activate/deactivate client | client.status, audit | Admin |
| Assign | client_assignment (ACTIVE), client.assignedUserIds += uid, notification, audit | Admin |
| Unassign | client_assignment → ENDED, client.assignedUserIds −= uid, notification, audit | Admin |
| Schedule visit | visit (SCHEDULED), notification (if Admin scheduled), audit | Admin / USER |
| Check in | visit (create IN_PROGRESS, or SCHEDULED → IN_PROGRESS) + checkIn, audit | USER |
| Save report | visit.report (partial), updatedAt | USER |
| Add photo | photo, visit.photoCount + 1, audit | USER |
| Check out | visit.checkOut, audit | USER |
| Submit | visit → SUBMITTED, audit | USER |
| Return | visit → RETURNED + comment, notification, audit | Admin |
| Resubmit | visit → SUBMITTED, revision, audit | USER |
| Approve | visit → APPROVED, followup (unless "no follow-up"), client.lastVisitAt, notification, audit | Admin |
| Cancel | visit → CANCELLED + reason, audit | per lifecycle rules |
| Follow-up create/complete | followup, audit | Admin / USER (own) |

Report saves while editing are **not** audited individually (to save writes). The submit or resubmit captures the final state, and revisions capture changes made after a return.

## 2. Dashboard metric definitions

All metrics are scoped to the single organization and to the active filters (date range applied to `createdAt` unless stated, salesperson, client, status). Counts use `count()` aggregations.

| Metric | Definition |
|---|---|
| Total clients | Clients with `status == ACTIVE` |
| Active salespeople | Users with `role == USER AND status == ACTIVE` |
| Assigned clients | `status == ACTIVE AND assignmentCount > 0` |
| Unassigned clients | Active clients − assigned clients |
| Total visits | Visits in the date range with `status != CANCELLED` |
| Scheduled (upcoming) | `status == SCHEDULED AND scheduledFor >= now` |
| Scheduled (overdue) | `status == SCHEDULED AND scheduledFor < start of today` |
| In progress | `status == IN_PROGRESS` |
| Awaiting approval | `status == SUBMITTED` |
| Returned | `status == RETURNED` |
| Approved (completed) | `status == APPROVED`, date range on `approvedAt` |
| Cancelled | `status == CANCELLED`, date range on `cancelledAt` |
| Upcoming follow-ups | `status == OPEN AND dueDate` within the next 7 days |
| Overdue follow-ups | `status == OPEN AND dueDate < start of today` |
| Follow-up completion rate | DONE ÷ (DONE + OPEN due within range) |
| Client coverage | Active clients with an APPROVED visit in range ÷ active clients (computed from `lastVisitAt`) |

"Today" and date boundaries use the **organization's time zone**, assumed to be Asia/Kolkata (IST), to be confirmed by the owner.

## 3. Reports and CSV export

Visit, salesperson-activity and follow-up reports are produced as paginated queries over the date range and exported to CSV in the browser. Exports are capped (for example at 5,000 rows) to protect the read quota.
