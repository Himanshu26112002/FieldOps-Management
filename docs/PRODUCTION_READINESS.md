# FieldOPS production readiness

Updated: 2026-11-06. This checklist distinguishes code present from behavior verified against Firebase or a device. No production deployment or live project access was performed for this audit.

## Readiness checklist

| Area | Status | Evidence / remaining work |
|---|---|---|
| Repository and project guidance | Verified | Workspace structure, package scripts, README, current MVP audit, tests, Firebase rules/config, deployment and operations docs inspected. |
| Web and mobile code presence | Implemented, not runtime verified | Admin routes and Expo Router screens exist; code presence does not establish working Firebase workflows. |
| Firebase initialization and owner configuration | Implemented, not verified | Web/mobile read public Firebase project values from environment; no environment or credential file was manually inspected or changed. The web build loaded its normal environment internally without printing values. |
| Firestore authorization | Implemented; suite previously reported passing, rerun blocked | Rules use active membership documents and deny by default. Previous audit reports 28/28; current emulator cannot initialize its loopback selector, so this session has no fresh result. |
| Audit log completeness | Incomplete | Audit documents are immutable once created, but the rules do not require a matching audit entry for every sensitive business write. A modified client can omit an entry. |
| Assignment history consistency | Incomplete | Only Admins can change client assignment arrays, but rules do not require matching assignment-history records; app batching is not an enforced invariant. |
| Authentication and account provisioning | Not integration verified | Client SDK flows are present. Verify login, session persistence, deactivation and provisioning in an owner-configured emulator/project. |
| Data integrity and workflows | Partially implemented; runtime not verified | Follow-up and profile schema/immutability gaps found by static review were constrained. End-to-end Admin → assignment → visit → approval → follow-up has not run; updated rules cannot be emulator-tested here. |
| Mobile device, GPS, session persistence | Not verified | No Android device/development build was available. Current mobile app uses Firebase JS SDK default Auth persistence; native persistence is not established. |
| Mobile offline writes/recovery | Not implemented | AsyncStorage stores selected read snapshots only. No durable Firestore cache, outbox, restart reconciliation, or user-visible sync states exist; see [OFFLINE_SYNC.md](OFFLINE_SYNC.md). |
| Web lint | Failing | `npm run lint -w @fieldops/web` reproduced 14 errors and 6 warnings. |
| Mobile lint | Blocked | `eslint-config-expo` is declared but absent locally and no mobile ESLint config exists; this pass did not install dependencies. |
| Production web build | Passed locally; not deployed | `npm run build -w @fieldops/web` generated the static export. Hosting site, authorized domain, target project, rules/indexes and rollback remain owner actions. |
| Android JS bundle | Passed smoke check only | Expo Android export passed with `--no-bytecode`; no signed native release or device compatibility has been verified. |
| Android release configuration | Partially implemented | Expo app config exists; package identity, signing, release build and device acceptance need validation. |
| Dependency vulnerability assessment | Not verified | No reviewed vulnerability assessment was completed in this pass. |
| Backup and recovery | Not configured / not verified | No verified scheduled backup or tested restore. See [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md); managed export requires a plan/service decision. |
| Monitoring and incident response | Incomplete | Console usage review is documented; no alerting/error-reporting or incident drill has been configured or tested. |
| Client acceptance | Not run | Use [CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) on the owner's Firebase project and Android device. |
| Deployment | Not deployed | Reproducible build and checklist in [DEPLOYMENT.md](DEPLOYMENT.md); no live deployment was requested or performed. |
| Spark cost constraints | Documented risk | Firestore-only photo storage has finite capacity; plan/quota and client volume must be accepted. See [COST_AND_FREE_TIER_POLICY.md](COST_AND_FREE_TIER_POLICY.md). |

## Definition of readiness

Do not label this application production-ready until the blocked Firebase, Android, restore, client acceptance, security suite, lint and deployment checks have evidence recorded in this file and `MVP_AUDIT.md`. A passing compile or build is not an integration result.

## Security review scope and limitations

Static review covered the Firestore rules and Firebase initialization files listed in the audit. It is not an independent penetration test, dependency vulnerability assessment, or review of a live Firebase configuration. Rules are the authorization boundary; client route guards are UX only. No security rules were weakened and no credentials were inspected.

## Owner actions required

1. Configure Firebase values privately and confirm the intended production project, organization ID, Auth provider, authorized domains and bootstrap Admin.
2. Run the Firebase Emulator Suite and rules suite on a supported local Java runtime; record the fresh results.
3. Complete the integration and device cases in `CLIENT_ACCEPTANCE.md`.
4. Choose and exercise a Spark-compatible export/restore process or explicitly approve any paid backup-dependent design.
5. Review quotas, retention, photo capacity, incident contacts and rollout/rollback ownership before onboarding real users.
