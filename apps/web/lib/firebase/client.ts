import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { EMULATOR_PORTS } from "@fieldops/shared-types";
import { loadConfig, useEmulators } from "./config";

export interface FirebaseClients {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  orgId: string;
}

let clients: FirebaseClients | undefined;

/**
 * Single entry point for Firebase in the web app. Browser-only: call from client components.
 * Throws with every configuration problem listed if the environment is incomplete.
 */
export function getFirebase(): FirebaseClients {
  if (clients) return clients;
  if (typeof window === "undefined") {
    throw new Error("getFirebase() must only be called in the browser");
  }

  const config = loadConfig();
  if (!config.ok) {
    throw new Error(`Firebase configuration is incomplete:\n- ${config.errors.join("\n- ")}`);
  }

  // Reuse the default app across hot reloads instead of initializing a second one.
  const app = getApps().length > 0 ? getApp() : initializeApp(config.firebase);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (useEmulators) {
    const host = window.location.hostname;
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore);
  }

  clients = { app, auth, db, orgId: config.orgId };
  return clients;
}

let secondaryAuth: Auth | undefined;

/**
 * A second Firebase app used only to create accounts without replacing the
 * administrator's session (PRODUCT_REQUIREMENTS.md D8).
 */
export function getSecondaryAuth(): Auth {
  if (secondaryAuth) return secondaryAuth;
  if (typeof window === "undefined") {
    throw new Error("getSecondaryAuth() must only be called in the browser");
  }

  const config = loadConfig();
  if (!config.ok) {
    throw new Error(`Firebase configuration is incomplete:\n- ${config.errors.join("\n- ")}`);
  }

  const name = "fieldops-provisioning";
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp(config.firebase, name);
  const auth = getAuth(app);

  if (useEmulators) {
    const host = window.location.hostname;
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  }

  secondaryAuth = auth;
  return auth;
}
