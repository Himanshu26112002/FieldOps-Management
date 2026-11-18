// Domain enums, constants and document types shared by the web and mobile apps.
// Source of truth: docs/DATABASE_SCHEMA.md and docs/PRODUCT_REQUIREMENTS.md §6.

export const ROLES = ["ADMIN", "USER"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const CLIENT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ASSIGNMENT_STATUSES = ["ACTIVE", "ENDED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const VISIT_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "CANCELLED",
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_ORIGINS = ["AD_HOC", "SCHEDULED"] as const;
export type VisitOrigin = (typeof VISIT_ORIGINS)[number];

export const VISIT_OUTCOMES = [
  "INTERESTED",
  "FOLLOW_UP_REQUIRED",
  "ORDER_PLACED",
  "INFORMATION_ONLY",
  "NOT_INTERESTED",
] as const;
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];

export const FOLLOWUP_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "VISIT_ASSIGNED",
  "VISIT_SUBMITTED",
  "VISIT_APPROVED",
  "VISIT_RETURNED",
  "VISIT_CANCELLED",
  "FOLLOWUP_DUE",
  "FOLLOWUP_COMPLETED",
  "CLIENT_ASSIGNED",
  "ACCOUNT_CREATED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AUDIT_ACTIONS = [
  "LOGIN",
  "CLIENT_CREATED",
  "CLIENT_UPDATED",
  "CLIENT_DEACTIVATED",
  "CLIENT_ASSIGNED",
  "CLIENT_UNASSIGNED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DEACTIVATED",
  "VISIT_SCHEDULED",
  "VISIT_STARTED",
  "VISIT_SUBMITTED",
  "VISIT_RESUBMITTED",
  "VISIT_APPROVED",
  "VISIT_RETURNED",
  "VISIT_CANCELLED",
  "FOLLOWUP_CREATED",
  "FOLLOWUP_COMPLETED",
  "FOLLOWUP_CANCELLED",
  "ORG_SETTINGS_UPDATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = [
  "CLIENT",
  "USER",
  "VISIT",
  "FOLLOWUP",
  "ORGANIZATION",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Allowed visit status transitions (PRODUCT_REQUIREMENTS.md §6). Who may perform each is enforced in Security Rules. */
export const VISIT_TRANSITIONS: Readonly<Record<VisitStatus, readonly VisitStatus[]>> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["APPROVED", "RETURNED"],
  RETURNED: ["SUBMITTED"],
  APPROVED: [],
  CANCELLED: [],
};

export function canTransition(from: VisitStatus, to: VisitStatus): boolean {
  return VISIT_TRANSITIONS[from].includes(to);
}

export const VISIT_STATUS_LABELS: Readonly<Record<VisitStatus, string>> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Awaiting approval",
  RETURNED: "Returned for correction",
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
};

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: "Administrator",
  USER: "Salesperson",
};

export const OUTCOME_LABELS: Readonly<Record<VisitOutcome, string>> = {
  INTERESTED: "Interested",
  FOLLOW_UP_REQUIRED: "Follow-up required",
  ORDER_PLACED: "Order placed",
  INFORMATION_ONLY: "Information shared only",
  NOT_INTERESTED: "Not interested",
};

export const FOLLOWUP_STATUS_LABELS: Readonly<Record<FollowupStatus, string>> = {
  OPEN: "Open",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  LOGIN: "Signed in",
  CLIENT_CREATED: "Client created",
  CLIENT_UPDATED: "Client updated",
  CLIENT_DEACTIVATED: "Client deactivated",
  CLIENT_ASSIGNED: "Client assigned",
  CLIENT_UNASSIGNED: "Client unassigned",
  USER_CREATED: "Salesperson created",
  USER_UPDATED: "Salesperson updated",
  USER_DEACTIVATED: "Salesperson deactivated",
  VISIT_SCHEDULED: "Visit scheduled",
  VISIT_STARTED: "Visit started",
  VISIT_SUBMITTED: "Visit submitted",
  VISIT_RESUBMITTED: "Visit resubmitted",
  VISIT_APPROVED: "Visit approved",
  VISIT_RETURNED: "Visit returned",
  VISIT_CANCELLED: "Visit cancelled",
  FOLLOWUP_CREATED: "Follow-up created",
  FOLLOWUP_COMPLETED: "Follow-up completed",
  FOLLOWUP_CANCELLED: "Follow-up cancelled",
  ORG_SETTINGS_UPDATED: "Organization settings updated",
};

