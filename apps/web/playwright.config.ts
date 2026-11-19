import { defineConfig, devices } from "@playwright/test";

// End-to-end tests for both websites, run against the Firebase Emulator Suite only.
// Start the emulators first (repo root): npx firebase emulators:start --only auth,firestore --project demo-fieldops
// globalSetup wipes and re-seeds the emulators; every test aborts and fails on any request to a real Firebase backend.
// Uses the locally installed Microsoft Edge so no browser download is required; set PW_CHANNEL to override.

const ADMIN_PORT = 3000;
const SALES_PORT = 8081;

// Process env overrides .env/.env.local, so these force both apps onto the emulators whatever the local files say.
const webEnv = {
  NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  NEXT_PUBLIC_FIELDOPS_ORG_ID: "main",
};
const salesEnv = {
  EXPO_PUBLIC_USE_FIREBASE_EMULATORS: "true",
  EXPO_PUBLIC_EMULATOR_HOST: "localhost",
  EXPO_PUBLIC_FIELDOPS_ORG_ID: "main",
  CI: "1",
  BROWSER: "none",
};

const channel = process.env.PW_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Tests share one emulator database, so they run one at a time in file order.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "admin-site",
      testMatch: /admin\..*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel, baseURL: `http://localhost:${ADMIN_PORT}` },
    },
    {
      name: "sales-site",
      testMatch: /sales\..*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], channel, baseURL: `http://localhost:${SALES_PORT}` },
    },
    {
      // Flows that hand work between the two sites (salesperson submits, admin reviews, ...).
      name: "cross-site",
      testMatch: /cross\..*\.spec\.ts/,
      dependencies: ["admin-site", "sales-site"],
      use: { ...devices["Desktop Chrome"], channel, baseURL: `http://localhost:${ADMIN_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${ADMIN_PORT}`,
      url: `http://localhost:${ADMIN_PORT}/login`,
      env: webEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx expo start --web --port ${SALES_PORT}`,
      cwd: "../mobile",
      url: `http://localhost:${SALES_PORT}`,
      env: salesEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
