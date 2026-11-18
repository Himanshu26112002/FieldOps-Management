# Product Requirements — FieldOps AI

**Status:** Approved business decisions recorded 2026-11-02 (Milestone 0).
The full original specification is the owner's "FieldOps AI — Final Master Project Specification". This document records the **scope as decided**, including owner answers that refine that specification.

## 1. Product

Sales Field Force Management & Client Visit Tracking Platform.

- **Web app (Next.js):** Admin dashboard.
- **Mobile app (Expo, Android + iOS):** salespeople (USER) and a simplified Admin view.
- **Backend:** Firebase (Auth, Firestore, Security Rules, Hosting). No custom server.

Primary workflow: Admin creates a client → creates a salesperson → assigns the client → the salesperson checks in by GPS → records activities, report and photos → checks out by GPS → submits → Admin approves (and schedules the next follow-up) or returns the visit for correction.

## 2. Roles

Exactly two: `ADMIN` and `USER` (salesperson). No customer, technician, manager or other roles. No customer portal.

## 3. Owner decisions (Milestone 0)

| # | Topic | Decision | Source |
|---|---|---|---|
| D1 | Organizations | **Single organization.** The data model stays organization-scoped (`organizations/{orgId}/…`) so that more organizations can be added later. | Owner, 2026-11-02 |
| D2 | Client assignment | **A client may have several active salespeople at once.** | Owner |
| D3 | Visit origin | **Ad hoc visits** (started by the salesperson whenever needed) **and scheduled visits.** | Owner |
| D4 | Who schedules | **Admin and salesperson** can both schedule visits in advance. | Owner |
| D5 | GPS | **GPS is mandatory** for check-in and check-out (device GPS costs nothing). No manual check-in exception. | Owner (conditional answer: manual check-in only if GPS cost money) |
| D6 | Review | **Admin formally approves** submitted visits. Approval also schedules the next follow-up. | Owner |
| D7 | Not approved | **Return for correction:** Admin returns the visit with a comment; the salesperson edits it (edits are tracked) and resubmits. | Owner |
| D8 | Photos | **Stored in Cloud Firestore** as compressed images (Firebase Storage requires the Blaze plan, which is declined). | Owner chose option (b) |
| D9 | Account creation | **Created from the Admin dashboard at no cost** using the client SDK through a secondary app instance. No Cloud Functions, no Blaze. | Owner |
| D10 | Billing | **Spark (no-cost) plan only. No billing account.** | Owner |

### Assumptions awaiting owner confirmation

| # | Assumption | Why |
|---|---|---|
| A1 | At most **5 photos per visit**, each compressed to about 150 KB JPEG. | Keeps the 1 GiB Firestore free quota usable (see `COST_AND_FREE_TIER_POLICY.md`). |
| A2 | On approval, Admin must enter a **next follow-up date** unless they tick "No follow-up needed". | D6 says approval schedules the next follow-up; this keeps that step from being skipped by accident. |
| A3 | Salespeople see **only their own visits**, even for a client shared with another salesperson. | Spec 9.3: users cannot read other salespeople's private records. |
| A4 | Only **photographs** are attached. Other documents (PDF etc.) are excluded. | Firestore's 1 MiB document limit and the 1 GiB total quota. |
| A5 | Salespeople cannot cancel a visit scheduled by Admin; only Admin can. | Avoids salespeople removing work that Admin assigned. |

## 4. In scope (initial version)

Admin authentication, dashboard, client management, salesperson management, client assignment (with history), visit scheduling, visit management, approval/return workflow, follow-ups, analytics and CSV export, in-app notifications, audit logs, settings.

Salesperson login, home dashboard, my clients, client details (call action, opens the device's maps app), ad hoc and scheduled visits, GPS check-in and check-out, structured visit report, photos, follow-ups, visit history, offline operation with sync status.

## 5. Explicitly excluded

AI/LLM features, customer portal or login, technicians, equipment or asset management, work orders, inventory, billing, payments, payroll, accounting, CRM integrations, paid APIs (including paid Google Maps APIs), FastAPI/PostgreSQL, Cloud Functions, Firebase Storage, continuous or background location tracking, push notifications (deferred: sending them needs a server).

## 6. Visit lifecycle (approved design)

```
         (Admin or salesperson schedules)
                  SCHEDULED ─────────────┐
                      │ GPS check-in     │ cancel (reason)
   (ad hoc start:     ▼                  ▼
    GPS check-in) ─► IN_PROGRESS ──────► CANCELLED
                      │ GPS check-out + required report fields
                      ▼
                  SUBMITTED ◄──────── resubmit ───┐
                   │      │                       │
          approve  │      │ return (comment)      │
                   ▼      ▼                       │
              APPROVED   RETURNED ─── salesperson edits (revision recorded)
              (final; creates next follow-up)
```

| From | To | Who | Conditions |
|---|---|---|---|
| — | SCHEDULED | Admin; salesperson (own) | Client active; salesperson currently assigned; `scheduledFor` set |
| — | IN_PROGRESS | Salesperson (own) | Ad hoc start; GPS check-in captured; client active and assigned |
| SCHEDULED | IN_PROGRESS | Salesperson (own) | GPS check-in captured |
| SCHEDULED | CANCELLED | Admin; salesperson only if they scheduled it (A5) | Reason required |
| IN_PROGRESS | CANCELLED | Salesperson (own); Admin | Reason required |
| IN_PROGRESS | SUBMITTED | Salesperson (own) | GPS check-out captured; required report fields present |
| SUBMITTED | APPROVED | Admin | Next follow-up date, or "No follow-up needed" (A2) |
| SUBMITTED | RETURNED | Admin | Return comment required |
| RETURNED | SUBMITTED | Salesperson (own) | Revision recorded; check-in/check-out unchanged |

- **APPROVED** and **CANCELLED** are final.
- **Overdue** (a scheduled visit past its date) is computed, not stored as a status.
- Check-in and check-out GPS data can never be edited after capture.
- Pressing check-out alone does not complete a visit: submission also requires the report fields.

## 7. Required visit report fields

Required to submit: at least one activity performed, visit summary, visit outcome. Optional: people met, discussion points, observations, client response, pending actions, next steps, proposed follow-up date, photos. The exact field list is in `DATABASE_SCHEMA.md` (`visits.report`).

## 8. Definition of Done

As in Part 20 of the master specification, read together with the decisions above (for example, "upload photographs" is met by photo storage in Firestore, per D8).
