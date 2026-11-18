# Firebase Configuration — FieldOps AI

Last updated: 2026-11-06. Project-level values are owner-controlled; runtime configuration was not inspected or verified in this audit.

## 1. Project setup (owner, in the Firebase Console)

1. Create a Firebase project on the **Spark plan**. **Do not add a billing account.**
2. **Firestore:** create the `(default)` database in **Native mode**, in a region close to users (for example an India region). Location applies to Firestore only, since Storage isn't used. The free quota for the chosen region is to be confirmed *(M1)*. The location cannot be changed later.
3. **Authentication:** enable the **Email/Password** provider. Leave user sign-up **enabled**; it is required for in-dashboard account creation (ADR-005).
4. **Apps:** register these:
   - A **Web app**. The checked-in web and Expo mobile clients use Firebase JS SDK values supplied through their respective environment files. Keep these project values out of source code; they are public client configuration, and Firestore Rules provide authorization.
   - Confirm the Android application ID and iOS bundle ID before registering platform apps or producing signed release builds. The current Expo config does not define either release identifier, and this implementation does not read `google-services.json` or `GoogleService-Info.plist`.
5. **Authorized domains** (Authentication → Settings): add the Hosting domain once it is deployed.

## 2. Environment files

| File | Source | Committed? |
|---|---|---|
| `apps/web/.env.local` | Copy of `apps/web/.env.example` | **No** (git-ignored) |
| `apps/mobile/.env` | Owner-configured `apps/mobile/.env.example` values | **No** |

- **Web config values identify the project. They are not secrets.** Security comes from the rules.
- No privileged Admin SDK credential is used by either application. `firebase-admin` is a development dependency used by the local emulator seeding script only; never place a service-account key or Admin SDK credential in the repository or an app.
- The example templates default emulator mode to `false` to avoid accidentally bundling emulator connections into production. For local emulator development, set the corresponding `*_USE_FIREBASE_EMULATORS=true`; mobile on a physical phone also needs `EXPO_PUBLIC_EMULATOR_HOST` set to the development PC's LAN IP. Recheck the final production build environment before deploying.

## 3. First Admin bootstrap (one time, Console only)

1. **Authentication → Users → Add user:** enter the Admin's email and a strong password. Copy the **User UID**.
2. **Firestore:** create the document `organizations/{orgId}` with `name`, `settings` (see `DATABASE_SCHEMA.md`), `createdAt` and `updatedAt`. The orgId is any stable ID, for example `main`. Put the same value in `NEXT_PUBLIC_FIELDOPS_ORG_ID` and `EXPO_PUBLIC_FIELDOPS_ORG_ID`.
3. **Firestore:** create `memberships/{UID}` with `orgId`, `role: "ADMIN"`, `status: "ACTIVE"`, timestamps, and `createdBy: "bootstrap"`.
4. **Firestore:** create `organizations/{orgId}/users/{UID}` with the profile fields.

Use [ADMIN_ONBOARDING.md](ADMIN_ONBOARDING.md) and `DATABASE_SCHEMA.md` to review role/profile fields before bootstrapping the first Admin.

## 4. Emulator Suite

| Emulator | Planned port |
|---|---|
| Auth | 9099 |
| Firestore | 8080 |
| Hosting | 5000 |
| Emulator UI | 4000 |

**Requirements:**
- Install the repository lockfile dependencies with npm while online; no global Firebase CLI is needed.
- A supported JDK. Temurin JDK 21 was available locally for the latest attempt, but the Firestore Emulator still failed in Netty's Windows loopback selector. See `MVP_AUDIT.md`.

**Commands:**
- `npm run emulators`: start the emulators with the local `firebase/emulator-data` import.
- `npm run seed:emulators`: load emulator-only test records (never production data).
- `npm run emulators:reset`: delete `firebase/emulator-data/*`.
- `npm run test:rules`: run the Security Rules tests against the emulators.

**Mobile against the emulators:** set `EXPO_PUBLIC_EMULATOR_HOST` to the PC's LAN IP. The Android emulator can use `10.0.2.2`.

## 5. Deployment of rules and indexes

`firebase deploy --only firestore:rules,firestore:indexes,hosting`. Run this only after the rule tests pass (see `DEPLOYMENT.md`).
