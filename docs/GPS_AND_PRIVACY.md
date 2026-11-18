# GPS and Privacy — FieldOps AI

Last updated: 2026-11-02 (design; implemented in Milestone 5)

## 1. Policy

- **GPS is mandatory** for check-in and check-out (owner decision D5). There is no manual check-in exception.
- Location is captured **only** when the salesperson presses Check in or Check out. There is **no background or continuous tracking**, and the app never asks for background location permission.
- Locations are never invented, estimated or filled in by default. If no fix is available, the action does not happen.
- Device GPS costs nothing. No paid map or geocoding API is used.

## 2. Capture (expo-location)

1. Explain why location is needed, then call `requestForegroundPermissionsAsync()`.
2. If permission is denied: show why it is required, offer **Retry**, and offer **Open Settings** when the OS will no longer show the prompt. Check-in stays blocked.
3. If location services are off: ask the user to turn them on, with a retry option.
4. Call `getCurrentPositionAsync({ accuracy: Accuracy.High })` with a timeout of about 30 seconds (to be tuned on real devices). On timeout, show "Could not get a GPS fix. Move to an open area and retry."
5. Store `lat`, `lng`, `accuracyM` (the uncertainty radius in metres, or null), `mocked` (or null), and `capturedAt` (device time). The server adds `recordedAt` when the data syncs.
6. **Poor accuracy:** if `accuracyM` is above `settings.minGpsAccuracyWarnM` (default 100 m), warn the user and offer to retry. Accepting the reading records it **with its real accuracy**, and Admin sees an accuracy badge.
7. **Mock location:** `mocked == true` is recorded and shown to Admin as a warning. The visit is not blocked (policy can be tightened later).

## 3. What is and isn't claimed

- The app shows "GPS verified (±N m)" only when a real fix was captured.
- A check-in location shows **where the phone was**. It does not prove the salesperson was at the client. When the client has stored `geo`, Admin sees the distance between the check-in and the client location as information, not as a verdict.
- `capturedAt` comes from the phone's clock, which rules cannot verify. `recordedAt` is the trusted server time of the sync.

## 4. Access and retention

- Location data lives only inside `visits` documents. Only **Admins** and the **owning salesperson** can read it (Security Rules).
- It is never public, never sent to third parties, and never written to production logs.
- It is kept as long as the visit record, which is permanent business history. Any change to that needs owner approval.
- The mobile app shows a short in-app notice explaining when location is collected and who can see it.

## 5. Platform configuration

- **Android:** foreground location permissions only (fine and coarse).
- **iOS:** only a "When In Use" usage description.
- No background modes. The exact `app.json` keys are to be checked against the expo-location config plugin in M5.
