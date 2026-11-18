import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Membership, Organization, Role, UserProfile } from "@fieldops/shared-types";
import { getFirebase } from "./firebase";
import { clearCache } from "./cache";
import { errorCode, isNetworkError, withTimeout } from "./network";

export interface MobileSession {
  uid: string;
  role: Role;
  email: string;
  membership: Membership;
  profile: UserProfile;
  organization: Organization;
}

interface SessionContextValue {
  session: MobileSession | null;
  /** Initial account load (no session yet). Screens may swap to a spinner. */
  loading: boolean;
  /** Background refresh of an existing session; navigators must stay mounted. */
  refreshing: boolean;
  /** Signed in with Firebase, but the account could not be loaded because of a connection problem. */
  offline: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const NOT_PROVISIONED = "Your account is not provisioned or has been deactivated. Contact your administrator.";
const CONNECTION_PROBLEM = "Could not reach the server to load your account. Check your connection and retry.";

/** A failure that will not fix itself by retrying: the user must be signed out. */
class AccessDenied extends Error {}

async function load(user: User, orgId: string): Promise<MobileSession> {
  const { db } = getFirebase();
  const membershipSnap = await withTimeout(getDoc(doc(db, "memberships", user.uid))).catch((cause: unknown) => {
    throw errorCode(cause).endsWith("permission-denied") ? new AccessDenied(NOT_PROVISIONED) : cause;
  });
  if (!membershipSnap.exists()) throw new AccessDenied("Your account is not provisioned. Contact your administrator.");
  const membership = { uid: user.uid, ...membershipSnap.data() } as Membership;
  if (membership.status !== "ACTIVE") throw new AccessDenied("Your account has been deactivated. Contact your administrator.");
  if (membership.orgId !== orgId) throw new AccessDenied("Your account belongs to a different organization.");
  if (membership.role !== "USER") throw new AccessDenied("Administrator accounts use the web dashboard.");

  const [profileSnap, orgSnap] = await withTimeout(Promise.all([
    getDoc(doc(db, `organizations/${orgId}/users/${user.uid}`)),
    getDoc(doc(db, `organizations/${orgId}`)),
  ]));
  if (!profileSnap.exists()) throw new AccessDenied("Your profile document is missing. Contact your administrator.");
  if (!orgSnap.exists()) throw new AccessDenied("The organization document is missing.");

  return {
    uid: user.uid,
    role: membership.role,
    email: user.email ?? "",
    membership,
    profile: { id: profileSnap.id, ...profileSnap.data() } as unknown as UserProfile,
    organization: { id: orgSnap.id, ...orgSnap.data() } as Organization,
  };
}

function denialMessage(cause: unknown): string | null {
  if (cause instanceof AccessDenied) return cause.message;
  if (errorCode(cause).endsWith("permission-denied")) return NOT_PROVISIONED;
  return null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<MobileSession | null>(null);

  const apply = useCallback((next: MobileSession | null) => {
    current.current = next;
    setSession(next);
  }, []);

  const refresh = useCallback(async () => {
    const { auth, orgId } = getFirebase();
    const user = auth.currentUser;
    if (!user) {
      apply(null);
      setOffline(false);
      setLoading(false);
      return;
    }
    const background = current.current?.uid === user.uid;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      apply(await load(user, orgId));
      setError(null);
      setOffline(false);
    } catch (cause) {
      const denied = denialMessage(cause);
      if (denied) {
        apply(null);
        setOffline(false);
        setError(denied);
        await signOut(auth).catch(() => {});
        await clearCache().catch(() => {});
      } else {
        // Connection problems keep the user signed in; an existing session stays usable.
        setError(isNetworkError(cause) ? CONNECTION_PROBLEM : cause instanceof Error ? cause.message : "Could not load your account.");
        if (!background) {
          apply(null);
          setOffline(true);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apply]);

  useEffect(() => {
    const { auth } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        apply(null);
        setOffline(false);
        setLoading(false);
        return;
      }
      void refresh();
    });
    return unsubscribe;
  }, [apply, refresh]);

  const logout = useCallback(async () => {
    const { auth } = getFirebase();
    await signOut(auth);
    await clearCache();
    apply(null);
    setOffline(false);
    setError(null);
  }, [apply]);

  const value = useMemo(
    () => ({ session, loading, refreshing, offline, error, refresh, logout }),
    [session, loading, refreshing, offline, error, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
