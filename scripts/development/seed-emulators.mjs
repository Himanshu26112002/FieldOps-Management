// Seeds the Firebase Auth + Firestore emulators with a demo organization.
// Usage: start `npm run emulators` in another terminal, then `npm run seed:emulators`.
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "demo-fieldops";
const ORG = "main";

process.env.GCLOUD_PROJECT ??= PROJECT_ID;
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

const now = Timestamp.fromDate(new Date());
const daysFromNow = (days, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return Timestamp.fromDate(date);
};
const isoDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

// 1x1 white JPEG used as a placeholder thumbnail in the demo data.
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=";

const accounts = [
  {
    uid: "admin1",
    email: "admin@fieldops.local",
    password: "Admin123!",
    fullName: "Aarav Mehta",
    role: "ADMIN",
    employeeCode: "ADM-001",
    phone: "+919810000001",
  },
  {
    uid: "user1",
    email: "priya@fieldops.local",
    password: "Sales123!",
    fullName: "Priya Sharma",
    role: "USER",
    employeeCode: "SAL-101",
    phone: "+919810000002",
  },
  {
    uid: "user2",
    email: "rahul@fieldops.local",
    password: "Sales123!",
    fullName: "Rahul Verma",
    role: "USER",
    employeeCode: "SAL-102",
    phone: "+919810000003",
  },
];

const clients = [
  {
    id: "client-aurora",
    name: "Aurora Traders",
    contactPerson: "Nikhil Rao",
    phone: "+919820000101",
    email: "nikhil@auroratraders.example",
    addressLine1: "22 MG Road",
    addressLine2: "Shop 4",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560001",
    category: "Wholesale",
    assignedUserIds: ["user1"],
    geo: { latitude: 12.9756, longitude: 77.6068 },
  },
  {
    id: "client-bright",
    name: "BrightMart Stores",
    contactPerson: "Meera Iyer",
    phone: "+919820000102",
    email: "meera@brightmart.example",
    addressLine1: "14 Residency Road",
    addressLine2: "",
    city: "Bengaluru",
    state: "Karnataka",
    postalCode: "560025",
    category: "Retail chain",
    assignedUserIds: ["user1", "user2"],
    geo: { latitude: 12.9698, longitude: 77.6031 },
  },
  {
    id: "client-chennai",
    name: "Chennai Hardware Hub",
    contactPerson: "Suresh Kumar",
    phone: "+919820000103",
    email: "suresh@chennaihardware.example",
    addressLine1: "88 Anna Salai",
    addressLine2: "",
    city: "Chennai",
    state: "Tamil Nadu",
    postalCode: "600002",
    category: "Hardware",
    assignedUserIds: ["user2"],
    geo: { latitude: 13.0604, longitude: 80.2496 },
  },
  {
    id: "client-delta",
    name: "Delta Distributors",
    contactPerson: "Farah Khan",
    phone: "+919820000104",
    email: "farah@deltadist.example",
    addressLine1: "5 Banjara Hills",
    addressLine2: "Road 3",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500034",
    category: "Distributor",
    assignedUserIds: ["user1"],
    geo: { latitude: 17.4126, longitude: 78.4392 },
  },
  {
    id: "client-everest",
    name: "Everest Kirana",
    contactPerson: "Pooja Nair",
    phone: "+919820000105",
    email: "",
    addressLine1: "31 Linking Road",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400050",
    category: "Kirana",
    assignedUserIds: ["user2"],
    geo: { latitude: 19.0648, longitude: 72.8331 },
  },
  {
    id: "client-fresh",
    name: "FreshLeaf Organics",
    contactPerson: "Aditya Bose",
    phone: "+919820000106",
    email: "aditya@freshleaf.example",
    addressLine1: "9 Salt Lake Sector 5",
    addressLine2: "",
    city: "Kolkata",
    state: "West Bengal",
    postalCode: "700091",
    category: "Organic retail",
    assignedUserIds: ["user1"],
    geo: { latitude: 22.5726, longitude: 88.4318 },
  },
  {
    id: "client-granite",
    name: "Granite & Co.",
    contactPerson: "Kabir Singh",
    phone: "+919820000107",
    email: "kabir@graniteco.example",
    addressLine1: "77 Industrial Area",
    addressLine2: "Phase 2",
    city: "Jaipur",
    state: "Rajasthan",
    postalCode: "302013",
    category: "Industrial",
    assignedUserIds: [],
    geo: { latitude: 26.9124, longitude: 75.7873 },
  },
  {
    id: "client-harbor",
    name: "Harbor Cafe Supplies",
    contactPerson: "Tara Menon",
    phone: "+919820000108",
    email: "tara@harborsupplies.example",
    addressLine1: "3 Marine Drive",
    addressLine2: "",
    city: "Kochi",
    state: "Kerala",
    postalCode: "682031",
    category: "Hospitality",
    assignedUserIds: ["user2"],
    geo: { latitude: 9.9312, longitude: 76.2673 },
  },
];

