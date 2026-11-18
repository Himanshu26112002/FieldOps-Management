# FieldOPS client acceptance checklist

Run with the client on the configured Firebase project and a real Android device. Use client-approved test accounts and non-production records until acceptance. Record tester, date, app build and outcome for each row. Do not mark a case passed from a screen render alone.

| ID | Acceptance case | Expected result | Result / notes |
|---|---|---|---|
| A1 | Admin signs in and signs out on web | Workspace is protected; sign-out ends the session | Pending |
| A2 | Admin creates a salesperson | Auth account and membership/profile complete; failure is visible and no partial success is reported | Pending |
| A3 | Salesperson resets password and signs in on Android | Auth succeeds and appropriate mobile routes load | Pending |
| A4 | Admin creates a client and assigns salesperson | Assignment is visible; unassigned users do not gain access | Pending |
| A5 | Salesperson searches, opens assigned-client details | Contact/address, assigned rep, visit history and related follow-ups are correct | Pending |
| A6 | Salesperson tries another user's client/visit/follow-up | Access is denied by Firestore rules | Pending |
| A7 | Admin schedules a visit | Assigned salesperson and schedule are correct on mobile | Pending |
| A8 | Salesperson records GPS check-in and check-out | Permission denial, unavailable location and poor accuracy are handled clearly; coordinates are genuine device fixes | Pending |
| A9 | Salesperson submits visit report | Required fields validate; success appears only after Firebase commit | Pending |
| A10 | Admin reviews, returns and approves visits | Allowed lifecycle transitions and reasons are enforced; history remains attributable | Pending |
| A11 | Salesperson creates and completes follow-up | Correct client, owner, due date and completion note persist | Pending |
| A12 | User is deactivated while signed in | Protected reads/writes are denied on the next server request and UI recovers clearly | Pending |
| A13 | Network loss during read/write or visit work | Errors are understandable; no duplicate business operation is silently created | Pending |
| A14 | Mobile app is closed/reopened | Session behavior matches the agreed persistence expectation | Pending |
| A15 | Admin reviews operational reporting | Totals and statuses match the underlying approved test records | Pending |
| A16 | Restore exercise | Owner restores a safe test export into an isolated test project and reconciles counts | Pending; no backup currently verified |

## Client decisions to confirm

- Organization ID, timezone, working hours, currency, visit statuses and who may schedule/cancel visits.
- Whether client assignments can overlap across salespeople and who owns reassignment.
- Required report fields, acceptable GPS accuracy, and procedure when location is unavailable.
- Follow-up completion/cancellation policy and audit retention period.
- Expected photos per visit and retention, given Firestore Spark storage constraints.
- Android minimum version/device matrix, session persistence expectation and offline recovery requirements.
- Admin backup/recovery owner, retention, restore point objective and restore time objective.
- Launch cohort, support contact, incident reporting path and rollback authority.
