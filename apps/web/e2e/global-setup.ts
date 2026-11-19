import { execFileSync } from "node:child_process";
import path from "node:path";

// Only ever talks to the local emulators of the demo project; a "demo-" project never reaches real Firebase.
export const PROJECT_ID = "demo-fieldops";
const FIRESTORE = "http://127.0.0.1:8080";
const AUTH = "http://127.0.0.1:9099";

async function ensureUp(url: string, name: string) {
  try {
    await fetch(url);
  } catch {
    throw new Error(
      `${name} emulator is not reachable at ${url}. Start it first: npx firebase emulators:start --only auth,firestore --project ${PROJECT_ID}`,
    );
  }
}

export default async function globalSetup() {
  await ensureUp(FIRESTORE, "Firestore");
  await ensureUp(AUTH, "Auth");

  // Wipe everything (including accounts created by earlier runs), then seed the demo organization.
  await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });

  const root = path.resolve(__dirname, "../../..");
  execFileSync(process.execPath, ["scripts/development/seed-emulators.mjs"], {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      GCLOUD_PROJECT: PROJECT_ID,
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    },
  });
}
