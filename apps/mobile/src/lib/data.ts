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
  type WriteBatch,
} from "firebase/firestore";
import type {
  AuditAction,
  Client,
  Followup,
  UserProfile,
  Visit,
  VisitPhoto,
  VisitReport,
} from "@fieldops/shared-types";
import { paths } from "@fieldops/shared-types";
import { followupInputSchema, type FollowupInput } from "@fieldops/shared-validation";
import { getFirebase } from "./firebase";
import { clearCache, readCache, writeCache } from "./cache";
import { ensureOnline, errorCode, isNetworkError, isOnline, withTimeout } from "./network";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_VISIT } from "./photos";

interface GeoInput {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}

function fb() {
  const firebase = getFirebase();
  if (!firebase.auth.currentUser) throw new Error("You must be signed in.");
  return firebase;
}

const clamp = (value: string, max: number) => value.slice(0, max);

/** Commit with a fast offline check and a timeout so a write can never hang the screen. */
async function commit(batch: WriteBatch): Promise<void> {
  await ensureOnline();
  await withTimeout(batch.commit());
}

/**
 * Serve a list from the network, falling back to the offline cache only for connection problems.
 * Access errors clear the cache (data the user may no longer see) and are rethrown.
 */
async function cachedList<T>(key: string, offlineMessage: string, load: () => Promise<T[]>): Promise<{ items: T[]; fromCache: boolean }> {
  try {
    if (!(await isOnline())) throw new Error("Device is offline.");
    const items = await withTimeout(load(), 15_000);
    await writeCache(key, items);
    return { items, fromCache: false };
  } catch (cause) {
    if (errorCode(cause).endsWith("permission-denied")) {
      await clearCache().catch(() => {});
      throw cause;
    }
    if (!isNetworkError(cause)) throw cause;
    const cached = await readCache<T[]>(key);
    if (cached) return { items: cached, fromCache: true };
    throw new Error(offlineMessage);
  }
}

function auditRef(action: AuditAction, entityId: string, summary: string, entityType: "VISIT" | "FOLLOWUP" = "VISIT") {
  const { db, orgId, auth } = getFirebase();
  return {
    ref: doc(collection(db, paths.auditLogs(orgId))),
    data: {
      orgId,
      actorId: auth.currentUser!.uid,
      actorRole: "USER",
      action,
      entityType,
      entityId,
      summary: clamp(summary, 500),
      metadata: null,
      createdAt: serverTimestamp(),
    },
  };
}

async function notifyAdmins(type: "VISIT_SUBMITTED" | "VISIT_RESUBMITTED" | "FOLLOWUP_COMPLETED", title: string, body: string, entityId: string) {
  const { db, orgId, auth } = fb();
  const admins = await withTimeout(getDocs(
    query(
      collection(db, "memberships"),
      where("orgId", "==", orgId),
      where("role", "==", "ADMIN"),
      where("status", "==", "ACTIVE"),
    ),
  ));
  await withTimeout(Promise.all(
    admins.docs.map((admin) =>
      setDoc(doc(collection(db, paths.notifications(orgId))), {
        orgId,
        recipientUid: admin.id,
        type,
        title: clamp(title, 160),
        body: clamp(body, 1000),
        entityType: type === "FOLLOWUP_COMPLETED" ? "FOLLOWUP" : "VISIT",
        entityId,
        readAt: null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser!.uid,
      }),
    ),
  ));
}

export async function fetchMyClients(uid: string, orgId: string): Promise<{ items: Client[]; fromCache: boolean }> {
  const { db } = fb();
  return cachedList(`clients:${uid}`, "You are offline and no cached clients are available.", async () => {
    const snap = await getDocs(query(collection(db, paths.clients(orgId)), where("assignedUserIds", "array-contains", uid)));
    return snap.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Client)
      .filter((client) => client.status === "ACTIVE")
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export interface MyClientDetails {
  client: Client;
  visits: Visit[];
  followups: Followup[];
}

/** Fetch the current assignment from Firestore before loading related records. */
export async function fetchMyClientDetails(clientId: string, uid: string, orgId: string): Promise<MyClientDetails | null> {
  const { db, auth, orgId: currentOrg } = fb();
  if (auth.currentUser?.uid !== uid || currentOrg !== orgId) throw new Error("Account or organization mismatch.");

  const clientSnap = await getDoc(doc(db, paths.client(orgId, clientId)));
  if (!clientSnap.exists()) return null;
  const client = { id: clientSnap.id, ...clientSnap.data() } as Client;
  if (client.status !== "ACTIVE" || !client.assignedUserIds.includes(uid)) return null;

  const [visitSnap, followupSnap] = await Promise.all([
    getDocs(query(collection(db, paths.visits(orgId)), where("userId", "==", uid))),
    getDocs(query(collection(db, paths.followups(orgId)), where("userId", "==", uid))),
  ]);

  return {
    client,
    visits: visitSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Visit)
      .filter((visit) => visit.clientId === clientId)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()),
    followups: followupSnap.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Followup)
      .filter((followup) => followup.clientId === clientId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  };
}

