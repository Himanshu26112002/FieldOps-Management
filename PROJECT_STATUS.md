# Project Status — FieldOps AI

Last updated: 2026-11-05

| Milestone | Status |
|---|---|
| M0 Discovery and Architecture | **IMPLEMENTED** |
| M1 Project Foundation | **IMPLEMENTED** (web/mobile workspace, Firebase config, rules, tests) |
| M2 Authentication and Roles | **PARTIAL** (membership-based roles; runtime auth not verified) |
| M3 Client Management | **IMPLEMENTED IN CODE** (web admin, mobile assigned-client list; integration not verified) |
| M4 Salespeople and Assignments | **IMPLEMENTED IN CODE** (web admin; uses Spark-compatible client provisioning) |
| M5 Field Visit Management | **PARTIAL** (web workflows and newly completed mobile schedule/report routes; not integration tested) |
| M6 Photos and Follow-ups | **PARTIAL** (web follow-ups; mobile follow-up create/complete; photo behavior requires device verification) |
| M7 Offline | **NOT IMPLEMENTED as durable sync** (selected AsyncStorage read snapshots exist; no durable write outbox; see `docs/OFFLINE_SYNC.md`) |
| M8 Analytics and Reports | **IMPLEMENTED IN CODE** (web dashboard/reports; data not verified against a live backend) |
| M9 Final Hardening | **PARTIAL / NOT VERIFIED** (typechecks, web build and Android JS export pass; emulator rules, lint and runtime checks remain) |

## Production readiness update — 2026-11-06

- Follow-up Firestore updates now require the known schema, preserve ownership/display snapshot fields, validate string limits and constrain completion metadata by status. Two deny assertions were added. The updated suite has not run because the emulator exits before Vitest with a Java/Windows Netty loopback selector error.
- Mobile and web TypeScript checks, shared package typechecks, shared validation tests (7/7), web static production build, and Android JavaScript export without Hermes bytecode passed in the latest run.
- Web lint still fails (14 errors, 6 warnings). Mobile lint is not configured/available locally. Firebase runtime, Android device/release, backups/restores, client acceptance and deployment remain unverified.
- The README and `docs/PRODUCTION_READINESS.md` link to current evidence and operator checklists.

## M0 — Discovery and Architecture (historical snapshot)

**Implemented:**
- Inspected the repository (empty) and the environment.
- Checked Firebase, Expo and Next.js facts against the official docs (sources in `docs/ARCHITECTURE.md` §4).
- Recorded the owner's decisions D1–D10.
- Completed the schema, rules, offline and GPS designs.

**Files created:** `.gitignore`, `README.md`, `PROJECT_STATUS.md`, `apps/web/.env.example`, `apps/mobile/.env.example`, `docs/*.md` (11 files).

**Tests executed:** none (no code yet).

**Environment found (historical M0 snapshot, not current):**
- Windows 11; Node 22.19.0; npm 11.6.0; pnpm 12.15.0; git 2.51.1.
- The repository has since been initialized; current environment details should be captured when a supported Android/device run is scheduled.

**Key constraints discovered:**
- Firebase Storage requires Blaze (since 2026-02-03), so photos are stored in Firestore. Capacity is about 5,000 photos in total; see `docs/COST_AND_FREE_TIER_POLICY.md` §4.
- Cloud Functions require a billing account, so the system has no server code.
- The checked-in mobile app uses the Firebase JS SDK; durable offline write synchronization is not implemented. Auth persistence and Android runtime behavior need device verification (see `docs/OFFLINE_SYNC.md`).

**Open items for the owner:**
- Approval to start M1.
- Assumptions A1–A5 (`docs/PRODUCT_REQUIREMENTS.md` §3).
- Expected volume (salespeople, visits per day, photos per visit) to confirm photo capacity.
- Organization time zone (assumed Asia/Kolkata).

**Current audit:** See [docs/MVP_AUDIT.md](docs/MVP_AUDIT.md) for the feature checklist, code changes, test outcomes, and remaining verification work.

**Next milestone:** Resolve the emulator loopback failure and rerun the updated rules suite, then complete Firebase integration and Android device/client acceptance. See `docs/PRODUCTION_READINESS.md` for remaining gates.
