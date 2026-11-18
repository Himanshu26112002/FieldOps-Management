import { EMULATOR_PROJECT_ID } from "@fieldops/shared-types";
import { envFlag, firebaseWebConfigSchema, orgIdSchema, type FirebaseWebConfig } from "@fieldops/shared-validation";

// Next.js inlines NEXT_PUBLIC_* only when accessed statically, so each variable is read by name.
export const useEmulators = envFlag(process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS);

export type ConfigResult =
  | { ok: true; firebase: FirebaseWebConfig; orgId: string }
  | { ok: false; errors: string[] };

export function loadConfig(): ConfigResult {
  // The emulators accept any API key; a "demo-" project ID guarantees nothing reaches real cloud resources.
  const firebase = useEmulators
    ? {
        apiKey: "demo-api-key",
        authDomain: `${EMULATOR_PROJECT_ID}.firebaseapp.com`,
        projectId: EMULATOR_PROJECT_ID,
        appId: "demo-app-id",
        messagingSenderId: "0",
      }
    : {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
      };

  const parsedFirebase = firebaseWebConfigSchema.safeParse(firebase);
  const parsedOrg = orgIdSchema.safeParse(process.env.NEXT_PUBLIC_FIELDOPS_ORG_ID ?? "");

  const errors = [
    ...(parsedFirebase.success ? [] : parsedFirebase.error.issues.map((i) => i.message)),
    ...(parsedOrg.success ? [] : [`NEXT_PUBLIC_FIELDOPS_ORG_ID: ${parsedOrg.error.issues[0]?.message ?? "invalid"}`]),
  ];
  if (!parsedFirebase.success || !parsedOrg.success) return { ok: false, errors };

  return { ok: true, firebase: parsedFirebase.data, orgId: parsedOrg.data };
}
