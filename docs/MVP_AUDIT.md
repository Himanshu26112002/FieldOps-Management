# FieldOPS MVP and production audit

Updated 2026-11-06. This is a source/configuration audit plus the local checks listed below (executed 2026-11-05). Firebase project operations, real-device use and production deployment are not verified. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the launch checklist.

## Functionality checklist

| Area | Status | Evidence / limitation |
|---|---|---|
| Web authentication | Implemented, integration not verified | Email/password sign-in and membership/active checks in app code. Auth provider, project and authorized domains need owner-project testing. |
| Mobile authentication | Implemented, device behavior not verified | Email/password and auth-aware routes. Firebase JS SDK default auth persistence is used; native persistence is not established. |
| Membership authorization | Implemented; fresh rules result blocked | Membership documents are the authority for org, role and active status. No custom claims. Client route guards are not the authorization boundary. |
| Web client workflows | Implemented in code, not end-to-end verified | Listing/search, create/edit, assignment and status actions. Actual Firebase operations have not been exercised. |
| Web salesperson workflows | Implemented in code, not end-to-end verified | Secondary Auth client provisioning and profile/membership writes. Partial failure behavior and email reset require integration testing. |
| Web visit workflows | Implemented in code, not end-to-end verified | Schedule, list, review, approve/return and cancel flows. Rules enforce role/lifecycle constraints, but this session could not run them. |
| Web follow-ups | Implemented in code, not end-to-end verified | Create, complete, cancel, list/filter. Assignment, notifications and lifecycle need emulator/project verification. |
| Web profile | Partially implemented | Organization settings exist; no personal profile editor route was found. |
| Mobile assigned clients/details | Implemented in code, runtime not verified | Assigned-client list and details with contact/address, personal visit history and related follow-ups. |
| Mobile visit workflows | Implemented in code, device/runtime not verified | Scheduling, check-in/report and visit detail routes exist. GPS, camera, interrupted visits, offline and recovery need a physical device. |
| Mobile follow-ups | Implemented in code, runtime not verified | List/filter, create and complete; editing/cancellation are unavailable in mobile. |
| Mobile profile | Implemented in code, device/runtime not verified | Self-service profile and sign-out. |
| Firestore authorization | Implemented; test execution blocked | Static review found follow-up updates accepted unrecognized fields and could mutate display snapshots / completion metadata. Rules now constrain keys, protect snapshots and restrict metadata by lifecycle. The new tests were not executed because the emulator exited before Vitest. |
| Web lint | Failing | `npm run lint -w @fieldops/web`: 14 errors and 6 warnings in existing React Hook/Compiler and unused-variable findings. |
| Mobile lint | Not run / blocked | `eslint-config-expo` is declared but absent from local `node_modules`; there is no mobile ESLint config. No network install was attempted. |
| Firebase runtime / E2E | Not verified | No live project test. Emulator could not start its Firestore Netty loopback selector. |
| Backup and restore | Missing/unverified | No configured backup/export, restore procedure execution, or recovery point evidence. See `BACKUP_AND_RECOVERY.md`. |
| Web deployment | Not deployed | Build output is static; target project, domain, rules/indexes, rollback and owner approval remain outstanding. |
| Android release | Not verified | JS export passes without bytecode, but no signed release build, application ID confirmation or device acceptance. |

## Exact checks executed in this run

| Command | Result |
|---|---|
| `npm run typecheck -w @fieldops/mobile` | Passed |
| `npm run typecheck -w @fieldops/web` | Passed |
| `npm run typecheck --workspaces --if-present` | Passed for web, mobile and shared packages |
| `npm run test -w @fieldops/shared-validation` | Passed: 1 file, 7 tests |
| `npm run build -w @fieldops/web` | Passed; static routes exported |
| `expo export --platform android --output-dir dist` | Failed when Hermes bytecode output hit restricted temp path (`permission denied`) |
| `expo export --platform android --no-bytecode --output-dir dist` | Passed; Metro bundled 1,783 modules and produced Android JS bundle. Not a release build. |
| `npm run lint -w @fieldops/web` | Failed: 14 errors, 6 warnings |
| `npm run lint -w @fieldops/mobile` | Not run: local config dependency is absent; no network install attempted |
| `npm run test:rules` (JDK 21 selected for this process) | Failed before Vitest: Firestore Emulator exited with Netty `Unable to establish loopback connection` / `Invalid argument: connect`. No new rules pass count is claimed. |

