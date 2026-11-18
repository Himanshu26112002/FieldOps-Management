import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import {
  paths,
  type AccountStatus,
  type AppNotification,
  type AuditAction,
  type AuditLog,
  type Client,
  type ClientAssignment,
  type EntityType,
  type Followup,
  type NotificationType,
  type Organization,
  type OrganizationSettings,
  type UserProfile,
  type Visit,
  type VisitPhoto,
  type VisitRevision,
  type VisitReport,
} from "@fieldops/shared-types";
import type {
  ClientInput,
  FollowupInput,
  OrgSettingsInput,
  SalespersonInput,
  VisitScheduleInput,
} from "@fieldops/shared-validation";
import { getFirebase, getSecondaryAuth } from "./firebase/client";

function fb() {
  const firebase = getFirebase();
  if (!firebase.auth.currentUser) throw new Error("You must be signed in.");
  return firebase;
}

function fromSnap<T>(snap: QueryDocumentSnapshot<DocumentData> | DocumentData & { id: string }): T {
  return { id: snap.id, ...snap.data() } as unknown as T;
}

let membershipCache: { uid: string; role: "ADMIN" | "USER" } | undefined;

export async function myMembership() {
  const { db, auth } = fb();
  const uid = auth.currentUser!.uid;
  if (membershipCache?.uid === uid) return membershipCache;
  const snap = await getDoc(doc(db, "memberships", uid));
  if (!snap.exists()) throw new Error("Your account has no organization membership.");
  const data = snap.data();
  membershipCache = { uid, role: data.role };
  return membershipCache;
}

