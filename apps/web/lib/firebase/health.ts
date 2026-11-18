import { FirebaseError } from "firebase/app";
import { doc, getDocFromServer } from "firebase/firestore";
import { getFirebase } from "./client";

export type HealthResult =
  | { state: "ok"; detail: string }
  | { state: "warning"; detail: string }
  | { state: "error"; detail: string };

const TIMEOUT_MS = 10_000;

/**
 * Proves the app can reach Firestore and that Security Rules are enforced:
 * an unauthenticated read of a membership document must be rejected with permission-denied.
 */
export async function checkFirestore(): Promise<HealthResult> {
  let firebase;
  try {
    firebase = getFirebase();
  } catch (e) {
    return { state: "error", detail: e instanceof Error ? e.message : String(e) };
  }

  // Document IDs matching __.*__ are reserved by Firestore, so the probe uses a plain ID.
  const probe = getDocFromServer(doc(firebase.db, "memberships", "health-probe"));
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), TIMEOUT_MS));

  try {
    const result = await Promise.race([probe, timeout]);
    if (result === "timeout") {
      return { state: "error", detail: `No response from Firestore within ${TIMEOUT_MS / 1000}s.` };
    }
    return {
      state: "warning",
      detail: "Firestore is reachable, but an unauthenticated read was ALLOWED. Security Rules are not enforced.",
    };
  } catch (e) {
    if (e instanceof FirebaseError && e.code === "permission-denied") {
      return { state: "ok", detail: "Reachable; unauthenticated read correctly denied by Security Rules." };
    }
    const code = e instanceof FirebaseError ? e.code : "unknown";
    return { state: "error", detail: `Firestore request failed (${code}).` };
  }
}
