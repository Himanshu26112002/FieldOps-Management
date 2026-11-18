# Admin and salesperson onboarding

This guide describes the current Spark-compatible, membership-document design. It is not proof that a production Firebase project has been configured.

## Before inviting users

- Complete [Firebase configuration](FIREBASE_CONFIGURATION.md) in the owner's project and confirm Auth Email/Password, Firestore rules/indexes, Hosting domain and organization ID.
- Add the first Admin membership and profile using the documented console bootstrap. Confirm the role/status in both membership and profile documents.
- Build and deploy the static web export only after reviewing [DEPLOYMENT.md](DEPLOYMENT.md) and passing rules tests.
- Record an Admin recovery contact and the backup decision in [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md).

## Create a salesperson

1. In the Admin dashboard, open **Salespeople** and create an account using the person's work email, name and permitted profile details.
2. Confirm the dashboard reports successful completion. The application creates the Auth account using its secondary client SDK instance, then writes the membership, profile and audit record under rules authorization.
3. Ask the salesperson to use the password-reset email to set their password, then sign in on the intended device.
4. Assign only the client records needed for their work. Confirm the assignment appears on both web and mobile.
5. Validate that the new salesperson can see assigned clients but cannot read a client assigned only to another person. Use the acceptance checklist before real work begins.

Do not send temporary passwords in chat or store them in business records. Deactivation in the dashboard changes the membership status, which is the rules authority; also disable the Auth account in Firebase Console when immediate sign-in prevention is required.

## Access and recovery operations

- Role and active status are controlled by `memberships/{uid}`. Profile role text is not an authorization source.
- Keep at least two trusted active Admins to reduce lockout risk, following owner policy; the rules prevent an Admin from changing their own role/status.
- If all Admin accounts are inaccessible, use the documented owner-controlled Firebase Console/bootstrap recovery process. Never add a client-side bypass or commit privileged credentials.
- For a lost password, use Firebase Auth password reset. For a departed user, deactivate membership first, then disable the Auth account in Console.
- Record who performed changes and when. Audit logs are append-only under rules, but are client-written and not a tamper-proof server ledger.