The previous audit reported a 28/28 rules suite baseline provided for that phase, but it was not reproducible in this run. Six denial assertions were added for follow-up, profile and inactive-notification fixes; no updated total is known until the suite runs. Emulator-only seed scripts use `firebase-admin` as a development dependency; neither application imports it and no service-account credential was exposed.

## Security and data-integrity findings

- Membership documents remain the trusted role/status source; rules are intended to be the data authorization boundary.
- Follow-up update rules previously lacked an allowlist for fields and permitted changes to client/user display snapshots. The rule now requires the complete known schema, rejects extra keys, locks identity/snapshot fields, validates string bounds and prevents completion metadata changes while open or cancelled.
- Profile update rules previously allowed unknown fields. They now require the known profile schema, preserve the email/identity fields, and validate editable field lengths while retaining the existing profile/membership role and status checks.
- Notification reads/updates previously checked recipient identity but not active membership. Rules now require an active membership in the notification's organization; creates also reject inactive recipients. Inactive-user regression assertions were added.
- Added rules tests assert denial of unknown follow-up/profile fields, client snapshot mutation, forged completion metadata on an open follow-up, and inactive-user notification read/update. These have **not** run because emulator initialization failed.
- Client assignment-list changes are Admin-only, but the rules do not require a matching assignment-history document. The web app batches both; a modified Admin client can create history inconsistency. This remains a data-integrity gap.
- Audit-log rules are append-only for records that exist, but they do **not** enforce a corresponding audit record for every sensitive business write. App code batches logs for many operations; a modified client can omit them. Audit completeness is a remaining production data-integrity risk.
- Static review is not a penetration test. No Firebase Auth or Firestore request was made to a live owner project.
- Risk still requiring explicit design decision: account provisioning is client-side and email/password self-signup must remain enabled in Firebase Auth; orphan accounts have no membership and rules should deny them. Test this in the owner's project.
- Firestore-stored photos have finite Spark capacity; expected volume and retention need client approval.

## Changed files in this readiness pass

- `firebase/firestore.rules` — constrain follow-up/profile updates, require active membership for notifications, and correct the membership-provisioning comment.
- `firebase/tests/rules.test.ts` — add six denial assertions and an inactive-recipient fixture.
- `apps/web/.env.example`, `apps/mobile/.env.example` — make emulator opt-in in examples and align mobile template with the Firebase JS SDK (no credentials added).
- `docs/MVP_AUDIT.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/FIREBASE_CONFIGURATION.md`, `docs/PRODUCTION_READINESS.md`, `docs/ADMIN_ONBOARDING.md`, `docs/CLIENT_ACCEPTANCE.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/OFFLINE_SYNC.md`, `docs/DATABASE_SCHEMA.md`, `docs/API_AND_DATA_ACCESS.md`, `PROJECT_STATUS.md`, `README.md` — record evidence, align implementation documentation, and document known blockers.

No `.env`, `.env.local`, or Firebase credential file was manually inspected or modified, and no live data or production resource was accessed. Next.js loaded its normal environment internally during the build; no values were printed or reviewed.

## Remaining blockers / next milestone

1. Resolve or move the emulator suite to a supported host/runtime, then rerun all existing and new Firestore rule tests and record the actual total.
2. Fix the web lint errors without suppressing rules; establish a mobile ESLint config without network-dependent installs.
3. Run Auth + Firestore end-to-end cases on an owner-configured emulator/project, including cross-user denials and account deactivation.
4. Confirm Android package identity/signing, build a development/release artifact and complete GPS/session/offline acceptance on supported devices.
5. Agree backup retention/cost and exercise restore; configure monitoring/incident ownership.
6. Complete client acceptance and owner-approved production deployment/rollback.
