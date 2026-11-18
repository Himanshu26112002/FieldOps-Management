# FieldOps AI

*Intelligent Operations. Smarter Field Service.*

FieldOps AI is a sales field force management and client visit tracking platform with a Next.js admin dashboard, an Expo mobile app for salespeople, and Firebase Authentication/Firestore.

> **Status:** Core workflows are implemented, but FieldOPS is **not production-ready or deployed**. Firebase project workflows, Android device/release behavior, backup/restore, client acceptance, and a fresh Firestore rules suite are not verified. See the [production-readiness checklist](docs/PRODUCTION_READINESS.md) and [MVP audit](docs/MVP_AUDIT.md).

## Documentation

| Document | Contents |
|---|---|
| [docs/PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) | Scope and visit lifecycle |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture decisions and limitations |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Firestore collections and indexes |
| [docs/SECURITY.md](docs/SECURITY.md) | Rules design and permission model |
| [docs/FIREBASE_CONFIGURATION.md](docs/FIREBASE_CONFIGURATION.md) | Project setup, environment values, first Admin and emulators |
| [docs/API_AND_DATA_ACCESS.md](docs/API_AND_DATA_ACCESS.md) | Client-side Firestore writes and dashboard metric definitions |
| [docs/OFFLINE_SYNC.md](docs/OFFLINE_SYNC.md) | Actual mobile cache behavior and offline gaps |
| [docs/GPS_AND_PRIVACY.md](docs/GPS_AND_PRIVACY.md) | Location capture requirements and privacy |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy and security test matrix |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Reproducible build and deployment procedure |
| [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md) | Evidence-based launch checklist |
| [docs/ADMIN_ONBOARDING.md](docs/ADMIN_ONBOARDING.md) | Admin and salesperson onboarding |
| [docs/CLIENT_ACCEPTANCE.md](docs/CLIENT_ACCEPTANCE.md) | Client acceptance test plan |
| [docs/BACKUP_AND_RECOVERY.md](docs/BACKUP_AND_RECOVERY.md) | Backup limitations and recovery procedures |
| [docs/COST_AND_FREE_TIER_POLICY.md](docs/COST_AND_FREE_TIER_POLICY.md) | Spark limits and capacity risks |

## Firebase values and credentials

The owner configures `apps/web/.env.local` and `apps/mobile/.env` from the respective `.env.example` templates. Owner project values are not hardcoded; the emulator-only demo config is selected only when its explicit flag is enabled. The env files are git-ignored. Firestore Rules provide authorization. No privileged credential belongs in an app or this repository.

## Recent delivery and checks

The previous mobile phase added assigned-client details and standalone follow-up creation. This production-readiness pass found and tightened Firestore follow-up and profile update rules against unknown fields and immutable identity/snapshot edits. It added a production readiness checklist plus onboarding, client acceptance and backup/recovery documentation, corrected deployment/Firebase setup guidance to match the checked-in Firebase JS SDK, and documented the actual offline-sync limitations.

Checks in this run:

- `npm run typecheck -w @fieldops/mobile` — passed.
- `npm run typecheck -w @fieldops/web` — passed.
- `npm run typecheck --workspaces --if-present` — passed for web, mobile and shared packages.
- `npm run test -w @fieldops/shared-validation` — 7/7 passed.
- `npm run build -w @fieldops/web` — passed, static export generated.
- `expo export --platform android --no-bytecode --output-dir dist` — Android JS bundle export passed; this is not a signed release build.
- Web lint — failed with 14 existing errors and 6 warnings.
- Firestore rules suite — not completed. With Temurin JDK 21, Firestore emulator exited in Netty's Windows loopback selector before Vitest (`Unable to establish loopback connection`). New deny cases are not claimed as passed.
- Mobile lint — not run: the declared `eslint-config-expo` is absent locally; no dependency installation was attempted.

Firebase runtime, end-to-end workflows, real Android device/GPS, release signing, durable offline writes, complete audit/assignment-history enforcement, backup/restore, client acceptance and production deployment remain unverified. Environment and Firebase credential files were not manually inspected or modified; the web build loaded its normal environment internally without printing its values.
