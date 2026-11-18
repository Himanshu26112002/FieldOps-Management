# Cost and Free-Tier Policy — FieldOps AI

Last verified: 2026-11-02 against https://firebase.google.com/pricing and the linked Firebase docs.

## 1. Policy

- **Firebase Spark (no-cost) plan only. No billing account** (owner decision D10).
- No paid APIs, hosting, storage or AI. Any change needs written owner approval, with costs explained first.
- On Spark, an exhausted quota **blocks** the affected operation until the quota resets. It **never bills**. The apps must show a clear error when this happens.

## 2. Services selected

| Service | Spark free allowance (verified) | Used for |
|---|---|---|
| Firebase Authentication | 50K monthly active users (email/password) | Login |
| Cloud Firestore (Standard) | 1 GiB stored; 50K reads/day; 20K writes/day; 20K deletes/day; 10 GiB egress/month | All data, **including photos** |
| Firebase Hosting | 10 GB stored; 360 MB/day transfer | Static admin web app |
| App Check | No-cost; limits vary by attestation provider | Abuse protection (M9) |
| Firebase Emulator Suite | Local, free | Development and testing |
| expo-location (device GPS) | Device feature, no cost | Check-in/out |

## 3. Services excluded

| Service | Reason |
|---|---|
| Cloud Storage for Firebase | **Requires Blaze since 2026-02-03** ("even default buckets"). On Spark, API calls return 402/403. |
| Cloud Functions | Require a billing account (Cloud Build, Artifact Registry; 500 MB Artifact Registry free, then $0.10/GB/month). |
| App Hosting / Next.js SSR on Firebase | Builds on Cloud Run/Functions, so Blaze. |
| Phone (SMS) Auth | Billed per SMS on Blaze. |
| Google Maps Platform APIs (embedded maps, geocoding) | Need a billing account. Navigation opens the device's maps app instead. |
| Push notifications | Sending needs a trusted server; deferred. |
| EAS paid plans | Not needed; local builds or the EAS free tier (quota to be checked in M1). |

## 4. ⚠ Photo storage capacity (most important limit)

Photos are stored in Firestore (ADR-006). Each photo is about 150 KB as JPEG, about 200 KB after base64 encoding. The **1 GiB** limit is shared with all other data.

**Capacity ≈ 1 GiB ÷ 200 KB ≈ 5,000 photos in total, ever** (until photos are archived out).

| Scenario | Photos/day | Days until full |
|---|---|---|
| 5 salespeople × 4 visits × 2 photos | 40 | ~125 days |
| 10 × 5 × 2 | 100 | ~50 days |
| 20 × 10 × 3 | 600 | **~8 days** |

**This is only viable for small photo volumes.** Possible mitigations, in order of cost:
1. Smaller photos: about 60 KB at 960 px roughly doubles capacity, at lower image quality.
2. Fewer photos per visit (a lower `maxPhotosPerVisit` setting).
3. A periodic Admin export-and-archive of old photos (download, then delete from Firestore).
4. Move photos to Firebase Storage on Blaze. This needs owner approval and a billing account; the no-cost usage on a US bucket includes 5 GB stored.

**The owner's expected volume is needed to confirm option (b) is workable.**

Photo `data` fields are excluded from indexing (a field override in `firestore.indexes.json`), so they don't use extra storage for index entries.

## 5. Expected usage (estimate, to be validated in M8)

**Writes per completed visit** (approximate):
- Check-in (visit + audit): 2
- Report saves: about 5
- Photos (photo + visit counter + audit) × 2: 6
- Check-out and submit: 4
- Approval (visit + follow-up + notification + audit): 4
- Total: about **21 writes**

At 200 visits/day that is about 4,200 writes/day, against the 20K/day limit.

**Reads:**
- Each rule `get()` on a membership or client is billed as a document read. This is to be confirmed against the Firestore pricing page during M2.
- Listeners are billed per document added or changed. After more than 30 minutes offline, a listener is billed as a new query.
- Dashboard counts use `count()` aggregations: one read per batch of up to 1,000 index entries.
- Viewing a photo is one read.

**Rough estimate** for 20 salespeople plus 2 Admins: under 15K reads/day, against the 50K/day limit.

## 6. Read-saving rules for developers

- Use `count()` aggregations for dashboard numbers, never full collection reads.
- Paginate every list (page size 25 to 50) and never listen to entire collections.
- Open live listeners only on the active screen, and unsubscribe when leaving it.
- Load photos only on the visit detail screen.
- Mobile relies on the persistent cache; avoid forced server reads.

## 7. Monitoring

- Firebase Console → Usage and billing → daily Firestore reads, writes and storage.
- The Admin Settings page shows the approximate number of stored photos and their estimated size (M6).
- If usage passes **70%** of any daily quota for three days in a row, review with the owner.

## 8. Potential unexpected costs

There is no billing account, so there are **no surprise Firebase charges**. The risk on Spark is **service interruption** when a quota is exhausted, not cost.

Costs outside Firebase:
- Apple Developer Program membership (needed for iOS distribution).
- Google Play developer registration fee (one-time).

The owner should confirm current prices for both before M9.