export async function fetchMyVisits(uid: string, orgId: string): Promise<{ items: Visit[]; fromCache: boolean }> {
  const { db } = fb();
  return cachedList(`visits:${uid}`, "You are offline and no cached visits are available.", async () => {
    const snap = await getDocs(query(collection(db, paths.visits(orgId)), where("userId", "==", uid)));
    return snap.docs
      .map((item) => ({ id: item.id, ...item.data() }) as Visit)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  });
}

export async function fetchMyFollowups(uid: string, orgId: string): Promise<{ items: Followup[]; fromCache: boolean }> {
  const { db } = fb();
  return cachedList(`followups:${uid}`, "You are offline and no cached follow-ups are available.", async () => {
    const snap = await getDocs(query(collection(db, paths.followups(orgId)), where("userId", "==", uid)));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Followup);
  });
}

export async function fetchVisit(visitId: string, orgId: string): Promise<Visit | null> {
  const { db } = fb();
  const snap = await getDoc(doc(db, paths.visit(orgId, visitId)));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Visit) : null;
}

export async function fetchVisitPhotos(visitId: string, orgId: string): Promise<VisitPhoto[]> {
  const { db } = fb();
  const snap = await getDocs(collection(db, paths.visitPhotos(orgId, visitId)));
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as VisitPhoto)
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

function visitBase(client: Client, profile: UserProfile, uid: string, orgId: string) {
  return {
    orgId,
    clientId: client.id,
    clientName: client.name,
    clientAddress: `${client.addressLine1}${client.addressLine2 ? `, ${client.addressLine2}` : ""}`,
    clientCity: client.city,
    userId: uid,
    userName: profile.fullName,
  };
}

