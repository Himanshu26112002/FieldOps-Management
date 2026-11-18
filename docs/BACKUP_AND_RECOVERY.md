# Backup, recovery and operations

## Current status

No scheduled backup, export job, restore test, monitoring alert, or production incident drill is configured or verified in this repository. Firestore managed export/import uses Cloud Storage and requires a billing-enabled plan; that is outside the current Spark-only constraint. The dashboard does not currently provide a complete export/restore workflow. Do not treat emulator fixtures, local caches, or audit entries as backups.

## Before production data is entered

The owner must choose an approved retention and recovery method and accept its cost and access-control implications. Until then, business data has no verified recovery point. Do not store service-account keys in the app or repository. If the organization later approves a controlled operator-side export, store it encrypted outside source control, restrict access, set retention/deletion dates, and never restore it over production during a test.

## Recovery exercise (required before launch)

1. Create an isolated Firebase test project or emulator dataset and a documented, approved export from the chosen backup mechanism.
2. Restore into an isolated target; never overwrite production for an exercise.
3. Reconcile document counts and representative client, assignment, visit, follow-up and audit relationships. Confirm sensitive fields and photo payloads are present as intended.
4. Record elapsed time, missing/corrupt records, operator and corrective actions. Obtain owner sign-off on achieved recovery point/time objectives.
5. Repeat at the cadence chosen by the client and after material schema changes.

## Account and incident response

- **Suspected account compromise:** disable the Auth user in Firebase Console, set membership status to `INACTIVE`, preserve relevant audit/context, and contact the designated Admin.
- **Unexpected authorization:** stop affected operations, preserve request/document identifiers (without tokens or credentials), inspect Firestore rules and membership/assignment state, then reproduce in the emulator before any rule change.
- **Bad deployment:** stop further rollout and redeploy the last approved static web artifact/rules revision after review. Rules rollback must not restore a known vulnerability.
- **Quota/service outage:** inspect Firebase Console Auth/Firestore/Hosting status and quota usage; do not silently retry writes in a way that can duplicate visits or follow-ups.
- **Data loss:** follow the approved restore process above. No repository command currently restores a production backup.

## Routine operational checks

- Review Firebase Auth users and Admin membership list after onboarding/departures.
- Review Firestore/Hosting quota and photo storage usage against the Spark limits and volume estimates in `COST_AND_FREE_TIER_POLICY.md`.
- Re-run web/mobile typechecks, production build and Firestore rules suite for releases.
- Review rule/index changes, test outcomes, deployment revision and rollback artifact before deployment.
- Keep a named owner for support, incident escalation, backup access and recovery exercises.

There is no verified automated error reporting or alerting. Current monitoring instructions rely on periodic Firebase Console review.
