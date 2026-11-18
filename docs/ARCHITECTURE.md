# Architecture — FieldOps AI

Last updated: 2026-11-06 (reconciled with implementation)

## 1. Overview

```
                         FIELDOPS AI
               +--------------+--------------+
               |                             |
     NEXT.JS WEB APP (static export)   EXPO MOBILE APP (Expo Router)
     Admin dashboard                   Salesperson workflows
     Firebase JS SDK                   Firebase JS SDK
               |                             |
               +--------------+--------------+
                              |
                    FIREBASE (Spark plan)
          Authentication · Cloud Firestore · Hosting
                              |
                    Firestore Security Rules
               (the only authorization boundary)
```

There is **no server-side code**: no Cloud Functions, no Next.js server, no custom API. Every read and write goes from an app straight to Firebase and is authorized by Security Rules.

## 2. Key decisions

Each entry gives what was chosen, why, the alternatives, limitations, cost and security impact.

### ADR-001 — Firebase Spark-compatible client architecture, no production server code
- **Chosen:** Firebase Auth, Firestore and static Hosting. App Check is not currently initialized in either app.
- **Why:** Owner requirement (D10): ₹0 and no billing account.
- **Alternatives:** Blaze plan with Cloud Functions and Storage. Rejected: it needs a billing account and has budget alerts but no hard spending caps.
- **Limitations:** No trusted server code. Consequences: no scheduled jobs, no push-notification sending, and audit logs are written by the apps (see `SECURITY.md` §6).
- **Cost:** ₹0. When a Spark quota is exhausted, operations fail; nothing is billed.

### ADR-002 — Next.js admin app as a static export on Firebase Hosting
- **Chosen:** Next.js App Router with `output: 'export'`. All data loaded in the browser with the Firebase JS SDK. Hosted on Firebase Hosting.
- **Why:** On Firebase, Next.js server features need Cloud Functions or App Hosting, which require Blaze. The Hosting "frameworks experiment" is closed to new Next.js users.
- **Alternatives:** App Hosting or Functions (Blaze); Vercel (a third-party host, not approved).
- **Limitations:** No server components that fetch data, no middleware, no API routes. Route guards are UX only; Security Rules enforce access.
- **Security:** No server credentials exist, so none can leak.
- **To verify in M1:** that static export works with the chosen App Router features in Next.js 16.x.

### ADR-003 — Expo mobile app with Firebase JavaScript SDK (implemented state)
- **Implemented:** `firebase/app`, `firebase/auth` and `firebase/firestore` from the Firebase JS SDK, initialized in `apps/mobile/src/lib/firebase.ts`; Expo Router app structure.
- **Not implemented:** React Native Firebase, persistent native Firestore cache, App Check, Expo development client configuration, and a durable offline write outbox. AsyncStorage keeps selected read snapshots only; see `OFFLINE_SYNC.md`.
- **Limitations:** Auth persistence across native app restarts and Android/iOS runtime compatibility have not been verified. Do not promise durable offline reads/writes.
- **Release:** Android package ID/signing and iOS bundle ID/distribution remain owner decisions and release work. Build requirements and possible store/account costs must be confirmed before distribution.

### ADR-004 — Roles stored in a Firestore membership document, not custom claims
- **Chosen:** `memberships/{uid}` holds `orgId`, `role` and `status`. Rules read it with `get()`.
- **Why:** Custom claims can only be set with the Admin SDK, and with no server there is no place to run it. Membership changes also take effect on the next request, whereas claims wait for a token refresh (up to about one hour).
- **Alternatives:** Custom claims set from a local Admin SDK script.
- **Cost:** Each rule `get()` counts as a document read. This is acceptable within the quota (see `COST_AND_FREE_TIER_POLICY.md`).

### ADR-005 — Accounts created in the dashboard through a secondary client-SDK app
- **Chosen:** The dashboard calls `createUserWithEmailAndPassword` on a **second** Firebase app instance, so the Admin's own session stays signed in. It then signs that instance out. Next, the Admin writes the membership, profile and audit log in one batch. The salesperson sets their password from a password-reset email.
- **Why:** Owner decision D9: in-dashboard creation at no cost.
- **Limitation:** Email/password self sign-up has to stay enabled in Firebase Auth for this provisioning flow. An account without a membership should have no Firestore access under rules. App Check is not currently implemented; review sign-up abuse and account controls with the owner.
- **Further limitation:** The dashboard cannot delete login accounts or set other users' passwords. Deactivation is done through `memberships.status = INACTIVE`, which blocks access on the next request. Login accounts can also be disabled by hand in the Firebase Console.
- **Security:** No privileged credential is used anywhere. Privilege comes only from a membership document that the rules let only active Admins write.

### ADR-006 — Photos stored in Firestore
- **Chosen:** Photos are compressed on the device (target about 150 KB JPEG, longest side about 1280 px) and stored as base64 in `visits/{visitId}/photos/{photoId}`, one photo per document.
- **Why:** Firebase Storage requires Blaze since 2026-02-03; owner chose option (b).
- **Limitations:** Firestore documents are limited to 1 MiB. Base64 makes each photo about 33% larger, so 1 GiB holds roughly 5,000 photos in total, shared with all other data. A visit has at most 5 photos (assumption A1). Opening each photo costs one document read.
- **Mitigation:** Admin settings show approximate photo usage. A later Admin archive/export procedure can free space (designed in M8 and M9).