/** Firestore paths. All business data is scoped under organizations/{orgId}. */
export const paths = {
  membership: (uid: string) => `memberships/${uid}`,
  organization: (orgId: string) => `organizations/${orgId}`,
  users: (orgId: string) => `organizations/${orgId}/users`,
  user: (orgId: string, uid: string) => `organizations/${orgId}/users/${uid}`,
  clients: (orgId: string) => `organizations/${orgId}/clients`,
  client: (orgId: string, clientId: string) => `organizations/${orgId}/clients/${clientId}`,
  clientAssignments: (orgId: string) => `organizations/${orgId}/client_assignments`,
  clientAssignment: (orgId: string, id: string) =>
    `organizations/${orgId}/client_assignments/${id}`,
  visits: (orgId: string) => `organizations/${orgId}/visits`,
  visit: (orgId: string, visitId: string) => `organizations/${orgId}/visits/${visitId}`,
  visitPhotos: (orgId: string, visitId: string) => `organizations/${orgId}/visits/${visitId}/photos`,
  visitRevisions: (orgId: string, visitId: string) =>
    `organizations/${orgId}/visits/${visitId}/revisions`,
  followups: (orgId: string) => `organizations/${orgId}/followups`,
  followup: (orgId: string, id: string) => `organizations/${orgId}/followups/${id}`,
  notifications: (orgId: string) => `organizations/${orgId}/notifications`,
  notification: (orgId: string, id: string) => `organizations/${orgId}/notifications/${id}`,
  auditLogs: (orgId: string) => `organizations/${orgId}/audit_logs`,
} as const;

/** Ports must match firebase.json. */
export const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
} as const;

/** Project ID used for local emulator runs. The "demo-" prefix makes the emulators refuse to reach real cloud resources. */
export const EMULATOR_PROJECT_ID = "demo-fieldops";

export interface TimestampLike {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
}

export interface GeoPointLike {
  latitude: number;
  longitude: number;
}

export interface GeoCapture {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: TimestampLike;
}

export interface OrganizationSettings {
  timezone: string;
  currency: string;
  gpsAccuracyThresholdMeters: number;
  photoMaxPerVisit: number;
  photoMaxBytes: number;
  visitReminderLeadMinutes: number;
  workdayStart: string;
  workdayEnd: string;
}

export interface Organization {
  id: string;
  name: string;
  settings: OrganizationSettings;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
}

export interface Membership {
  uid: string;
  orgId: string;
  role: Role;
  status: AccountStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  orgId: string;
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  role: Role;
  status: AccountStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
  lastLoginAt?: TimestampLike | null;
}

export interface Client {
  id: string;
  orgId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  category: string;
  notes: string;
  status: ClientStatus;
  geo: GeoPointLike | null;
  assignedUserIds: string[];
  createdBy: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  lastVisitAt?: TimestampLike | null;
  nextFollowupAt?: TimestampLike | null;
}

export interface ClientAssignment {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  userId: string;
  userName: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: TimestampLike;
  endedBy?: string | null;
  endedAt?: TimestampLike | null;
  endReason?: string | null;
}

export interface VisitReport {
  summary: string;
  outcome: VisitOutcome;
  activities: string[];
  productsDiscussed: string;
  competitorInfo: string;
  customerFeedback: string;
  nextAction: string;
  followupRequired: boolean;
  followupDate: string | null;
}

export interface Visit {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  clientAddress: string;
  clientCity: string;
  userId: string;
  userName: string;
  origin: VisitOrigin;
  status: VisitStatus;
  scheduledFor: TimestampLike | null;
  scheduledBy: string | null;
  checkIn: GeoCapture | null;
  checkOut: GeoCapture | null;
  report: VisitReport | null;
  photoCount: number;
  revisionCount: number;
  submittedAt: TimestampLike | null;
  approvedAt: TimestampLike | null;
  approvedBy: string | null;
  returnedAt: TimestampLike | null;
  returnedBy: string | null;
  returnReason: string;
  cancelledAt: TimestampLike | null;
  cancelledBy: string | null;
  cancelReason: string;
  createdAt: TimestampLike;
  createdBy: string;
  updatedAt: TimestampLike;
}

export interface VisitPhoto {
  id: string;
  orgId: string;
  visitId: string;
  contentType: string;
  data: string;
  sizeBytes: number;
  caption: string;
  uploadedBy: string;
  createdAt: TimestampLike;
}

export interface VisitRevision {
  id: string;
  orgId: string;
  visitId: string;
  revisionNumber: number;
  previousReport: VisitReport | null;
  newReport: VisitReport;
  returnReason: string;
  editedBy: string;
  createdAt: TimestampLike;
}

export interface Followup {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  userId: string;
  userName: string;
  visitId: string | null;
  title: string;
  notes: string;
  dueDate: string;
  status: FollowupStatus;
  completedAt: TimestampLike | null;
  completedBy: string | null;
  completionNote: string;
  createdAt: TimestampLike;
  createdBy: string;
  updatedAt: TimestampLike;
}

export interface AppNotification {
  id: string;
  orgId: string;
  recipientUid: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: EntityType | null;
  entityId: string | null;
  readAt: TimestampLike | null;
  createdAt: TimestampLike;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  orgId: string;
  actorId: string;
  actorRole: Role;
  action: AuditAction;
  entityType: EntityType;
  entityId: string;
  summary: string;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: TimestampLike;
}

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  timezone: "Asia/Kolkata",
  currency: "INR",
  gpsAccuracyThresholdMeters: 100,
  photoMaxPerVisit: 5,
  photoMaxBytes: 300_000,
  visitReminderLeadMinutes: 60,
  workdayStart: "09:00",
  workdayEnd: "18:00",
};
