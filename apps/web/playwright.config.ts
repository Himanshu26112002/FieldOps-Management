import { defineConfig } from "@playwright/test";

// End-to-end tests run against the Firebase Emulator Suite (start it with `npm run emulators` at the repo root).
// Uses the locally installed Microsoft Edge so no browser download is required; set PW_CHANNEL to override.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.PW_CHANNEL ?? "msedge",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