/** Keeps free text within a rules length limit, marking the cut with an ellipsis. */
function clamp(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Window event fired after notifications are marked read, so the header badge can refresh. */
export const NOTIFICATIONS_CHANGED_EVENT = "fieldops:notifications-changed";

/** Whether a user's membership is active in this org; recipients must be, or the notification is rejected. */
async function isActiveMember(uid: string): Promise<boolean> {
  const { db, orgId } = fb();
  const snap = await getDoc(doc(db, "memberships", uid)).catch(() => null);
  return Boolean(snap?.exists() && snap.data().orgId === orgId && snap.data().status === "ACTIVE");
}

function auditRef(action: AuditAction, entityType: EntityType, entityId: string, summary: string, metadata: Record<string, string | number | boolean> | null = null) {
  const { db, orgId, auth } = getFirebase();
  const ref = doc(collection(db, paths.auditLogs(orgId)));
  return { ref, data: { orgId, actorId: auth.currentUser!.uid, actorRole: membershipCache?.role ?? "ADMIN", action, entityType, entityId, summary: clamp(summary, 500), metadata, createdAt: serverTimestamp() } };
}

export async function writeAudit(
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  summary: string,
  metadata: Record<string, string | number | boolean> | null = null,
) {
  await myMembership();
  const { ref, data } = auditRef(action, entityType, entityId, summary, metadata);
  await setDoc(ref, data);
}

function notificationRef(
  recipientUid: string,
  type: NotificationType,
  title: string,
  body: string,
  entityType: EntityType | null,
  entityId: string | null,
) {
  const { db, orgId, auth } = getFirebase();
  return {
    ref: doc(collection(db, paths.notifications(orgId))),
    data: {
      orgId,
      recipientUid,
      type,
      title: clamp(title, 160),
      body: clamp(body, 1000),
      entityType,
      entityId,
      readAt: null,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser!.uid,
    },
  };
}

export async function createNotification(
  recipientUid: string,
  type: NotificationType,
  title: string,
  body: string,
  entityType: EntityType | null = null,
  entityId: string | null = null,
) {
  fb();
  const { ref, data } = notificationRef(recipientUid, type, title, body, entityType, entityId);
  await setDoc(ref, data);
}

export async function fetchOrganization(): Promise<Organization> {
  const { db, orgId } = fb();
  const snap = await getDoc(doc(db, paths.organization(orgId)));
  if (!snap.exists()) throw new Error("Organization document is missing. Run the seed script.");
  return { id: snap.id, ...snap.data() } as Organization;
}

export async function saveOrganization(input: OrgSettingsInput) {
  const { db, orgId } = fb();
  await myMembership();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.organization(orgId)), {
    name: input.name,
    settings: {
      timezone: input.timezone,
      currency: input.currency,
      gpsAccuracyThresholdMeters: input.gpsAccuracyThresholdMeters,
      photoMaxPerVisit: input.photoMaxPerVisit,
      photoMaxBytes: input.photoMaxBytes,
      visitReminderLeadMinutes: input.visitReminderLeadMinutes,
      workdayStart: input.workdayStart,
      workdayEnd: input.workdayEnd,
    } satisfies OrganizationSettings,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("ORG_SETTINGS_UPDATED", "ORGANIZATION", orgId, "Updated organization settings");
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

// ------------------------------------------------------------------ people
export async function fetchUsers(): Promise<UserProfile[]> {
  const { db, orgId } = fb();
  const snap = await getDocs(collection(db, paths.users(orgId)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as unknown as UserProfile & { id: string })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function fetchSalespeople(): Promise<UserProfile[]> {
  const users = await fetchUsers();
  return users.filter((user) => user.role === "USER");
}

export async function fetchUser(uid: string): Promise<UserProfile | null> {
  const { db, orgId } = fb();
  const snap = await getDoc(doc(db, paths.user(orgId, uid)));
  return snap.exists() ? ({ uid: snap.id, id: snap.id, ...snap.data() } as unknown as UserProfile) : null;
}

export async function createSalesperson(input: SalespersonInput): Promise<string> {
  const { db, orgId, auth } = getFirebase();
  await myMembership();
  const secondary = getSecondaryAuth();
  const credential = await createUserWithEmailAndPassword(secondary, input.email, input.password);
  const uid = credential.user.uid;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, `memberships/${uid}`), {
      uid,
      orgId,
      role: input.role,
      status: "ACTIVE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser!.uid,
    });
    batch.set(doc(db, paths.user(orgId, uid)), {
      uid,
      orgId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      employeeCode: input.employeeCode,
      role: input.role,
      status: "ACTIVE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: auth.currentUser!.uid,
      lastLoginAt: null,
    });
    const audit = auditRef("USER_CREATED", "USER", uid, `Created ${input.fullName} (${input.role})`);
    batch.set(audit.ref, audit.data);
    const notice = notificationRef(
      uid,
      "ACCOUNT_CREATED",
      "Welcome to FieldOps",
      "Your account is ready. Your administrator will assign clients and visits.",
      "USER",
      uid,
    );
    batch.set(notice.ref, notice.data);
    await batch.commit();
  } catch (error) {
    // Avoid an orphaned Auth account if Firestore rejected the profile batch.
    await deleteUser(credential.user).catch(() => {});
    throw error;
  } finally {
    await signOut(secondary).catch(() => {});
  }

  return uid;
}

export async function updateSalesperson(uid: string, input: { fullName: string; phone: string; employeeCode: string }) {
  const { db, orgId } = fb();
  await myMembership();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.user(orgId, uid)), {
    fullName: input.fullName,
    phone: input.phone,
    employeeCode: input.employeeCode,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("USER_UPDATED", "USER", uid, `Updated ${input.fullName}`);
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function setSalespersonStatus(uid: string, status: AccountStatus) {
  const { db, orgId } = fb();
  await myMembership();
  const assignedClients = await getDocs(
    query(collection(db, paths.clients(orgId)), where("assignedUserIds", "array-contains", uid)),
  );
  const activeAssignments = await getDocs(
    query(
      collection(db, paths.clientAssignments(orgId)),
      where("userId", "==", uid),
      where("status", "==", "ACTIVE"),
    ),
  );

  const batch = writeBatch(db);
  batch.update(doc(db, `memberships/${uid}`), { status, updatedAt: serverTimestamp() });
  batch.update(doc(db, paths.user(orgId, uid)), { status, updatedAt: serverTimestamp() });
  assignedClients.docs.forEach((client) => {
    batch.update(client.ref, { assignedUserIds: arrayRemove(uid), updatedAt: serverTimestamp() });
  });
  activeAssignments.docs.forEach((assignment) => {
    batch.update(assignment.ref, {
      status: "ENDED",
      endedBy: getFirebase().auth.currentUser!.uid,
      endedAt: serverTimestamp(),
      endReason: "Salesperson deactivated",
    });
  });
  const audit = auditRef(
    status === "ACTIVE" ? "USER_UPDATED" : "USER_DEACTIVATED",
    "USER",
    uid,
    status === "ACTIVE" ? "Reactivated salesperson" : "Deactivated salesperson",
  );
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function updateMyProfile(fullName: string, phone: string) {
  const { db, orgId, auth } = fb();
  await updateDoc(doc(db, paths.user(orgId, auth.currentUser!.uid)), {
    fullName,
    phone,
    updatedAt: serverTimestamp(),
  });
}

// ----------------------------------------------------------------- clients
export async function fetchClients(userId?: string): Promise<Client[]> {
  const { db, orgId } = fb();
  const collectionRef = collection(db, paths.clients(orgId));
  const snap = userId
    ? await getDocs(query(collectionRef, where("assignedUserIds", "array-contains", userId)))
    : await getDocs(collectionRef);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as unknown as Client)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchClient(clientId: string): Promise<Client | null> {
  const { db, orgId } = fb();
  const snap = await getDoc(doc(db, paths.client(orgId, clientId)));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Client) : null;
}

export async function createClient(input: ClientInput): Promise<string> {
  const { db, orgId, auth } = fb();
  await myMembership();
  const ref = doc(collection(db, paths.clients(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    orgId,
    name: input.name,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: input.email,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    category: input.category,
    notes: input.notes,
    status: "ACTIVE",
    geo: input.geo ?? null,
    assignedUserIds: [],
    createdBy: auth.currentUser!.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("CLIENT_CREATED", "CLIENT", ref.id, `Created ${input.name}`);
  batch.set(audit.ref, audit.data);
  await batch.commit();
  return ref.id;
}

export async function updateClient(clientId: string, input: ClientInput) {
  const { db, orgId } = fb();
  await myMembership();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.client(orgId, clientId)), {
    name: input.name,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: input.email,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    category: input.category,
    notes: input.notes,
    geo: input.geo ?? null,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("CLIENT_UPDATED", "CLIENT", clientId, `Updated ${input.name}`);
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function setClientStatus(clientId: string, status: "ACTIVE" | "INACTIVE") {
  const { db, orgId, auth } = fb();
  await myMembership();
  const activeAssignments = await getDocs(
    query(
      collection(db, paths.clientAssignments(orgId)),
      where("clientId", "==", clientId),
      where("status", "==", "ACTIVE"),
    ),
  );
  const batch = writeBatch(db);
  const clientUpdate: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "INACTIVE") {
    clientUpdate.assignedUserIds = [];
  }
  batch.update(doc(db, paths.client(orgId, clientId)), clientUpdate);
  if (status === "INACTIVE") {
    activeAssignments.docs.forEach((assignment) => {
      batch.update(assignment.ref, {
        status: "ENDED",
        endedBy: auth.currentUser!.uid,
        endedAt: serverTimestamp(),
        endReason: "Client deactivated",
      });
    });
  }
  const audit = auditRef(
    status === "ACTIVE" ? "CLIENT_UPDATED" : "CLIENT_DEACTIVATED",
    "CLIENT",
    clientId,
    status === "ACTIVE" ? "Reactivated client" : "Deactivated client",
  );
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function fetchAssignments(clientId?: string): Promise<ClientAssignment[]> {
  const { db, orgId } = fb();
  const base = collection(db, paths.clientAssignments(orgId));
  const snap = clientId
    ? await getDocs(query(base, where("clientId", "==", clientId)))
    : await getDocs(base);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as ClientAssignment)
    .sort((a, b) => b.assignedAt.toMillis() - a.assignedAt.toMillis());
}

export async function assignClient(clientId: string, userId: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const [client, user] = await Promise.all([fetchClient(clientId), fetchUser(userId)]);
  if (!client || !user) throw new Error("Client or salesperson not found.");
  if (client.assignedUserIds.includes(userId)) throw new Error("This client is already assigned to that salesperson.");
  if (client.status !== "ACTIVE") throw new Error("This client is inactive.");
  if (user.status !== "ACTIVE") throw new Error("This salesperson is inactive.");

  const batch = writeBatch(db);
  batch.update(doc(db, paths.client(orgId, clientId)), {
    assignedUserIds: arrayUnion(userId),
    updatedAt: serverTimestamp(),
  });
  const assignmentRef = doc(collection(db, paths.clientAssignments(orgId)));
  batch.set(assignmentRef, {
    orgId,
    clientId,
    clientName: client.name,
    userId,
    userName: user.fullName,
    status: "ACTIVE",
    assignedBy: auth.currentUser!.uid,
    assignedAt: serverTimestamp(),
    endedBy: null,
    endedAt: null,
    endReason: "",
  });
  const audit = auditRef("CLIENT_ASSIGNED", "CLIENT", clientId, `Assigned ${client.name} to ${user.fullName}`);
  batch.set(audit.ref, audit.data);
  const notice = notificationRef(
    userId,
    "CLIENT_ASSIGNED",
    "New client assigned",
    `${client.name} is now in your client list.`,
    "CLIENT",
    clientId,
  );
  batch.set(notice.ref, notice.data);
  await batch.commit();
}

export async function unassignClient(clientId: string, userId: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const [client, user] = await Promise.all([fetchClient(clientId), fetchUser(userId)]);
  if (!client || !user) throw new Error("Client or salesperson not found.");
  const active = await getDocs(
    query(
      collection(db, paths.clientAssignments(orgId)),
      where("clientId", "==", clientId),
      where("userId", "==", userId),
      where("status", "==", "ACTIVE"),
    ),
  );
  const batch = writeBatch(db);
  batch.update(doc(db, paths.client(orgId, clientId)), {
    assignedUserIds: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
  active.docs.forEach((assignment) => {
    batch.update(assignment.ref, {
      status: "ENDED",
      endedBy: auth.currentUser!.uid,
      endedAt: serverTimestamp(),
      endReason: "Unassigned by administrator",
    });
  });
  const audit = auditRef("CLIENT_UNASSIGNED", "CLIENT", clientId, `Unassigned ${user.fullName} from ${client.name}`);
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function endAssignment(assignmentId: string, reason: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const snap = await getDoc(doc(db, paths.clientAssignment(orgId, assignmentId)));
  if (!snap.exists()) throw new Error("Assignment not found.");
  const assignment = snap.data() as ClientAssignment;
  const batch = writeBatch(db);
  batch.update(snap.ref, {
    status: "ENDED",
    endedBy: auth.currentUser!.uid,
    endedAt: serverTimestamp(),
    endReason: reason,
  });
  batch.update(doc(db, paths.client(orgId, assignment.clientId)), {
    assignedUserIds: arrayRemove(assignment.userId),
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef(
    "CLIENT_UNASSIGNED",
    "CLIENT",
    assignment.clientId,
    `Ended assignment for ${assignment.userName}`,
  );
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

// ------------------------------------------------------------------ visits
export async function fetchVisits(userId?: string): Promise<Visit[]> {
  const { db, orgId } = fb();
  const collectionRef = collection(db, paths.visits(orgId));
  const snap = userId
    ? await getDocs(query(collectionRef, where("userId", "==", userId)))
    : await getDocs(collectionRef);
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Visit)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}

export async function fetchVisit(visitId: string): Promise<Visit | null> {
  const { db, orgId } = fb();
  const snap = await getDoc(doc(db, paths.visit(orgId, visitId)));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Visit) : null;
}

export async function fetchPhotos(visitId: string): Promise<VisitPhoto[]> {
  const { db, orgId } = fb();
  const snap = await getDocs(collection(db, paths.visitPhotos(orgId, visitId)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as VisitPhoto)
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function fetchRevisions(visitId: string): Promise<VisitRevision[]> {
  const { db, orgId } = fb();
  const snap = await getDocs(
    query(collection(db, paths.visitRevisions(orgId, visitId)), orderBy("revisionNumber", "asc")),
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as VisitRevision);
}

export async function scheduleVisit(input: VisitScheduleInput) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const [client, user] = await Promise.all([fetchClient(input.clientId), fetchUser(input.userId)]);
  if (!client || !user) throw new Error("Client or salesperson not found.");
  if (client.status !== "ACTIVE") throw new Error("This client is inactive.");
  if (user.status !== "ACTIVE") throw new Error("This salesperson is inactive.");
  if (!client.assignedUserIds.includes(user.uid)) {
    throw new Error(`${client.name} is not assigned to ${user.fullName}. Assign the client first.`);
  }
  const scheduledFor = Timestamp.fromDate(new Date(input.scheduledFor));
  const ref = doc(collection(db, paths.visits(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    orgId,
    clientId: client.id,
    clientName: client.name,
    clientAddress: `${client.addressLine1}${client.addressLine2 ? `, ${client.addressLine2}` : ""}`,
    clientCity: client.city,
    userId: user.uid,
    userName: user.fullName,
    origin: "SCHEDULED",
    status: "SCHEDULED",
    scheduledFor,
    scheduledBy: auth.currentUser!.uid,
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
    createdBy: auth.currentUser!.uid,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("VISIT_SCHEDULED", "VISIT", ref.id, `Scheduled ${client.name} for ${user.fullName}`);
  batch.set(audit.ref, audit.data);
  const notice = notificationRef(
    user.uid,
    "VISIT_ASSIGNED",
    "New visit scheduled",
    `${client.name} — ${scheduledFor.toDate().toLocaleString("en-IN")}`,
    "VISIT",
    ref.id,
  );
  batch.set(notice.ref, notice.data);
  await batch.commit();
  return ref.id;
}

export async function approveVisit(visit: Visit, note: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  // A deactivated salesperson cannot receive notifications; the decision itself must still go through.
  const notifyOwner = await isActiveMember(visit.userId);
  const batch = writeBatch(db);
  batch.update(doc(db, paths.visit(orgId, visit.id)), {
    status: "APPROVED",
    approvedAt: serverTimestamp(),
    approvedBy: auth.currentUser!.uid,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, paths.client(orgId, visit.clientId)), {
    lastVisitAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef(
    "VISIT_APPROVED",
    "VISIT",
    visit.id,
    `Approved visit at ${visit.clientName}${note ? `: ${note}` : ""}`,
  );
  batch.set(audit.ref, audit.data);
  if (notifyOwner) {
    const notice = notificationRef(
      visit.userId,
      "VISIT_APPROVED",
      "Visit approved",
      `${visit.clientName} has been approved.`,
      "VISIT",
      visit.id,
    );
    batch.set(notice.ref, notice.data);
  }

  if (visit.report?.followupRequired && visit.report.followupDate) {
    // Never duplicate the follow-up (e.g. one was already raised for this visit).
    const existing = await getDocs(
      query(collection(db, paths.followups(orgId)), where("visitId", "==", visit.id), limit(1)),
    );
    const [client, user] = existing.empty
      ? await Promise.all([fetchClient(visit.clientId), fetchUser(visit.userId)])
      : [null, null];
    // Rules require the current client/profile names and both to be active; otherwise skip, don't block approval.
    if (client?.status === "ACTIVE" && user?.status === "ACTIVE") {
      const followupRef = doc(collection(db, paths.followups(orgId)));
      batch.set(followupRef, {
        orgId,
        clientId: visit.clientId,
        clientName: client.name,
        userId: visit.userId,
        userName: user.fullName,
        visitId: visit.id,
        title: clamp(`Follow up: ${client.name}`, 160),
        notes: clamp(visit.report.nextAction || visit.report.summary, 1000),
        dueDate: visit.report.followupDate,
        status: "OPEN",
        completedAt: null,
        completedBy: null,
        completionNote: "",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser!.uid,
        updatedAt: serverTimestamp(),
      });
      if (notifyOwner) {
        const followupNotice = notificationRef(
          visit.userId,
          "FOLLOWUP_DUE",
          "Follow-up created",
          `${client.name} — due ${visit.report.followupDate}`,
          "FOLLOWUP",
          followupRef.id,
        );
        batch.set(followupNotice.ref, followupNotice.data);
      }
    }
  }

  await batch.commit();
}

export async function returnVisit(visit: Visit, reason: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const notifyOwner = await isActiveMember(visit.userId);
  const batch = writeBatch(db);
  batch.update(doc(db, paths.visit(orgId, visit.id)), {
    status: "RETURNED",
    returnedAt: serverTimestamp(),
    returnedBy: auth.currentUser!.uid,
    returnReason: reason,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("VISIT_RETURNED", "VISIT", visit.id, `Returned visit at ${visit.clientName}: ${reason}`);
  batch.set(audit.ref, audit.data);
  if (notifyOwner) {
    const notice = notificationRef(
      visit.userId,
      "VISIT_RETURNED",
      "Visit returned for correction",
      `${visit.clientName}: ${reason}`,
      "VISIT",
      visit.id,
    );
    batch.set(notice.ref, notice.data);
  }
  await batch.commit();
}

export async function cancelVisit(visit: Visit, reason: string) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const notifyOwner = await isActiveMember(visit.userId);
  const batch = writeBatch(db);
  batch.update(doc(db, paths.visit(orgId, visit.id)), {
    status: "CANCELLED",
    cancelledAt: serverTimestamp(),
    cancelledBy: auth.currentUser!.uid,
    cancelReason: reason,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("VISIT_CANCELLED", "VISIT", visit.id, `Cancelled visit at ${visit.clientName}: ${reason}`);
  batch.set(audit.ref, audit.data);
  if (notifyOwner) {
    const notice = notificationRef(
      visit.userId,
      "VISIT_CANCELLED",
      "Visit cancelled",
      `${visit.clientName}: ${reason}`,
      "VISIT",
      visit.id,
    );
    batch.set(notice.ref, notice.data);
  }
  await batch.commit();
}

// --------------------------------------------------------------- followups
export async function fetchFollowups(userId?: string): Promise<Followup[]> {
  const { db, orgId } = fb();
  const snap = userId
    ? await getDocs(query(collection(db, paths.followups(orgId)), where("userId", "==", userId)))
    : await getDocs(collection(db, paths.followups(orgId)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as Followup)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function createFollowup(input: FollowupInput) {
  const { db, orgId, auth } = fb();
  await myMembership();
  const [client, user] = await Promise.all([fetchClient(input.clientId), fetchUser(input.userId)]);
  if (!client || !user) throw new Error("Client or salesperson not found.");
  if (client.status !== "ACTIVE") throw new Error("This client is inactive.");
  if (user.status !== "ACTIVE") throw new Error("This salesperson is inactive.");
  if (!client.assignedUserIds.includes(user.uid)) {
    throw new Error(`${client.name} is not assigned to ${user.fullName}. Assign the client first.`);
  }
  const ref = doc(collection(db, paths.followups(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    orgId,
    clientId: client.id,
    clientName: client.name,
    userId: user.uid,
    userName: user.fullName,
    visitId: input.visitId,
    title: input.title,
    notes: input.notes,
    dueDate: input.dueDate,
    status: "OPEN",
    completedAt: null,
    completedBy: null,
    completionNote: "",
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser!.uid,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("FOLLOWUP_CREATED", "FOLLOWUP", ref.id, `Created follow-up for ${client.name}`);
  batch.set(audit.ref, audit.data);
  if (user.uid !== auth.currentUser!.uid) {
    const notice = notificationRef(
      user.uid,
      "FOLLOWUP_DUE",
      "New follow-up assigned",
      `${client.name} — due ${input.dueDate}`,
      "FOLLOWUP",
      ref.id,
    );
    batch.set(notice.ref, notice.data);
  }
  await batch.commit();
  return ref.id;
}

export async function completeFollowup(followup: Followup, note: string) {
  const { db, orgId, auth } = fb();
  const me = await myMembership();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.followups(orgId), followup.id), {
    status: "DONE",
    completedAt: serverTimestamp(),
    completedBy: auth.currentUser!.uid,
    completionNote: note,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("FOLLOWUP_COMPLETED", "FOLLOWUP", followup.id, `Completed follow-up for ${followup.clientName}`);
  batch.set(audit.ref, audit.data);
  if (me.role === "USER") {
    const admins = await getDocs(
      query(collection(db, "memberships"), where("orgId", "==", orgId), where("role", "==", "ADMIN"), where("status", "==", "ACTIVE")),
    );
    admins.docs.forEach((admin) => {
      const notice = notificationRef(
        admin.id,
        "FOLLOWUP_COMPLETED",
        "Follow-up completed",
        `${followup.userName} completed ${followup.title} for ${followup.clientName}.`,
        "FOLLOWUP",
        followup.id,
      );
      batch.set(notice.ref, notice.data);
    });
  }
  await batch.commit();
}

export async function cancelFollowup(followup: Followup) {
  const { db, orgId } = fb();
  await myMembership();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.followups(orgId), followup.id), {
    status: "CANCELLED",
    completedAt: null,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("FOLLOWUP_CANCELLED", "FOLLOWUP", followup.id, `Cancelled follow-up for ${followup.clientName}`);
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

// ----------------------------------------------------------- notifications
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { db, orgId, auth } = fb();
  const snap = await getDocs(
    query(
      collection(db, paths.notifications(orgId)),
      where("recipientUid", "==", auth.currentUser!.uid),
      orderBy("createdAt", "desc"),
      limit(100),
    ),
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as AppNotification);
}

function unreadNotificationsQuery() {
  const { db, orgId, auth } = fb();
  return query(
    collection(db, paths.notifications(orgId)),
    where("recipientUid", "==", auth.currentUser!.uid),
    where("readAt", "==", null),
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const snap = await getCountFromServer(unreadNotificationsQuery());
  return snap.data().count;
}

export async function markNotificationRead(notificationId: string) {
  const { db, orgId } = fb();
  await updateDoc(doc(db, paths.notification(orgId, notificationId)), { readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(notifications: AppNotification[]) {
  const { db, orgId } = fb();
  const batch = writeBatch(db);
  notifications
    .filter((notification) => !notification.readAt)
    .forEach((notification) => {
      batch.update(doc(db, paths.notification(orgId, notification.id)), { readAt: serverTimestamp() });
    });
  await batch.commit();
}

// ------------------------------------------------------------------- audit
export async function fetchAuditLogs(): Promise<AuditLog[]> {
  const { db, orgId } = fb();
  const snap = await getDocs(
    query(collection(db, paths.auditLogs(orgId)), orderBy("createdAt", "desc"), limit(200)),
  );
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditLog);
}

// --------------------------------------------------------------- dashboard
export interface DashboardData {
  activeClients: number;
  salespeople: number;
  pendingApprovals: number;
  todayVisits: number;
  openFollowups: number;
  approvedThisMonth: number;
  recentVisits: Visit[];
  pendingVisits: Visit[];
  upcomingVisits: Visit[];
  dueFollowups: Followup[];
  recentAudit: AuditLog[];
  unreadNotifications: number;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const { db, orgId, auth } = fb();
  const membership = await myMembership();
  const uid = auth.currentUser!.uid;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const unreadNotifications = await fetchUnreadNotificationCount();

  if (membership.role === "USER") {
    const [visitsSnap, followupsSnap, clientsSnap] = await Promise.all([
      getDocs(query(collection(db, paths.visits(orgId)), where("userId", "==", uid))),
      getDocs(query(collection(db, paths.followups(orgId)), where("userId", "==", uid))),
      getDocs(query(collection(db, paths.clients(orgId)), where("assignedUserIds", "array-contains", uid))),
    ]);
    const visits = visitsSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Visit)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const followups = followupsSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as Followup);
    const activeClients = clientsSnap.docs.filter((item) => item.data().status === "ACTIVE").length;
    return {
      activeClients,
      salespeople: 0,
      pendingApprovals: visits.filter((visit) => visit.status === "SUBMITTED").length,
      todayVisits: visits.filter((visit) => {
        const scheduled = visit.scheduledFor?.toDate();
        return (visit.status === "SCHEDULED" || visit.status === "IN_PROGRESS") && scheduled && scheduled >= dayStart && scheduled < dayEnd;
      }).length,
      openFollowups: followups.filter((followup) => followup.status === "OPEN").length,
      approvedThisMonth: visits.filter((visit) => visit.status === "APPROVED" && (visit.approvedAt?.toMillis() ?? 0) >= monthStart.getTime()).length,
      recentVisits: visits.slice(0, 8),
      pendingVisits: visits.filter((visit) => visit.status === "SUBMITTED").slice(0, 6),
      upcomingVisits: visits
        .filter((visit) => visit.status === "SCHEDULED" && visit.scheduledFor && visit.scheduledFor.toMillis() >= dayStart.getTime())
        .sort((a, b) => (a.scheduledFor?.toMillis() ?? 0) - (b.scheduledFor?.toMillis() ?? 0))
        .slice(0, 6),
      dueFollowups: followups
        .filter((followup) => followup.status === "OPEN")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6),
      recentAudit: [],
      unreadNotifications,
    };
  }

  const [clientsCount, usersCount, pendingCount, todayCount, followupCount, approvedCount] = await Promise.all([
    getCountFromServer(query(collection(db, paths.clients(orgId)), where("status", "==", "ACTIVE"))),
    getCountFromServer(query(collection(db, paths.users(orgId)), where("role", "==", "USER"), where("status", "==", "ACTIVE"))),
    getCountFromServer(query(collection(db, paths.visits(orgId)), where("status", "==", "SUBMITTED"))),
    getCountFromServer(
      query(
        collection(db, paths.visits(orgId)),
        where("status", "in", ["SCHEDULED", "IN_PROGRESS"]),
        where("scheduledFor", ">=", Timestamp.fromDate(dayStart)),
        where("scheduledFor", "<", Timestamp.fromDate(dayEnd)),
      ),
    ),
    getCountFromServer(query(collection(db, paths.followups(orgId)), where("status", "==", "OPEN"))),
    getCountFromServer(
      query(
        collection(db, paths.visits(orgId)),
        where("approvedAt", ">=", Timestamp.fromDate(monthStart)),
      ),
    ),
  ]);

  // Targeted, limited queries keep the dashboard to a few dozen reads instead of every visit and follow-up.
  const visitsRef = collection(db, paths.visits(orgId));
  const [recentSnap, pendingSnap, upcomingSnap, followupsSnap, auditSnap] = await Promise.all([
    getDocs(query(visitsRef, orderBy("createdAt", "desc"), limit(8))),
    getDocs(query(visitsRef, where("status", "==", "SUBMITTED"), orderBy("createdAt", "desc"), limit(6))),
    getDocs(
      query(
        visitsRef,
        where("status", "==", "SCHEDULED"),
        where("scheduledFor", ">=", Timestamp.fromDate(dayStart)),
        orderBy("scheduledFor", "asc"),
        limit(6),
      ),
    ),
    getDocs(
      query(collection(db, paths.followups(orgId)), where("status", "==", "OPEN"), orderBy("dueDate", "asc"), limit(6)),
    ),
    getDocs(query(collection(db, paths.auditLogs(orgId)), orderBy("createdAt", "desc"), limit(8))),
  ]);
  const toVisits = (snap: typeof recentSnap) => snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Visit);

  return {
    activeClients: clientsCount.data().count,
    salespeople: usersCount.data().count,
    pendingApprovals: pendingCount.data().count,
    todayVisits: todayCount.data().count,
    openFollowups: followupCount.data().count,
    approvedThisMonth: approvedCount.data().count,
    recentVisits: toVisits(recentSnap),
    pendingVisits: toVisits(pendingSnap),
    upcomingVisits: toVisits(upcomingSnap),
    dueFollowups: followupsSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as Followup),
    recentAudit: auditSnap.docs.map((item) => ({ id: item.id, ...item.data() }) as AuditLog),
    unreadNotifications,
  };
}

export { fromSnap };
export type { VisitReport };
