import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();
const firebaseCli = resolve(root, "node_modules/firebase-tools/lib/bin/firebase.js");
const vitestCli = resolve(root, "node_modules/vitest/vitest.mjs");
const testCommand = `"${process.execPath}" "${vitestCli}" run --root firebase/tests`;

const child = spawn(
  process.execPath,
  [
    firebaseCli,
    "emulators:exec",
    "--config",
    "firebase.test.json",
    "--project",
    "demo-fieldops",
    "--only",
    "firestore",
    testCommand,
  ],
  {
    cwd: root,
    env: { ...process.env, CI: process.env.CI || "true" },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Could not start the Firebase Emulator Suite:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Firebase Emulator Suite stopped by ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
