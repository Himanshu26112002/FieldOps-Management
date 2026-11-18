import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { connectAuthEmulator, getAuth, getReactNativePersistence, initializeAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { Platform } from "react-native";
import { EMULATOR_PORTS, EMULATOR_PROJECT_ID } from "@fieldops/shared-types";

export interface MobileFirebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  orgId: string;
  emulator: boolean;
}

const useEmulators = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS === "true";

function emulatorHost(): string {
  const configured = process.env.EXPO_PUBLIC_EMULATOR_HOST?.trim();
  if (configured) return configured;
  if (Platform.OS === "android") return "10.0.2.2";
  return "localhost";
}

function config() {
  if (useEmulators) {
    return {
      apiKey: "demo-api-key",
      authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
      projectId: EMULATOR_PROJECT_ID,
      appId: "demo-app-id",
      messagingSenderId: "0",
    };
  }
  const firebase = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  };
  const missing = Object.entries(firebase)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Firebase is not configured. Missing EXPO_PUBLIC_ values: ${missing.join(", ")}.`);
  }
  return firebase;
}

/**
 * On native, getAuth() falls back to in-memory persistence, which signs the user out on every
 * restart. The React Native build of @firebase/auth (picked by Metro's "react-native" condition)
 * exports getReactNativePersistence, so persist the session in AsyncStorage. Web keeps getAuth().
 */
function createAuth(app: FirebaseApp): Auth {
  if (Platform.OS === "web") return getAuth(app);
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Already initialized (e.g. after a fast refresh): reuse the existing instance.
    return getAuth(app);
  }
}

let cached: MobileFirebase | undefined;

export function getFirebase(): MobileFirebase {
  if (cached) return cached;
  const firebaseConfig = config();
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  const auth = createAuth(app);
  const db = getFirestore(app);

  if (useEmulators && !(globalThis as { __fieldopsEmulatorsConnected?: boolean }).__fieldopsEmulatorsConnected) {
    const host = emulatorHost();
    connectAuthEmulator(auth, `http://${host}:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, EMULATOR_PORTS.firestore);
    (globalThis as { __fieldopsEmulatorsConnected?: boolean }).__fieldopsEmulatorsConnected = true;
  }

  const orgId = process.env.EXPO_PUBLIC_FIELDOPS_ORG_ID?.trim() || "main";
  cached = { app, auth, db, orgId, emulator: useEmulators };
  return cached;
}
