import { doc, getDoc } from "firebase/firestore";
import type { Membership, Organization, Role, UserProfile } from "@fieldops/shared-types";
import { getFirebase } from "./firebase/client";

export const NOT_PROVISIONED_MESSAGE = "Your account is not provisioned or has been deactivated. Contact your administrator.";
/** sessionStorage key carrying why the user was signed out, shown once on /login. */
export const LOGIN_REASON_KEY = "fieldops.loginReason";
export const ADMIN_ONLY_MESSAGE = "This dashboard is for administrators. Salespeople should use the FieldOps mobile app.";

export interface Session {
  uid: string;
  role: Role;
  membership: Membership;
  profile: UserProfile;
  organization: Organization;
}

export async function fetchMyProfile(): Promise<Session> {
  const { db, auth, orgId } = getFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");

  // Rules deny reading a missing or inactive membership, which surfaces as permission-denied.
  const membershipSnap = await getDoc(doc(db, "memberships", user.uid)).catch((error: unknown) => {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    throw code === "permission-denied" ? new Error(NOT_PROVISIONED_MESSAGE) : error;
  });
  if (!membershipSnap.exists()) {
    throw new Error(NOT_PROVISIONED_MESSAGE);
  }
  const membership = { uid: user.uid, ...membershipSnap.data() } as Membership;
  if (membership.status !== "ACTIVE") {
    throw new Error("Your account has been deactivated. Contact your administrator.");
  }
  if (membership.orgId !== orgId) {
    throw new Error("Your account belongs to a different organization.");
  }
  if (membership.role !== "ADMIN") {
    throw new Error(ADMIN_ONLY_MESSAGE);
  }

  const [profileSnap, orgSnap] = await Promise.all([
    getDoc(doc(db, `organizations/${orgId}/users/${user.uid}`)),
    getDoc(doc(db, `organizations/${orgId}`)),
  ]);
  if (!profileSnap.exists()) throw new Error("Your profile document is missing.");
  if (!orgSnap.exists()) throw new Error("The organization document is missing.");

  return {
    uid: user.uid,
    role: membership.role,
    membership,
    profile: { id: profileSnap.id, ...profileSnap.data() } as unknown as UserProfile,
    organization: { id: orgSnap.id, ...orgSnap.data() } as Organization,
  };
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check the emulator or your connection.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Choose a stronger password.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled for this project.";
    default:
      if (code.startsWith("auth/")) return "Authentication failed. Try again.";
      return error instanceof Error ? error.message : "Something went wrong.";
  }
}
