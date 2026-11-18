# Security — FieldOps AI

Last updated: 2026-11-06. Status: **Implemented in Firestore Rules; runtime suite currently blocked in this environment.** See `MVP_AUDIT.md` for the exact emulator failure and the follow-up update hardening performed in this audit.

## 1. Principles

- **Firestore Security Rules are the only authorization boundary.** Route guards in the web and mobile apps are UX only.
- **Deny by default.** Every path not explicitly allowed is denied.
- **Identity** comes from Firebase Auth (`request.auth.uid`). **Authority** (role, organization, active status) comes from `memberships/{uid}`, which only Admins can write.
- The organization ID always comes from the **document path** and is checked against the caller's membership. A value sent by the app is never trusted.
- **No privileged credentials** exist anywhere in the system: no Admin SDK keys, no service accounts, no server.

## 2. Rule helper functions

The rules define `signedIn`, `membershipPath`, `membershipData`, `memberOf`, `activeMemberOf`, `isAdmin`, `isSalesperson`, `isSelf`, `clientData`, `activeClient`, `isAssigned`, `activeUser`, `visitData`, and lifecycle validators. See `firebase/firestore.rules` for their current bodies and each collection's allow conditions. Emulator execution is currently blocked; no runtime result is implied here.

## 3. Permission matrix

| Resource | ADMIN (active, same org) | USER (active) | Anyone else |
|---|---|---|---|
| memberships | read/write (cannot change own role/status) | read own | deny |
| organizations | read; update settings | read | deny |
| users | read/write | read own; update own `fullName`, `phone` | deny |
| clients | read/write, no delete | read if assigned | deny |
| client_assignments | create; end | read own | deny |
| visits | read all; schedule; approve; return; cancel | create/update own within lifecycle rules; read own | deny |
| photos | read | create/delete on own active or returned visit; read own | deny |
| revisions | read | create with resubmission; read own | deny |
| followups | read/write, no delete | create/update own; read own | deny |
| notifications | create; read own | read own; set `readAt` | deny |
| audit_logs | create (self as actor); read | create (self as actor) | deny |

**INACTIVE** memberships and **missing** memberships are denied everything. A login account created through open sign-up (ADR-005) has no membership and therefore no access.

## 4. Field and transition enforcement

- Every write must contain exactly the allowed fields (`keys().hasOnly`) and the required fields (`hasAll`), with correct types, string lengths and enum values.
- `createdAt`/`updatedAt == request.time`. `createdBy`/`actorId == request.auth.uid`.
- **Immutable after creation:** `visits.clientId`, `visits.userId`, `checkIn`, `checkOut` (once set), `createdAt`, `createdBy`.
- Visit status changes are allowed only as listed in `PRODUCT_REQUIREMENTS.md` §6. Each transition rule checks who the caller is and the required fields.
- Only active Admins may change `clients.assignedUserIds`. App code batches assignment-history updates with these changes, but the rules do **not** enforce a matching `client_assignments` record. This consistency gap is documented as a production risk.
- `visits.photoCount` must match the photo created or deleted in the same batch.
- Admins cannot change the `status` or `role` of their own membership, which prevents locking out the last Admin by accident.

## 5. Account lifecycle

| Step | How | Notes |
|---|---|---|
| First Admin | In the Firebase Console: add the user under Authentication, then create `organizations/{orgId}` and `memberships/{uid}` under Firestore | The Console bypasses rules. This is a one-time step, documented in `FIREBASE_CONFIGURATION.md`. |
| Create salesperson | Dashboard → secondary app `createUserWithEmailAndPassword` (random temporary password) → sign out of the secondary app → batch: membership + profile + audit log → `sendPasswordResetEmail` | ADR-005. The temporary password is never shown, stored or logged. |
| Deactivate | Admin sets membership and profile `status = INACTIVE` (one batch, audited) | Blocks all data access on the next request. The apps also force sign-out when they detect it. |
| Reactivate | Status set back to `ACTIVE` | |
| Role change | Admin edits `memberships.role` | Takes effect immediately; the apps refresh navigation. |
| Disable the login itself (optional) | Firebase Console → Authentication → disable user | Not possible from the dashboard without the Admin SDK. |

**Known risk:** email/password sign-up stays enabled for the current provisioning flow, so anyone could create a login account with no membership. Expected mitigations and remaining work:
- Rules deny all data to accounts without a membership.
- Verify Auth sign-up/rate-limit settings with the owner; this audit did not inspect the live project.
- App Check is not implemented or enforced in the app.
- Admins can review stray accounts in the Console.

## 6. Audit logs

**Rule-accepted actions:** `LOGIN`, `CLIENT_CREATED`, `CLIENT_UPDATED`, `CLIENT_DEACTIVATED`, `CLIENT_ASSIGNED`, `CLIENT_UNASSIGNED`, `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`, `VISIT_SCHEDULED`, `VISIT_STARTED`, `VISIT_SUBMITTED`, `VISIT_RESUBMITTED`, `VISIT_APPROVED`, `VISIT_RETURNED`, `VISIT_CANCELLED`, `FOLLOWUP_CREATED`, `FOLLOWUP_COMPLETED`, `FOLLOWUP_CANCELLED`, `ORG_SETTINGS_UPDATED`.

- Audit logs are create-only, can never be updated or deleted, and only Admins can read them.
- The apps currently batch audit writes with many business operations, but **the rules do not require a matching audit document for each business write**. A modified client may omit an audit record; completeness is not guaranteed. This is a production data-integrity gap that must be accepted or closed before treating the ledger as complete.
- **Limitation (no server):** entries that are written are client-authored. Rules constrain actor identity/action/timestamp and prevent updates/deletes, but cannot guarantee that free-text metadata is complete or that every action has a corresponding entry. A trusted server ledger would need server-side infrastructure and a plan/cost decision.
- **Never logged:** passwords, temporary passwords, ID tokens, refresh tokens.

## 7. Client-side security

- **Web:** Firebase Auth session persistence in the browser (IndexedDB) is the SDK default. No tokens in `localStorage` written by app code. Only the public `NEXT_PUBLIC_*` config is in the bundle.
- **Mobile (actual implementation):** Firebase JS SDK `getAuth(app)` is used. Native session persistence has not been verified. AsyncStorage holds selected list snapshots; sign-out clears app-managed cache keys. There is no SQLite outbox or native Firebase Firestore cache in the checked-in app. See `OFFLINE_SYNC.md`.
- **Logging:** never log documents containing location or PII in production builds; never log tokens.

## 8. App Check (not implemented)

- **Providers:** Play Integrity (Android), App Attest / DeviceCheck (iOS), reCAPTCHA Enterprise (web). Provider quotas are to be checked against the Spark plan in M9.
- **It protects against:** requests from scripts or modified clients that are not genuine app builds.
- **It does not protect against:** a legitimate, signed-in user misusing their own permissions. Rules handle that.
- Enforcement is turned on only after monitoring shows that legitimate traffic passes.

## 9. Security test plan

See `TESTING.md` §3. Every row in §3 and every transition in the lifecycle table gets allow **and** deny tests in the emulator.