const reports = {
  approved: {
    summary: "Reviewed the quarterly order and confirmed the new shelf placement.",
    outcome: "ORDER_PLACED",
    activities: ["Shelf audit", "Order review", "Promotion briefing"],
    productsDiscussed: "Starter pack, festive bundle",
    competitorInfo: "Competitor offered 5% extra margin",
    customerFeedback: "Happy with the festive bundle; wants faster delivery",
    nextAction: "Dispatch order by Friday",
    followupRequired: false,
    followupDate: null,
  },
  submitted: {
    summary: "Demoed the new packaging and collected feedback from the store team.",
    outcome: "FOLLOW_UP_REQUIRED",
    activities: ["Product demo", "Staff feedback"],
    productsDiscussed: "Eco packaging",
    competitorInfo: "No competitor present",
    customerFeedback: "Staff liked the resealable pouch",
    nextAction: "Share pricing sheet",
    followupRequired: true,
    followupDate: isoDate(5),
  },
  returned: {
    summary: "Visited the store and discussed the pending stock issue.",
    outcome: "INTERESTED",
    activities: ["Stock check"],
    productsDiscussed: "Bulk packs",
    competitorInfo: "",
    customerFeedback: "Needs a revised quote",
    nextAction: "Send revised quote",
    followupRequired: true,
    followupDate: isoDate(3),
  },
};

function visitBase(overrides) {
  return {
    orgId: ORG,
    clientId: "client-aurora",
    clientName: "Aurora Traders",
    clientAddress: "22 MG Road, Shop 4",
    clientCity: "Bengaluru",
    userId: "user1",
    userName: "Priya Sharma",
    origin: "SCHEDULED",
    status: "SCHEDULED",
    scheduledFor: daysFromNow(1),
    scheduledBy: "admin1",
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
    createdAt: now,
    createdBy: "admin1",
    updatedAt: now,
    ...overrides,
  };
}

async function upsertAuthUser(account) {
  try {
    await auth.deleteUser(account.uid);
  } catch {
    // The user does not exist yet.
  }
  await auth.createUser({
    uid: account.uid,
    email: account.email,
    password: account.password,
    displayName: account.fullName,
    emailVerified: true,
  });
}

async function resetData() {
  await db.recursiveDelete(db.doc(`organizations/${ORG}`));
  for (const account of accounts) {
    await db.doc(`memberships/${account.uid}`).delete().catch(() => {});
  }
}

