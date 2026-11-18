# Offline behavior — FieldOPS mobile

Updated 2026-11-06 after comparing this document with the checked-in mobile code. Offline write synchronization is **not implemented or verified**. This document replaces the older design description that incorrectly claimed a React Native Firebase SDK, persistent native Firestore cache and SQLite outbox.

## Implemented behavior

- Mobile uses the Firebase **JavaScript SDK** (`apps/mobile/src/lib/firebase.ts`), not React Native Firebase.
- A small subset of previously fetched lists is copied to AsyncStorage by `apps/mobile/src/lib/cache.ts` and used as a read fallback when a fetch throws.
- This cache is a display snapshot; it does not authorize access. Firestore rules remain the authorization boundary for server reads and writes.
- Visit and follow-up write operations call Firestore directly. There is no durable operation outbox, stable operation ID reconciliation, queued-photo file store, or visible sync state.
- Auth uses `getAuth(app)` default persistence. Cross-launch native persistence must be tested; it is not guaranteed by the implementation.

## Consequences and safe user expectations

- Do not promise offline check-in, report submission, follow-up completion, or durable writes. A failed write must be treated as failed until the app confirms success.
- Cached lists may be stale. Details/history reads can fail when disconnected. Cached content may remain after server-side deactivation until a fresh request fails or the cache is cleared at sign-out.
- A network interruption can leave a user uncertain whether a write reached Firestore. Reconcile the record online before retrying to avoid duplicate visits/follow-ups.
- Firebase SDK memory caching and AsyncStorage snapshots are not a backup and do not provide a durable sync queue.

## Production gap

Offline workflow support requires a separate scoped implementation and acceptance plan: durable operation IDs, idempotent writes, pending/failed state, restart reconciliation, safe retry/discard behavior, cache privacy/retention, logout cleanup, conflict policy, and tests covering permission revocation while offline. Do not call this production-ready offline support until those behaviors pass device tests. No paid service is required to document this gap; any implementation choice must preserve existing Firestore authorization.
