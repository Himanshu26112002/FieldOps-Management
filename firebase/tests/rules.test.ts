import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

// Runs inside `npm run test:rules` (Firestore emulator is started for us).
let env: RulesTestEnvironment;

const ORG = "main";
const ADMIN = "admin1";
const USER_A = "user1";
const USER_B = "user2";
const INACTIVE = "inactive1";

const now = () => Timestamp.fromMillis(Date.now());
const future = () => Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

const report = (overrides: Record<string, unknown> = {}) => ({
  summary: "Met the buyer and reviewed the current product range in detail.",
  outcome: "FOLLOW_UP_REQUIRED",
  activities: ["Product demo", "Price discussion"],
  productsDiscussed: "Starter pack",
  competitorInfo: "None mentioned",
  customerFeedback: "Positive, wants samples",
  nextAction: "Send samples next week",
  followupRequired: true,
  followupDate: "2026-12-01",
  ...overrides,
});

function gpsFix(at: unknown) {
  return {
    latitude: 28.6139,
    longitude: 77.209,
    accuracyMeters: 12,
    capturedAt: at,
  };
}

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const ts = now();

    await setDoc(doc(db, `organizations/${ORG}`), {
      name: "FieldOps Demo",
      settings: {
        timezone: "Asia/Kolkata",
        currency: "INR",
        gpsAccuracyThresholdMeters: 100,
        photoMaxPerVisit: 5,
        photoMaxBytes: 300000,
        visitReminderLeadMinutes: 60,
        workdayStart: "09:00",
        workdayEnd: "18:00",
      },
      createdAt: ts,
      updatedAt: ts,
      createdBy: ADMIN,
    });

    for (const [uid, role, name] of [
      [ADMIN, "ADMIN", "Admin One"],
      [USER_A, "USER", "Sales One"],
      [USER_B, "USER", "Sales Two"],
    ] as const) {
      await setDoc(doc(db, `memberships/${uid}`), {
        uid,
        orgId: ORG,
        role,
        status: "ACTIVE",
        createdAt: ts,
        updatedAt: ts,
        createdBy: ADMIN,
      });
      await setDoc(doc(db, `organizations/${ORG}/users/${uid}`), {
        uid,
        orgId: ORG,
        fullName: name,
        email: `${uid}@example.com`,
        phone: "+919999999999",
        employeeCode: uid.toUpperCase(),
        role,
        status: "ACTIVE",
        createdAt: ts,
        updatedAt: ts,
        createdBy: ADMIN,
      });
    }

    await setDoc(doc(db, `memberships/${INACTIVE}`), {
      uid: INACTIVE,
      orgId: ORG,
      role: "USER",
      status: "INACTIVE",
      createdAt: ts,
      updatedAt: ts,
      createdBy: ADMIN,
    });
    await setDoc(doc(db, `organizations/${ORG}/users/${INACTIVE}`), {
      uid: INACTIVE,
      orgId: ORG,
      fullName: "Inactive Salesperson",
      email: "inactive@example.com",
      phone: "+917777777777",
      employeeCode: "INACTIVE1",
      role: "USER",
      status: "INACTIVE",
      createdAt: ts,
      updatedAt: ts,
      createdBy: ADMIN,
    });

    const clientBase = {
      orgId: ORG,
      contactPerson: "Buyer",
      phone: "+918888888888",
      email: "",
      addressLine1: "1 Market Road",
      addressLine2: "",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110001",
      category: "Retail",
      notes: "",
      status: "ACTIVE",
      geo: null,
      createdAt: ts,
      updatedAt: ts,
      createdBy: ADMIN,
      lastVisitAt: null,
      nextFollowupAt: null,
    };
    await setDoc(doc(db, `organizations/${ORG}/clients/c1`), {
      ...clientBase,
      name: "Client One",
      assignedUserIds: [USER_A],
    });
    await setDoc(doc(db, `organizations/${ORG}/clients/c2`), {
      ...clientBase,
      name: "Client Two",
      assignedUserIds: [USER_B],
    });
    await setDoc(doc(db, `organizations/${ORG}/clients/c3`), {
      ...clientBase,
      name: "Client Three",
      assignedUserIds: [],
    });

    await setDoc(doc(db, `organizations/${ORG}/client_assignments/a1`), {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      userId: USER_A,
      userName: "Sales One",
      status: "ACTIVE",
      assignedBy: ADMIN,
      assignedAt: ts,
      endedBy: null,
      endedAt: null,
      endReason: "",
    });

    const visitBase = {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      clientAddress: "1 Market Road",
      clientCity: "Delhi",
      userId: USER_A,
      userName: "Sales One",
      origin: "SCHEDULED",
      status: "SCHEDULED",
      scheduledFor: future(),
      scheduledBy: ADMIN,
      checkIn: null,
      checkOut: null,
      report: null,
      photoCount: 0,
      revisionCount: 0,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      returnedAt: null,
      returnedBy: null,
      returnReason: "",
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: "",
      createdAt: ts,
      createdBy: ADMIN,
      updatedAt: ts,
    };

    await setDoc(doc(db, `organizations/${ORG}/visits/v-scheduled`), { ...visitBase });
    await setDoc(doc(db, `organizations/${ORG}/visits/v-adhoc`), {
      ...visitBase,
      origin: "AD_HOC",
      status: "IN_PROGRESS",
      scheduledFor: null,
      scheduledBy: null,
      checkIn: gpsFix(ts),
    });
    await setDoc(doc(db, `organizations/${ORG}/visits/v-submitted`), {
      ...visitBase,
      status: "SUBMITTED",
      checkIn: gpsFix(ts),
      checkOut: gpsFix(ts),
      report: report({ followupRequired: false, followupDate: null }),
      photoCount: 1,
      submittedAt: ts,
    });
    await setDoc(doc(db, `organizations/${ORG}/visits/v-returned`), {
      ...visitBase,
      status: "RETURNED",
      checkIn: gpsFix(ts),
      checkOut: gpsFix(ts),
      report: report(),
      returnedAt: ts,
      returnedBy: ADMIN,
      returnReason: "Please add the competitor details.",
    });

    await setDoc(doc(db, `organizations/${ORG}/followups/f1`), {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      userId: USER_A,
      userName: "Sales One",
      visitId: "v-submitted",
      title: "Send samples",
      notes: "Buyer asked for the starter pack",
      dueDate: "2026-12-01",
      status: "OPEN",
      completedAt: null,
      completedBy: null,
      completionNote: "",
      createdAt: ts,
      createdBy: ADMIN,
      updatedAt: ts,
    });

    await setDoc(doc(db, `organizations/${ORG}/notifications/n1`), {
      orgId: ORG,
      recipientUid: USER_A,
      type: "VISIT_ASSIGNED",
      title: "New visit scheduled",
      body: "Client One",
      entityType: "VISIT",
      entityId: "v-scheduled",
      readAt: null,
      createdAt: ts,
      createdBy: ADMIN,
    });
    await setDoc(doc(db, `organizations/${ORG}/notifications/inactive-notice`), {
      orgId: ORG,
      recipientUid: INACTIVE,
      type: "VISIT_ASSIGNED",
      title: "Old notice",
      body: "",
      entityType: null,
      entityId: null,
      readAt: null,
      createdAt: ts,
      createdBy: ADMIN,
    });

    await setDoc(doc(db, `organizations/${ORG}/audit_logs/log1`), {
      orgId: ORG,
      actorId: ADMIN,
      actorRole: "ADMIN",
      action: "CLIENT_CREATED",
      entityType: "CLIENT",
      entityId: "c1",
      summary: "Created Client One",
      metadata: null,
      createdAt: ts,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-fieldops",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

beforeEach(async () => {
  await seed();
});

afterAll(async () => {
  await env?.cleanup();
});

const as = (uid?: string) =>
  uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

describe("memberships and provisioning", () => {
  it("denies unauthenticated access", async () => {
    await assertFails(getDoc(doc(as(), `organizations/${ORG}`)));
    await assertFails(getDoc(doc(as(), `memberships/${ADMIN}`)));
  });

  it("lets a member read their own membership and salespeople read admins", async () => {
    await assertSucceeds(getDoc(doc(as(USER_A), `memberships/${USER_A}`)));
    await assertFails(getDoc(doc(as(USER_A), `memberships/${USER_B}`)));
    await assertSucceeds(getDoc(doc(as(USER_A), `memberships/${ADMIN}`)));
    await assertSucceeds(getDoc(doc(as(ADMIN), `memberships/${USER_A}`)));
  });

  it("prevents self-provisioning and admin self-escalation", async () => {
    await assertFails(
      setDoc(doc(as(USER_B), `memberships/${USER_B}`), {
        uid: USER_B,
        orgId: ORG,
        role: "ADMIN",
        status: "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: USER_B,
      }),
    );
    await assertFails(
      updateDoc(doc(as(ADMIN), `memberships/${ADMIN}`), {
        role: "USER",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_B), `memberships/${USER_B}`), {
        role: "ADMIN",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_B), `organizations/${ORG}/users/${USER_B}`), {
        role: "ADMIN",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(USER_B), `organizations/${ORG}/users/${USER_B}`), {
        fullName: "Sales Two Updated",
        phone: "+917777777777",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_B), `organizations/${ORG}/users/${USER_B}`), {
        privateFlag: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("denies inactive users access to memberships, profiles and organization data", async () => {
    const db = as(INACTIVE);
    await assertFails(getDoc(doc(db, `memberships/${INACTIVE}`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/users/${INACTIVE}`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/clients/c1`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/visits/v-scheduled`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/followups/f1`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/notifications/inactive-notice`)));
    await assertFails(
      updateDoc(doc(db, `organizations/${ORG}/notifications/inactive-notice`), {
        readAt: serverTimestamp(),
      }),
    );
  });

  it("lets an admin provision a salesperson account in one batch", async () => {
    const db = as(ADMIN);
    const batch = writeBatch(db);
    batch.set(doc(db, `memberships/user3`), {
      uid: "user3",
      orgId: ORG,
      role: "USER",
      status: "ACTIVE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: ADMIN,
    });
    batch.set(doc(db, `organizations/${ORG}/users/user3`), {
      uid: "user3",
      orgId: ORG,
      fullName: "Sales Three",
      email: "user3@example.com",
      phone: "+917777777777",
      employeeCode: "EMP3",
      role: "USER",
      status: "ACTIVE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: ADMIN,
    });
    // The dashboard sends a welcome notification in the same batch; the recipient's
    // membership only exists after the batch, which the rules must accept.
    batch.set(doc(db, `organizations/${ORG}/notifications/welcome-user3`), {
      orgId: ORG,
      recipientUid: "user3",
      type: "ACCOUNT_CREATED",
      title: "Welcome to FieldOps",
      body: "Your salesperson account is ready.",
      entityType: "USER",
      entityId: "user3",
      readAt: null,
      createdAt: serverTimestamp(),
      createdBy: ADMIN,
    });
    batch.set(doc(db, `organizations/${ORG}/audit_logs/provision-user3`), {
      orgId: ORG,
      actorId: ADMIN,
      actorRole: "ADMIN",
      action: "USER_CREATED",
      entityType: "USER",
      entityId: "user3",
      summary: "Created salesperson Sales Three",
      metadata: null,
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
  });

  it("rejects a profile without the matching membership", async () => {
    await assertFails(
      setDoc(doc(as(ADMIN), `organizations/${ORG}/users/user4`), {
        uid: "user4",
        orgId: ORG,
        fullName: "Sales Four",
        email: "user4@example.com",
        phone: "+917777777777",
        employeeCode: "EMP4",
        role: "USER",
        status: "ACTIVE",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: ADMIN,
      }),
    );
  });
});

describe("organization, clients and assignments", () => {
  it("lets only admins update the organization", async () => {
    const org = () => doc(as(ADMIN), `organizations/${ORG}`);
    await assertSucceeds(updateDoc(org(), { name: "Renamed", updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}`), {
        name: "Hijacked",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("creates clients as admin only and enforces the field whitelist", async () => {
    const input = {
      orgId: ORG,
      name: "Client New",
      contactPerson: "Buyer",
      phone: "+918888888888",
      email: "",
      addressLine1: "2 Market Road",
      addressLine2: "",
      city: "Delhi",
      state: "Delhi",
      postalCode: "110002",
      category: "Retail",
      notes: "",
      status: "ACTIVE",
      geo: null,
      assignedUserIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: ADMIN,
    };
    await assertSucceeds(setDoc(doc(as(ADMIN), `organizations/${ORG}/clients/c-new`), input));
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/clients/c-bad`), {
        ...input,
        createdBy: USER_A,
      }),
    );
    await assertFails(
      setDoc(doc(as(ADMIN), `organizations/${ORG}/clients/c-extra`), {
        ...input,
        sneaky: true,
      }),
    );
  });

  it("hides unassigned clients from salespeople and supports scoped queries", async () => {
    const db = as(USER_A);
    await assertSucceeds(getDoc(doc(db, `organizations/${ORG}/clients/c1`)));
    await assertFails(getDoc(doc(db, `organizations/${ORG}/clients/c2`)));
    await assertFails(getDocs(collection(db, `organizations/${ORG}/clients`)));
    const snapshot = await assertSucceeds(
      getDocs(
        query(
          collection(db, `organizations/${ORG}/clients`),
          where("assignedUserIds", "array-contains", USER_A),
        ),
      ),
    );
    expect(snapshot.docs.map((item) => item.id)).toEqual(["c1"]);
  });

  it("allows administrators to read organization-wide clients, visits and follow-ups", async () => {
    const db = as(ADMIN);
    await assertSucceeds(getDocs(collection(db, `organizations/${ORG}/clients`)));
    await assertSucceeds(getDocs(collection(db, `organizations/${ORG}/visits`)));
    await assertSucceeds(getDocs(collection(db, `organizations/${ORG}/followups`)));
  });

  it("denies salesperson changes to client assignment fields and assignment records", async () => {
    await assertFails(updateDoc(doc(as(USER_A), `organizations/${ORG}/clients/c1`), {
      assignedUserIds: [USER_A, USER_B],
      updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(as(USER_A), `organizations/${ORG}/clients/c1`), {
      assignedUserIds: [],
      updatedAt: serverTimestamp(),
    }));
  });

  it("restricts assignment documents to admins and the assignee", async () => {
    const assignment = {
      orgId: ORG,
      clientId: "c2",
      clientName: "Client Two",
      userId: USER_B,
      userName: "Sales Two",
      status: "ACTIVE",
      assignedBy: ADMIN,
      assignedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(as(ADMIN), `organizations/${ORG}/client_assignments/a2`), assignment),
    );
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/client_assignments/a3`), {
        ...assignment,
        assignedBy: USER_A,
      }),
    );
    await assertSucceeds(getDoc(doc(as(USER_A), `organizations/${ORG}/client_assignments/a1`)));
    await assertFails(getDoc(doc(as(USER_A), `organizations/${ORG}/client_assignments/a2`)));
  });
});

describe("visit lifecycle", () => {
  it("lets a salesperson start an assigned ad hoc visit with a GPS fix", async () => {
    const input = {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      clientAddress: "1 Market Road",
      clientCity: "Delhi",
      userId: USER_A,
      userName: "Sales One",
      origin: "AD_HOC",
      status: "IN_PROGRESS",
      scheduledFor: null,
      scheduledBy: null,
      checkIn: gpsFix(serverTimestamp()),
      checkOut: null,
      report: null,
      photoCount: 0,
      revisionCount: 0,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      returnedAt: null,
      returnedBy: null,
      returnReason: "",
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: "",
      createdAt: serverTimestamp(),
      createdBy: USER_A,
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-new`), input),
    );
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-unassigned`), {
        ...input,
        clientId: "c2",
        clientName: "Client Two",
      }),
    );
    await assertFails(
      setDoc(doc(as(USER_B), `organizations/${ORG}/visits/v-other`), input),
    );
  });

  it("lets an admin schedule a visit for a salesperson", async () => {
    const input = {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      clientAddress: "1 Market Road",
      clientCity: "Delhi",
      userId: USER_A,
      userName: "Sales One",
      origin: "SCHEDULED",
      status: "SCHEDULED",
      scheduledFor: future(),
      scheduledBy: ADMIN,
      checkIn: null,
      checkOut: null,
      report: null,
      photoCount: 0,
      revisionCount: 0,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      returnedAt: null,
      returnedBy: null,
      returnReason: "",
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: "",
      createdAt: serverTimestamp(),
      createdBy: ADMIN,
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(as(ADMIN), `organizations/${ORG}/visits/v-admin-new`), input),
    );
  });

  it("enforces visit visibility", async () => {
    await assertSucceeds(getDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-scheduled`)));
    await assertFails(getDoc(doc(as(USER_B), `organizations/${ORG}/visits/v-scheduled`)));
    await assertSucceeds(getDoc(doc(as(ADMIN), `organizations/${ORG}/visits/v-scheduled`)));
  });

  it("starts a scheduled visit, submits it, and blocks approval by the owner", async () => {
    const db = as(USER_A);
    const visit = doc(db, `organizations/${ORG}/visits/v-scheduled`);
    await assertSucceeds(
      updateDoc(visit, {
        status: "IN_PROGRESS",
        checkIn: gpsFix(serverTimestamp()),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(visit, {
        status: "SUBMITTED",
        report: report({ followupRequired: false, followupDate: null }),
        checkOut: gpsFix(serverTimestamp()),
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(visit, {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
        approvedBy: USER_A,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("requires a report and check-out to submit", async () => {
    const visit = doc(as(USER_A), `organizations/${ORG}/visits/v-adhoc`);
    await assertFails(
      updateDoc(visit, {
        status: "SUBMITTED",
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("prevents a salesperson from cancelling an admin-scheduled visit", async () => {
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-scheduled`), {
        status: "CANCELLED",
        cancelledAt: serverTimestamp(),
        cancelledBy: USER_A,
        cancelReason: "No time",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("lets an admin approve a submitted visit exactly once", async () => {
    const visit = doc(as(ADMIN), `organizations/${ORG}/visits/v-submitted`);
    await assertSucceeds(
      updateDoc(visit, {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
        approvedBy: ADMIN,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(visit, {
        status: "RETURNED",
        returnedAt: serverTimestamp(),
        returnedBy: ADMIN,
        returnReason: "Too late",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("lets an admin return a visit and the owner resubmit with a revision record", async () => {
    const db = as(USER_A);
    const visit = doc(db, `organizations/${ORG}/visits/v-returned`);
    const resubmit = (previousReport: unknown) => {
      const batch = writeBatch(db);
      batch.update(visit, {
        status: "SUBMITTED",
        report: report({ competitorInfo: "Competitor X offered a lower price" }),
        submittedAt: serverTimestamp(),
        revisionCount: 1,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, `organizations/${ORG}/visits/v-returned/revisions/r1`), {
        orgId: ORG,
        visitId: "v-returned",
        revisionNumber: 1,
        previousReport,
        newReport: report({ competitorInfo: "Competitor X offered a lower price" }),
        returnReason: "Please add the competitor details.",
        editedBy: USER_A,
        createdAt: serverTimestamp(),
      });
      return batch.commit();
    };
    // The revision must record the report that was actually stored before the edit.
    await assertFails(resubmit(report({ summary: "A made-up previous report for the audit trail." })));
    await assertSucceeds(resubmit(report()));
  });

  it("does not let a salesperson forge approval, return or scheduling fields", async () => {
    const db = as(USER_A);
    const returned = doc(db, `organizations/${ORG}/visits/v-returned`);
    await assertFails(
      updateDoc(returned, { approvedAt: serverTimestamp(), approvedBy: ADMIN, updatedAt: serverTimestamp() }),
    );
    await assertFails(updateDoc(returned, { returnReason: "Nothing to fix", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(returned, { revisionCount: 7, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(returned, { scheduledFor: future(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(returned, { junk: "x".repeat(1000), updatedAt: serverTimestamp() }));
    // Saving a draft on the same visit is still allowed.
    await assertSucceeds(
      updateDoc(returned, { report: report({ nextAction: "Call back Monday" }), updatedAt: serverTimestamp() }),
    );
  });

  it("lets an admin cancel a returned visit", async () => {
    await assertSucceeds(
      updateDoc(doc(as(ADMIN), `organizations/${ORG}/visits/v-returned`), {
        status: "CANCELLED",
        cancelledAt: serverTimestamp(),
        cancelledBy: ADMIN,
        cancelReason: "Salesperson left the company",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("does not let a salesperson approve or edit somebody else's visit", async () => {
    await assertFails(
      updateDoc(doc(as(USER_B), `organizations/${ORG}/visits/v-submitted`), {
        status: "APPROVED",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe("photos and revisions", () => {
  it("stores photos only while the owner's visit is open", async () => {
    const photo = (uploadedBy: string) => ({
      orgId: ORG,
      visitId: "v-adhoc",
      contentType: "image/jpeg",
      data: "a".repeat(1000),
      sizeBytes: 750,
      caption: "Shelf",
      uploadedBy,
      createdAt: serverTimestamp(),
    });
    const addPhoto = (uid: string, photoId: string, countDelta: number | null) => {
      const db = as(uid);
      const batch = writeBatch(db);
      batch.set(doc(db, `organizations/${ORG}/visits/v-adhoc/photos/${photoId}`), photo(uid));
      if (countDelta !== null) {
        batch.update(doc(db, `organizations/${ORG}/visits/v-adhoc`), {
          photoCount: increment(countDelta),
          updatedAt: serverTimestamp(),
        });
      }
      return batch.commit();
    };
    // A photo must be counted on the visit in the same batch, by exactly one.
    await assertFails(addPhoto(USER_A, "p0", null));
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-adhoc/photos/p0`), photo(USER_A)),
    );
    await assertSucceeds(addPhoto(USER_A, "p1", 1));
    await assertFails(addPhoto(USER_B, "p2", 1));
    // Deleting a photo must decrement the count in the same batch.
    {
      const db = as(USER_A);
      const bad = writeBatch(db);
      bad.delete(doc(db, `organizations/${ORG}/visits/v-adhoc/photos/p1`));
      await assertFails(bad.commit());
    }
    await assertSucceeds(addPhoto(USER_A, "p1b", 1));
    {
      const db = as(USER_A);
      const ok = writeBatch(db);
      ok.delete(doc(db, `organizations/${ORG}/visits/v-adhoc/photos/p1b`));
      ok.update(doc(db, `organizations/${ORG}/visits/v-adhoc`), {
        photoCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
      await assertSucceeds(ok.commit());
    }
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/visits/v-submitted/photos/p3`), {
        ...photo(USER_A),
        visitId: "v-submitted",
      }),
    );
    await assertSucceeds(
      getDoc(doc(as(ADMIN), `organizations/${ORG}/visits/v-adhoc/photos/p1`)),
    );
    await assertFails(
      getDoc(doc(as(USER_B), `organizations/${ORG}/visits/v-adhoc/photos/p1`)),
    );
  });
});

describe("follow-ups, notifications and audit", () => {
  it("restricts follow-ups to admins and the owner", async () => {
    const input = {
      orgId: ORG,
      clientId: "c1",
      clientName: "Client One",
      userId: USER_A,
      userName: "Sales One",
      visitId: null,
      title: "Call buyer",
      notes: "",
      dueDate: "2026-12-02",
      status: "OPEN",
      completedAt: null,
      completedBy: null,
      completionNote: "",
      createdAt: serverTimestamp(),
      createdBy: ADMIN,
      updatedAt: serverTimestamp(),
    };
    await assertSucceeds(
      setDoc(doc(as(ADMIN), `organizations/${ORG}/followups/f2`), input),
    );
    await assertFails(getDoc(doc(as(USER_B), `organizations/${ORG}/followups/f1`)));
    await assertSucceeds(getDoc(doc(as(USER_A), `organizations/${ORG}/followups/f1`)));
    await assertSucceeds(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f1`), {
        status: "DONE",
        completedAt: serverTimestamp(),
        completedBy: USER_A,
        completionNote: "Samples sent",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        internalRole: "ADMIN",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        clientName: "A different client",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    // f2 was assigned by the admin: the salesperson can't retitle or cancel it.
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        title: "Something easier",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        status: "CANCELLED",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/followups/f2`), {
        dueDate: "2026-12-09",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("limits what a salesperson can put in a notification to administrators", async () => {
    const notice = (overrides: Record<string, unknown> = {}) => ({
      orgId: ORG,
      recipientUid: ADMIN,
      type: "VISIT_SUBMITTED",
      title: "Visit submitted",
      body: "Sales One submitted Client One.",
      entityType: "VISIT",
      entityId: "v-submitted",
      readAt: null,
      createdAt: serverTimestamp(),
      createdBy: USER_A,
      ...overrides,
    });
    const db = as(USER_A);
    await assertSucceeds(setDoc(doc(db, `organizations/${ORG}/notifications/s1`), notice()));
    await assertFails(setDoc(doc(db, `organizations/${ORG}/notifications/s2`), notice({ body: "x".repeat(1001) })));
    await assertFails(setDoc(doc(db, `organizations/${ORG}/notifications/s3`), notice({ entityType: "USER" })));
    await assertFails(setDoc(doc(db, `organizations/${ORG}/notifications/s4`), notice({ recipientUid: USER_B })));
  });

  it("delivers notifications to the recipient only", async () => {
    await assertSucceeds(getDoc(doc(as(USER_A), `organizations/${ORG}/notifications/n1`)));
    await assertFails(getDoc(doc(as(USER_B), `organizations/${ORG}/notifications/n1`)));
    await assertSucceeds(
      updateDoc(doc(as(USER_A), `organizations/${ORG}/notifications/n1`), {
        readAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(doc(as(USER_A), `organizations/${ORG}/notifications/n2`), {
        orgId: ORG,
        recipientUid: USER_A,
        type: "VISIT_ASSIGNED",
        title: "Fake",
        body: "",
        entityType: null,
        entityId: null,
        readAt: null,
        createdAt: serverTimestamp(),
        createdBy: USER_A,
      }),
    );
  });

  it("lets members append audit entries but not read or alter them", async () => {
    const db = as(USER_A);
    await assertSucceeds(
      setDoc(doc(db, `organizations/${ORG}/audit_logs/log2`), {
        orgId: ORG,
        actorId: USER_A,
        actorRole: "USER",
        action: "VISIT_STARTED",
        entityType: "VISIT",
        entityId: "v-adhoc",
        summary: "Started visit",
        metadata: { clientId: "c1" },
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDoc(doc(db, `organizations/${ORG}/audit_logs/log1`)));
    await assertFails(
      setDoc(doc(db, `organizations/${ORG}/audit_logs/log3`), {
        orgId: ORG,
        actorId: USER_B,
        actorRole: "USER",
        action: "VISIT_STARTED",
        entityType: "VISIT",
        entityId: "v-adhoc",
        summary: "Spoofed",
        metadata: null,
        createdAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(getDoc(doc(as(ADMIN), `organizations/${ORG}/audit_logs/log1`)));
  });
});
