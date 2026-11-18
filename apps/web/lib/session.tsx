"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { getFirebase } from "./firebase/client";
import { fetchMyProfile, LOGIN_REASON_KEY, type Session } from "./auth";
import { friendlyError, isTransientError } from "./errors";

interface SessionContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const next = await fetchMyProfile();
      setSession(next);
      setError(null);
    } catch (cause) {
      const reason = friendlyError(cause, "Could not load your workspace.");
      // A network blip keeps the admin signed in (and any loaded session); only definite failures sign out.
      if (isTransientError(cause)) {
        setError(reason);
        return;
      }
      setSession(null);
      setError(null);
      try {
        sessionStorage.setItem(LOGIN_REASON_KEY, reason);
      } catch {
        // Storage unavailable (private mode); the login page simply shows no reason.
      }
      const { auth } = getFirebase();
      await auth.signOut().catch(() => {});
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const { auth } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setSession(null);
        setError(null);
        setLoading(false);
        router.replace("/login");
        return;
      }
      setLoading(true);
      void load();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <SessionContext.Provider value={{ session, loading, error, refresh: load }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