### ADR-007 — Mobile offline behavior
- **Implemented:** selected query snapshots in AsyncStorage, used as read fallbacks.
- **Not implemented:** durable Firestore persistence, SQLite outbox, queued-write reconciliation or visible sync states. See `OFFLINE_SYNC.md` for the exact limitations.

### ADR-008 — Monorepo with npm workspaces
- **Chosen:** npm workspaces with `apps/web`, `apps/mobile` and `packages/*`.
- **Why:** npm is already installed and is the least troublesome option with Expo's Metro bundler. pnpm (also installed) would work too.
- **Shared packages:** `shared-types` (domain types and enums) and `shared-validation` (Zod schemas used by both apps).

### ADR-009 — GPS through expo-location, foreground only, mandatory
See `GPS_AND_PRIVACY.md`.

### ADR-010 — No paid map APIs
- **Chosen:** "Navigate" opens the device's maps app using the stored coordinates or address. There are no embedded maps and no address-to-coordinates lookup.
- **Why:** Google Maps Platform APIs need a billing account (D10).

## 3. Technology versions (verified 2026-11-02)

| Item | Version / fact | Source |
|---|---|---|
| Next.js | 16.4 (released 2026-10-06) | https://nextjs.org/blog/next-16-4 |
| Expo SDK | 58, React Native 0.88 (released 2026-10-15) | https://expo.dev/changelog/sdk-58 |
| Firebase JS SDK | Expo supports firebase@12.0.0 and above only | https://docs.expo.dev/guides/using-firebase/ |
| React Native Firebase | Needs a development build; Firestore persistence on by default | https://docs.expo.dev/guides/using-firebase/, https://rnfirebase.io/firestore/usage (site timed out on direct fetch; recheck in M1) |
| Node / npm (dev machine) | 22.19.0 / 11.6.0 | local check |
| Java (dev machine) | JDK 25, JAVA_HOME not set | local check; emulator and Android Gradle JDK requirements to be checked in M1 |

## 4. External sources verified (2026-11-02)

| Topic | Fact relied on | URL |
|---|---|---|
| Spark quotas | Auth 50K MAU; Firestore 1 GiB stored, 50K reads/day, 20K writes/day, 20K deletes/day, 10 GiB egress/month; Hosting 10 GB stored, 360 MB/day | https://firebase.google.com/pricing |
| Storage needs Blaze | "Cloud Storage for Firebase (even default buckets) now requires projects to be on the pay-as-you-go Blaze pricing plan", in effect from 2026-02-03 | https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 |
| Offline persistence | "Offline persistence is supported only in Android, Apple, and web apps." | https://firebase.google.com/docs/firestore/manage-data/enable-offline |
| Firestore limits | 1 MiB per document; at most 10 `get()`/`exists()` calls per rule request (20 for batches and transactions) | https://firebase.google.com/docs/firestore/quotas |
| Aggregation billing | One read per batch of up to 1,000 index entries | https://firebase.google.com/docs/firestore/pricing |
| Listener reconnects | After more than 30 minutes offline, a listener is billed as a new query | https://firebase.google.com/docs/firestore/pricing |
| Custom claims | Admin SDK only; 1,000-byte limit; picked up on token refresh | https://firebase.google.com/docs/auth/admin/custom-claims |
| Sign-up control | Self sign-up can be turned off in Authentication → Settings → User actions | https://firebase.google.com/docs/auth/users |
| createUser behavior | "If the new account was created, the user is signed in automatically." | https://firebase.google.com/docs/auth/web/password-auth |
| Cloud Functions | Need a billing account (Cloud Build, Artifact Registry) | https://firebase.google.com/docs/functions/faq-and-troubleshooting |
| Next.js on Firebase Hosting | Frameworks experiment closed to new Next.js users; App Hosting recommended | https://firebase.google.com/docs/hosting/frameworks/nextjs |
| expo-location | Foreground permission API; `accuracy` in metres; `mocked` flag; no background configuration for foreground use; works in Expo Go | https://docs.expo.dev/versions/latest/sdk/location/ |

## 5. Repository layout

```
/
├── apps/web/               Next.js admin (static export)
├── apps/mobile/            Expo app (Expo Router, NativeWind, RN Firebase, expo-sqlite)
├── packages/shared-types/  Domain types and enums
├── packages/shared-validation/  Zod schemas
├── packages/shared-config/ Shared TypeScript and ESLint config
├── firebase/               firestore.rules, firestore.indexes.json, tests/, emulator-data/
├── firebase.json           At the repo root (where the Firebase CLI looks for it)
├── scripts/development/    Emulator seed and reset scripts
├── docs/
├── PROJECT_STATUS.md
└── README.md
```

Changes from the suggested structure:
- `firebase.json` is at the root.
- There is no `storage.rules`, because Storage isn't used.
- `scripts/provisioning/` holds only the one-time bootstrap of the first Admin, done in the Firebase Console (see `FIREBASE_CONFIGURATION.md`). No Admin SDK key is ever needed.
