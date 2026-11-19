// One-time bootstrap of the first administrator in a real Firebase project.
// Uses the account signed in with `npx firebase login` (must be a project Owner/Editor);
// no service-account key is needed. Refuses to overwrite documents that already exist.
//
// Usage (from the repository root):
//   node scripts/production/bootstrap-admin.cjs <projectId> <adminUid> <adminEmail> "<Full Name>" [orgId] ["Org name"]
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { Client } = require("firebase-tools/lib/apiv2");

const [projectId, uid, email, fullName, orgId = "main", orgName = "FieldOps"] = process.argv.slice(2);
if (!projectId || !uid || !email || !fullName) {
  console.error('Usage: node scripts/production/bootstrap-admin.cjs <projectId> <adminUid> <adminEmail> "<Full Name>" [orgId] ["Org name"]');
  process.exit(1);
}

const DB = `projects/${projectId}/databases/(default)`;
const now = { timestampValue: new Date().toISOString() };
const str = (value) => ({ stringValue: value });
const int = (value) => ({ integerValue: String(value) });
const create = (path, fields) => ({ update: { name: `${DB}/documents/${path}`, fields }, currentDocument: { exists: false } });

async function main() {
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error("Not signed in. Run `npx firebase login` first.");
  await requireAuth({ project: projectId, user: account.user, tokens: account.tokens });
  const client = new Client({ urlPrefix: "https://firestore.googleapis.com", apiVersion: "v1", auth: true });

  const writes = [
    create(`organizations/${orgId}`, {
      name: str(orgName),
      settings: {
        mapValue: {
          fields: {
            timezone: str("Asia/Kolkata"),
            currency: str("INR"),
            gpsAccuracyThresholdMeters: int(100),
            photoMaxPerVisit: int(2),
            photoMaxBytes: int(300000),
            visitReminderLeadMinutes: int(60),
            workdayStart: str("09:00"),
            workdayEnd: str("18:00"),
          },
        },
      },
      createdAt: now,
      updatedAt: now,
      createdBy: str("bootstrap"),
    }),
    create(`memberships/${uid}`, {
      uid: str(uid),
      orgId: str(orgId),
      role: str("ADMIN"),
      status: str("ACTIVE"),
      createdAt: now,
      updatedAt: now,
      createdBy: str("bootstrap"),
    }),
    create(`organizations/${orgId}/users/${uid}`, {
      uid: str(uid),
      orgId: str(orgId),
      fullName: str(fullName),
      email: str(email),
      phone: str(""),
      employeeCode: str("ADM-001"),
      role: str("ADMIN"),
      status: str("ACTIVE"),
      createdAt: now,
      updatedAt: now,
      createdBy: str("bootstrap"),
      lastLoginAt: { nullValue: null },
    }),
  ];

  const response = await client.post(`${DB}/documents:commit`, { writes });
  console.log(`Bootstrap complete: ${response.body.writeResults.length} documents created in ${projectId} (org "${orgId}", admin ${email}).`);
}

main().catch((error) => {
  console.error("Bootstrap failed:", error.status ?? "", error.message);
  console.error("If it says the document already exists, the admin is already bootstrapped; nothing was changed.");
  process.exit(1);
});
