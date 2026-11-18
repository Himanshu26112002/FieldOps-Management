# Testing — FieldOPS

Updated 2026-11-06. Starting an app or compiling code is not proof of Firebase integration. Security is only called tested when the Firestore Rules suite completes against the Emulator Suite.

## Local checks

From repository root:

```powershell
npm ci
npm run typecheck --workspaces --if-present
npm run test -w @fieldops/shared-validation
npm run build -w @fieldops/web
npm run test:rules
```

If the system Java shim is misconfigured and Temurin JDK 21 is installed, select it only for the test process:

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.13.9-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm run test:rules
```

The project uses npm workspaces. Do not install missing lint dependencies from the network without approval. Web lint runs via `npm run lint -w @fieldops/web`; mobile lint requires a valid Expo ESLint config and locally installed package. No complete lint pass is currently established.

Android JS bundle smoke check (not a native or release build):

```powershell
cd apps/mobile
npx expo export --platform android --no-bytecode --output-dir dist
```

The `--no-bytecode` flag avoids the restricted Hermes temp-file output observed on this machine; release builds must use the documented supported local/EAS process and be independently verified.

## Security rules test matrix

The suite in `firebase/tests/rules.test.ts` exercises active membership, role, org boundaries, assignment and ownership, lifecycle, field shape, audit, notification and follow-up rules. It pairs denials with allowed operations so a blanket deny does not falsely pass the suite. Recent added regression cases ensure follow-up updates cannot add arbitrary fields or alter client display snapshots. The current exact test count is reported only by an actual completed Vitest run.

| Security case | Expected |
|---|---|
| Unauthenticated or unprovisioned account | Denied on protected data |
| Admin role/status self-escalation | Denied; Admin may perform permitted same-org administration |
| Inactive membership | Denied on membership, profile, organization, client, visit, follow-up and notification paths |
| Assigned vs unassigned client | Assigned user can read; unassigned user and unfiltered unauthorized query are denied |
| Visit visibility and lifecycle | Owner may perform allowed transitions; another salesperson cannot read/update; salesperson cannot approve |
| Follow-up access and updates | Owner/admin paths allowed by lifecycle; cross-user access, unknown fields, forged metadata and snapshot mutation denied |
| Profile edits | Salesperson may update only permitted personal fields; unknown fields/role escalation denied |
| Notifications | Only active recipient in the path organization may read/mark read; inactive/cross-user access denied |
| Admin client assignment/history atomicity | Admin-only assignment writes; rules do not currently require a corresponding history record (known gap) |
| Audit log completeness | Records are append-only, but rules do not require one for every sensitive write (known gap) |
| Organization boundary and deletion | Cross-org access and hard deletes denied |

Current result: **not completed in this environment**. With Temurin JDK 21, the Firestore emulator exits before Vitest due to Netty's Windows WEPoll loopback connection error (`Unable to establish loopback connection`, `Invalid argument: connect`). A prior 28/28 result was reported by an earlier phase but was not reproduced here. Do not claim the changed rules or new cases are verified until the suite completes.

The emulator is configured for `demo-fieldops`, Firestore only, loopback ports, and local fixture data. Emulator seed scripts may use a development-only Admin SDK dependency; app code does not. Never point the rules suite at a production project.

## Required integration and device acceptance

Use [CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) on an owner-configured test Firebase project and physical Android device. Must include:

- Admin and salesperson sign-in, sign-out, password reset and membership deactivation.
- Create salesperson/client, assignment, visit scheduling, GPS check-in/out, report submission, approve/return and follow-up lifecycle.
- User A attempting to read User B's client, visit, follow-up and notifications.
- Permission denial, poor/unavailable GPS, network loss, duplicate taps, interrupted visit and restart/session behavior.
- Safe backup restore in an isolated target.

No such Firebase/device cases are currently marked passed. `MVP_AUDIT.md` records the exact checks executed in the latest run and remaining blockers.
