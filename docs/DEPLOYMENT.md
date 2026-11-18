# Deployment guide

Status: **not deployed; release readiness is incomplete**. This guide describes the checked-in targets and commands. The owner must configure the intended Firebase project and approve each production operation. No production deployment was performed during this audit.

## Web dashboard (Firebase Hosting, static export)

Prerequisites: Node/npm versions compatible with the lockfile, owner-configured `apps/web/.env.local`, correct Firebase project/organization ID, approved Hosting site, Auth authorized domain, and tested Firestore rules/indexes.

From the repository root:

```powershell
npm ci
npm run typecheck -w @fieldops/web
npm run build -w @fieldops/web
npm run test:rules
```

The web build outputs static files to `apps/web/out` (`output: "export"`, Webpack build). Review that output and the Firebase project selection before deployment. After explicit owner approval, deploy the Hosting target and rules/indexes using the Firebase CLI in the repository root:

```powershell
firebase use <owner-approved-project-id>
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Before live deployment, verify the selected project, Hosting site, Auth authorized domain, Firestore region, rules-test result, and rollback artifact. Do not deploy with the demo project ID. Static hosting has no server-side route protection; Firestore Rules enforce data access.

## Android application

The checked-in mobile app uses Expo Router and Firebase JS SDK with `EXPO_PUBLIC_*` configuration. A local Metro export can validate JavaScript bundling:

```powershell
cd apps/mobile
npm run typecheck
npx expo export --platform android --no-bytecode --output-dir dist
```

`--no-bytecode` is useful for local bundling checks; it is not a release build. A production Android artifact still needs a confirmed unique Android application ID, signing/build profile, versioning, owner-controlled Firebase values, and device acceptance. These values are not supplied by this repository. No Android release build or device verification is claimed.

Before distribution, verify login/session behavior, GPS permission and accuracy, client access, visit/report and follow-up flows, deactivation, network recovery, crash behavior and release signing on supported devices. EAS/cloud build choices and store registration may have cost or account requirements; confirm current terms with the owner before use.

## Firebase setup and rollback

Follow [FIREBASE_CONFIGURATION.md](FIREBASE_CONFIGURATION.md). Deploy rules and indexes only after the latest local rules suite passes and the owner approves the target. Keep the previous approved static artifact and rules revision. For rollback, redeploy the last approved artifact and a reviewed prior rules revision; never roll back to a rule set with a known vulnerability.

## Launch blockers

- No live Firebase integration or production configuration has been verified.
- The latest emulator run is blocked by the Firestore emulator's Java/Windows loopback selector failure; see `MVP_AUDIT.md`.
- Web lint currently fails on existing Hook/Compiler diagnostics.
- Mobile lint is unavailable because its declared Expo ESLint config is absent locally; network installation was not attempted.
- Android release identity/signing and physical-device test are not complete.
- Backup/restore, monitoring/alerting and client acceptance remain incomplete. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) and [CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md).
