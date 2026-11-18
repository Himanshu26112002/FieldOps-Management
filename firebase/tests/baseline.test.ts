import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Runs inside `npm run test:rules`, which starts the Firestore emulator and sets FIRESTORE_EMULATOR_HOST.
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-fieldops",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("baseline deny-all rules (M1)", () => {
  it("S1: unauthenticated read is denied", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "memberships/anyone")));
  });

  it("S1: unauthenticated write is denied", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(db, "organizations/main"), { name: "x" }));
  });

  it("S3: a signed-in user cannot create their own ADMIN membership", async () => {
    const db = env.authenticatedContext("user-a").firestore();
    await assertFails(setDoc(doc(db, "memberships/user-a"), { orgId: "main", role: "ADMIN", status: "ACTIVE" }));
  });
});