async function seed() {
  for (const account of accounts) await upsertAuthUser(account);
  await resetData();

  await db.doc(`organizations/${ORG}`).set({
    name: "FieldOps Demo Industries",
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
    createdAt: now,
    updatedAt: now,
    createdBy: "admin1",
  });

  const batch = db.batch();

  for (const account of accounts) {
    batch.set(db.doc(`memberships/${account.uid}`), {
      uid: account.uid,
      orgId: ORG,
      role: account.role,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      createdBy: "admin1",
    });
    batch.set(db.doc(`organizations/${ORG}/users/${account.uid}`), {
      uid: account.uid,
      orgId: ORG,
      fullName: account.fullName,
      email: account.email,
      phone: account.phone,
      employeeCode: account.employeeCode,
      role: account.role,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
      createdBy: "admin1",
      lastLoginAt: null,
    });
  }

  for (const client of clients) {
    batch.set(db.doc(`organizations/${ORG}/clients/${client.id}`), {
      orgId: ORG,
      name: client.name,
      contactPerson: client.contactPerson,
      phone: client.phone,
      email: client.email,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      city: client.city,
      state: client.state,
      postalCode: client.postalCode,
      category: client.category,
      notes: "",
      status: "ACTIVE",
      geo: client.geo,
      assignedUserIds: client.assignedUserIds,
      createdBy: "admin1",
      createdAt: now,
      updatedAt: now,
      lastVisitAt: null,
      nextFollowupAt: null,
    });

    for (const userId of client.assignedUserIds) {
      const userName = userId === "user1" ? "Priya Sharma" : "Rahul Verma";
      batch.set(
        db.doc(`organizations/${ORG}/client_assignments/${client.id}__${userId}`),
        {
          orgId: ORG,
          clientId: client.id,
          clientName: client.name,
          userId,
          userName,
          status: "ACTIVE",
          assignedBy: "admin1",
          assignedAt: now,
          endedBy: null,
          endedAt: null,
          endReason: "",
        },
      );
    }
  }

  const geo = (lat, lng) => ({
    latitude: lat,
    longitude: lng,
    accuracyMeters: 18,
    capturedAt: now,
  });

  const visits = [
    visitBase({
      clientId: "client-aurora",
      clientName: "Aurora Traders",
      clientAddress: "22 MG Road, Shop 4",
      clientCity: "Bengaluru",
      userId: "user1",
      userName: "Priya Sharma",
      status: "SCHEDULED",
      scheduledFor: daysFromNow(1, 11),
    }),
    visitBase({
      clientId: "client-bright",
      clientName: "BrightMart Stores",
      clientAddress: "14 Residency Road",
      clientCity: "Bengaluru",
      userId: "user2",
      userName: "Rahul Verma",
      status: "SCHEDULED",
      scheduledFor: daysFromNow(1, 15),
    }),
    visitBase({
      clientId: "client-delta",
      clientName: "Delta Distributors",
      clientAddress: "5 Banjara Hills, Road 3",
      clientCity: "Hyderabad",
      userId: "user1",
      userName: "Priya Sharma",
      origin: "AD_HOC",
      status: "IN_PROGRESS",
      scheduledFor: null,
      scheduledBy: null,
      checkIn: geo(17.4126, 78.4392),
      createdBy: "user1",
    }),
    visitBase({
      clientId: "client-fresh",
      clientName: "FreshLeaf Organics",
      clientAddress: "9 Salt Lake Sector 5",
      clientCity: "Kolkata",
      userId: "user1",
      userName: "Priya Sharma",
      status: "SUBMITTED",
      checkIn: geo(22.5726, 88.4318),
      checkOut: geo(22.5729, 88.4321),
      report: reports.submitted,
      photoCount: 2,
      submittedAt: now,
      createdBy: "user1",
    }),
    visitBase({
      clientId: "client-chennai",
      clientName: "Chennai Hardware Hub",
      clientAddress: "88 Anna Salai",
      clientCity: "Chennai",
      userId: "user2",
      userName: "Rahul Verma",
      status: "RETURNED",
      checkIn: geo(13.0604, 80.2496),
      checkOut: geo(13.0609, 80.25),
      report: reports.returned,
      returnedAt: now,
      returnedBy: "admin1",
      returnReason: "Please add the revised quote amount and the competitor details.",
      createdBy: "user2",
    }),
    visitBase({
      clientId: "client-everest",
      clientName: "Everest Kirana",
      clientAddress: "31 Linking Road",
      clientCity: "Mumbai",
      userId: "user2",
      userName: "Rahul Verma",
      status: "APPROVED",
      checkIn: geo(19.0648, 72.8331),
      checkOut: geo(19.0651, 72.8335),
      report: reports.approved,
      photoCount: 1,
      submittedAt: Timestamp.fromMillis(now.toMillis() - 2 * 86400000),
      approvedAt: Timestamp.fromMillis(now.toMillis() - 86400000),
      approvedBy: "admin1",
      createdBy: "user2",
    }),
    visitBase({
      clientId: "client-harbor",
      clientName: "Harbor Cafe Supplies",
      clientAddress: "3 Marine Drive",
      clientCity: "Kochi",
      userId: "user2",
      userName: "Rahul Verma",
      status: "CANCELLED",
      scheduledFor: daysFromNow(-1),
      cancelledAt: now,
      cancelledBy: "admin1",
      cancelReason: "Client requested a postponement.",
      createdBy: "admin1",
    }),
  ];

  visits.forEach((visit, index) => {
    batch.set(db.doc(`organizations/${ORG}/visits/demo-visit-${index + 1}`), visit);
  });

  batch.set(db.doc(`organizations/${ORG}/visits/demo-visit-4/photos/photo-1`), {
    orgId: ORG,
    visitId: "demo-visit-4",
    contentType: "image/jpeg",
    data: TINY_JPEG,
    sizeBytes: 280,
    caption: "Shelf display",
    uploadedBy: "user1",
    createdAt: now,
  });
  batch.set(db.doc(`organizations/${ORG}/visits/demo-visit-4/photos/photo-2`), {
    orgId: ORG,
    visitId: "demo-visit-4",
    contentType: "image/jpeg",
    data: TINY_JPEG,
    sizeBytes: 280,
    caption: "New packaging",
    uploadedBy: "user1",
    createdAt: now,
  });
  batch.set(db.doc(`organizations/${ORG}/visits/demo-visit-6/photos/photo-1`), {
    orgId: ORG,
    visitId: "demo-visit-6",
    contentType: "image/jpeg",
    data: TINY_JPEG,
    sizeBytes: 280,
    caption: "Order confirmation",
    uploadedBy: "user2",
    createdAt: now,
  });

  const followups = [
    {
      id: "followup-1",
      clientId: "client-fresh",
      clientName: "FreshLeaf Organics",
      userId: "user1",
      userName: "Priya Sharma",
      visitId: "demo-visit-4",
      title: "Share eco-packaging price list",
      notes: "Include the festive bundle discount.",
      dueDate: isoDate(2),
      status: "OPEN",
    },
    {
      id: "followup-2",
      clientId: "client-chennai",
      clientName: "Chennai Hardware Hub",
      userId: "user2",
      userName: "Rahul Verma",
      visitId: "demo-visit-5",
      title: "Send revised quote",
      notes: "Buyer wants a 30-day credit option.",
      dueDate: isoDate(1),
      status: "OPEN",
    },
    {
      id: "followup-3",
      clientId: "client-everest",
      clientName: "Everest Kirana",
      userId: "user2",
      userName: "Rahul Verma",
      visitId: "demo-visit-6",
      title: "Confirm festive order",
      notes: "",
      dueDate: isoDate(-1),
      status: "DONE",
      completedAt: now,
      completedBy: "user2",
      completionNote: "Order confirmed for 40 cases.",
    },
  ];

  for (const followup of followups) {
    batch.set(db.doc(`organizations/${ORG}/followups/${followup.id}`), {
      orgId: ORG,
      clientId: followup.clientId,
      clientName: followup.clientName,
      userId: followup.userId,
      userName: followup.userName,
      visitId: followup.visitId,
      title: followup.title,
      notes: followup.notes,
      dueDate: followup.dueDate,
      status: followup.status,
      completedAt: followup.completedAt ?? null,
      completedBy: followup.completedBy ?? null,
      completionNote: followup.completionNote ?? "",
      createdAt: now,
      createdBy: "admin1",
      updatedAt: now,
    });
  }

  const notifications = [
    {
      id: "notification-1",
      recipientUid: "user1",
      type: "VISIT_ASSIGNED",
      title: "New visit scheduled",
      body: "Aurora Traders tomorrow at 11:00",
      entityType: "VISIT",
      entityId: "demo-visit-1",
    },
    {
      id: "notification-2",
      recipientUid: "admin1",
      type: "VISIT_SUBMITTED",
      title: "Visit awaiting approval",
      body: "Priya Sharma submitted a visit at FreshLeaf Organics",
      entityType: "VISIT",
      entityId: "demo-visit-4",
    },
    {
      id: "notification-3",
      recipientUid: "user2",
      type: "VISIT_RETURNED",
      title: "Visit returned for correction",
      body: "Add the revised quote to the Chennai Hardware Hub visit",
      entityType: "VISIT",
      entityId: "demo-visit-5",
    },
  ];

  for (const notification of notifications) {
    batch.set(db.doc(`organizations/${ORG}/notifications/${notification.id}`), {
      orgId: ORG,
      recipientUid: notification.recipientUid,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      entityType: notification.entityType,
      entityId: notification.entityId,
      readAt: null,
      createdAt: now,
      createdBy: "admin1",
    });
  }

  const auditLogs = [
    ["CLIENT_CREATED", "CLIENT", "client-aurora", "Created Aurora Traders"],
    ["CLIENT_ASSIGNED", "CLIENT", "client-bright", "Assigned BrightMart Stores to Priya and Rahul"],
    ["USER_CREATED", "USER", "user2", "Created salesperson Rahul Verma"],
    ["VISIT_SCHEDULED", "VISIT", "demo-visit-1", "Scheduled a visit to Aurora Traders"],
    ["VISIT_SUBMITTED", "VISIT", "demo-visit-4", "Priya Sharma submitted a visit at FreshLeaf Organics"],
    ["VISIT_APPROVED", "VISIT", "demo-visit-6", "Approved the visit at Everest Kirana"],
  ];
  auditLogs.forEach(([action, entityType, entityId, summary], index) => {
    batch.set(db.doc(`organizations/${ORG}/audit_logs/seed-log-${index + 1}`), {
      orgId: ORG,
      actorId: "admin1",
      actorRole: "ADMIN",
      action,
      entityType,
      entityId,
      summary,
      metadata: null,
      createdAt: now,
    });
  });

  await batch.commit();
}

await seed();
console.log("\nFieldOps demo data seeded.");
console.log("  Web:    http://localhost:3000");
console.log("  Emulator UI: http://localhost:4000");
console.log("\nSign in with:");
for (const account of accounts) {
  console.log(`  ${account.role.padEnd(5)}  ${account.email}  /  ${account.password}`);
}
console.log("");