export async function startScheduledVisit(visit: Visit, gps: GeoInput): Promise<void> {
  const { db, orgId } = fb();
  const batch = writeBatch(db);
  batch.update(doc(db, paths.visit(orgId, visit.id)), {
    status: "IN_PROGRESS",
    checkIn: { ...gps, capturedAt: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("VISIT_STARTED", visit.id, `Started visit at ${visit.clientName}`);
  batch.set(audit.ref, audit.data);
  await commit(batch);
}

export async function startAdHocVisit(client: Client, profile: UserProfile, gps: GeoInput): Promise<string> {
  const { db, orgId, auth } = fb();
  const ref = doc(collection(db, paths.visits(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...visitBase(client, profile, auth.currentUser!.uid, orgId),
    origin: "AD_HOC",
    status: "IN_PROGRESS",
    scheduledFor: null,
    scheduledBy: null,
    checkIn: { ...gps, capturedAt: serverTimestamp() },
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
  const audit = auditRef("VISIT_STARTED", ref.id, `Started ad hoc visit at ${client.name}`);
  batch.set(audit.ref, audit.data);
  await commit(batch);
  return ref.id;
}

export async function saveDraft(visitId: string, orgId: string, report: VisitReport): Promise<void> {
  const { db } = fb();
  await ensureOnline();
  await withTimeout(updateDoc(doc(db, paths.visit(orgId, visitId)), {
    report,
    updatedAt: serverTimestamp(),
  }));
}

export async function addVisitPhoto(input: {
  visitId: string;
  orgId: string;
  base64: string;
  sizeBytes: number;
  caption: string;
  currentPhotoCount: number;
}): Promise<void> {
  const { db, auth } = fb();
  if (input.base64.length > 500_000) throw new Error("Photo is too large after compression (max ~375 KB).");
  if (input.sizeBytes > MAX_PHOTO_BYTES) throw new Error("Photo exceeds the 350 KB upload limit.");
  if (input.currentPhotoCount >= MAX_PHOTOS_PER_VISIT) throw new Error(`Maximum of ${MAX_PHOTOS_PER_VISIT} photos per visit reached.`);
  const batch = writeBatch(db);
  batch.set(doc(collection(db, paths.visitPhotos(input.orgId, input.visitId))), {
    orgId: input.orgId,
    visitId: input.visitId,
    contentType: "image/jpeg",
    data: input.base64,
    sizeBytes: input.sizeBytes,
    caption: input.caption.slice(0, 300),
    uploadedBy: auth.currentUser!.uid,
    createdAt: serverTimestamp(),
  });
  // The rules require photoCount to move by exactly one in the same batch; increment() is exact server-side.
  batch.update(doc(db, paths.visit(input.orgId, input.visitId)), {
    photoCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await commit(batch);
}

export async function removeVisitPhoto(input: { visitId: string; orgId: string; photoId: string }): Promise<void> {
  const { db } = fb();
  const batch = writeBatch(db);
  batch.delete(doc(db, paths.visitPhotos(input.orgId, input.visitId), input.photoId));
  batch.update(doc(db, paths.visit(input.orgId, input.visitId)), {
    photoCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await commit(batch);
}

/**
 * Submit (or resubmit) a visit report. The visit, client and profile are read fresh right before the
 * batch is built because the rules compare the revision and follow-up with the stored documents.
 * Resolves `followupSkipped: true` when a requested follow-up could not be created (client no longer
 * active or assigned); the submission itself still succeeds.
 */
export async function submitVisit(input: {
  visit: Visit;
  orgId: string;
  report: VisitReport;
  gps: GeoInput | null;
}): Promise<{ followupSkipped: boolean }> {
  const { db, orgId, auth } = fb();
  const uid = auth.currentUser!.uid;
  await ensureOnline();
  const visitRef = doc(db, paths.visit(orgId, input.visit.id));
  const visitSnap = await withTimeout(getDoc(visitRef));
  if (!visitSnap.exists()) throw new Error("This visit no longer exists.");
  const visit = { id: visitSnap.id, ...visitSnap.data() } as Visit;
  if (visit.userId !== uid) throw new Error("This visit is not assigned to you.");
  if (visit.status !== "IN_PROGRESS" && visit.status !== "RETURNED") {
    throw new Error("This visit is no longer open for submission. Reopen it to see its current status.");
  }
  const isResubmission = visit.status === "RETURNED";
  const gps = input.gps;
  if (!isResubmission && !gps) throw new Error("A GPS fix is required to check out of the visit.");

  const batch = writeBatch(db);
  batch.update(visitRef, {
    status: "SUBMITTED",
    report: input.report,
    // A resubmission keeps the original check-out and is the only write that bumps revisionCount.
    ...(isResubmission
      ? { revisionCount: visit.revisionCount + 1 }
      : { checkOut: { ...gps, capturedAt: serverTimestamp() } }),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (isResubmission) {
    batch.set(doc(collection(db, paths.visitRevisions(orgId, visit.id))), {
      orgId,
      visitId: visit.id,
      revisionNumber: visit.revisionCount + 1,
      previousReport: visit.report,
      newReport: input.report,
      returnReason: visit.returnReason,
      editedBy: uid,
      createdAt: serverTimestamp(),
    });
  }

  let followupSkipped = false;
  let userName = visit.userName;
  if (input.report.followupRequired && input.report.followupDate) {
    try {
      const [clientSnap, profileSnap, existing] = await withTimeout(Promise.all([
        getDoc(doc(db, paths.client(orgId, visit.clientId))),
        getDoc(doc(db, paths.user(orgId, uid))),
        getDocs(query(collection(db, paths.followups(orgId)), where("userId", "==", uid), where("visitId", "==", visit.id))),
      ]));
      const client = clientSnap.exists() ? ({ id: clientSnap.id, ...clientSnap.data() } as Client) : null;
      const profile = profileSnap.exists() ? (profileSnap.data() as UserProfile) : null;
      if (profile) userName = profile.fullName;
      const alreadyOpen = existing.docs.some((item) => item.data().status === "OPEN");
      if (!client || !profile || client.status !== "ACTIVE" || !client.assignedUserIds.includes(uid) || profile.status !== "ACTIVE") {
        followupSkipped = true;
      } else if (!alreadyOpen) {
        batch.set(doc(collection(db, paths.followups(orgId))), {
          orgId,
          clientId: client.id,
          clientName: client.name,
          userId: uid,
          userName: profile.fullName,
          visitId: visit.id,
          title: clamp(`Follow up: ${client.name}`, 160),
          notes: clamp(input.report.nextAction, 1000),
          dueDate: input.report.followupDate,
          status: "OPEN",
          completedAt: null,
          completedBy: null,
          completionNote: "",
          createdAt: serverTimestamp(),
          createdBy: uid,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (cause) {
      if (isNetworkError(cause)) throw cause;
      // Client no longer readable (e.g. unassigned): submit the report without the follow-up.
      followupSkipped = true;
    }
  }

  const audit = auditRef(
    isResubmission ? "VISIT_RESUBMITTED" : "VISIT_SUBMITTED",
    visit.id,
    `${isResubmission ? "Resubmitted" : "Submitted"} visit at ${visit.clientName}`,
  );
  batch.set(audit.ref, audit.data);
  await commit(batch);
  await notifyAdmins(
    isResubmission ? "VISIT_RESUBMITTED" : "VISIT_SUBMITTED",
    isResubmission ? "Visit resubmitted" : "Visit submitted",
    `${userName} ${isResubmission ? "resubmitted" : "submitted"} ${visit.clientName}.`,
    visit.id,
  ).catch(() => {
    // The submission itself succeeded; a notification failure must not resubmit.
  });
  return { followupSkipped };
}

export async function cancelOwnVisit(visit: Visit, orgId: string, reason: string): Promise<void> {
  const { db, auth } = fb();
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("Enter a cancellation reason of at least 3 characters.");
  if (trimmed.length > 1000) throw new Error("Keep the cancellation reason under 1000 characters.");
  const batch = writeBatch(db);
  batch.update(doc(db, paths.visit(orgId, visit.id)), {
    status: "CANCELLED",
    cancelledAt: serverTimestamp(),
    cancelledBy: auth.currentUser!.uid,
    cancelReason: trimmed,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("VISIT_CANCELLED", visit.id, `Cancelled visit at ${visit.clientName}: ${trimmed}`);
  batch.set(audit.ref, audit.data);
  await commit(batch);
}

export async function scheduleOwnVisit(client: Client, profile: UserProfile, orgId: string, scheduledFor: Date): Promise<string> {
  const { db, auth } = fb();
  const ref = doc(collection(db, paths.visits(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    ...visitBase(client, profile, auth.currentUser!.uid, orgId),
    origin: "SCHEDULED",
    status: "SCHEDULED",
    scheduledFor: Timestamp.fromDate(scheduledFor),
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
  const audit = auditRef("VISIT_SCHEDULED", ref.id, `Scheduled visit at ${client.name}`);
  batch.set(audit.ref, audit.data);
  await commit(batch);
  return ref.id;
}

export async function completeMyFollowup(followup: Followup, orgId: string, note: string): Promise<void> {
  const { db, orgId: currentOrg, auth } = fb();
  if (currentOrg !== orgId) throw new Error("Organization mismatch.");
  const batch = writeBatch(db);
  batch.update(doc(db, paths.followup(orgId, followup.id)), {
    status: "DONE",
    completedAt: serverTimestamp(),
    completedBy: auth.currentUser!.uid,
    completionNote: clamp(note, 1000),
    updatedAt: serverTimestamp(),
  });
  await commit(batch);
  await notifyAdmins(
    "FOLLOWUP_COMPLETED",
    "Follow-up completed",
    `${auth.currentUser!.displayName ?? followup.userName} completed ${followup.title} for ${followup.clientName}.`,
    followup.id,
  ).catch(() => {});
}

export async function createMyFollowup(
  input: Pick<FollowupInput, "clientId" | "title" | "notes" | "dueDate">,
  orgId: string,
): Promise<string> {
  const { db, orgId: currentOrg, auth } = fb();
  const uid = auth.currentUser!.uid;
  if (currentOrg !== orgId) throw new Error("Organization mismatch.");

  const parsed = followupInputSchema.safeParse({ ...input, userId: uid, visitId: null });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check the follow-up details.");

  await ensureOnline();
  const [clientSnap, profileSnap] = await withTimeout(Promise.all([
    getDoc(doc(db, paths.client(orgId, parsed.data.clientId))),
    getDoc(doc(db, paths.user(orgId, uid))),
  ]));
  if (!clientSnap.exists() || !profileSnap.exists()) throw new Error("Client or salesperson profile is unavailable.");
  const client = { id: clientSnap.id, ...clientSnap.data() } as Client;
  const profile = profileSnap.data();
  if (client.status !== "ACTIVE" || !client.assignedUserIds.includes(uid)) {
    throw new Error("Follow-ups can only be created for active clients assigned to you.");
  }
  if (profile.status !== "ACTIVE" || profile.role !== "USER") throw new Error("Your salesperson account is inactive.");

  const ref = doc(collection(db, paths.followups(orgId)));
  const batch = writeBatch(db);
  batch.set(ref, {
    orgId,
    clientId: client.id,
    clientName: client.name,
    userId: uid,
    userName: profile.fullName,
    visitId: null,
    title: clamp(parsed.data.title, 160),
    notes: clamp(parsed.data.notes, 1000),
    dueDate: parsed.data.dueDate,
    status: "OPEN",
    completedAt: null,
    completedBy: null,
    completionNote: "",
    createdAt: serverTimestamp(),
    createdBy: uid,
    updatedAt: serverTimestamp(),
  });
  const audit = auditRef("FOLLOWUP_CREATED", ref.id, `Created follow-up for ${client.name}`, "FOLLOWUP");
  batch.set(audit.ref, audit.data);
  await commit(batch);
  return ref.id;
}
