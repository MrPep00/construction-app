import { defineConfig, devices } from "@playwright/test"
import { AUTH_STATE_PATH, BASE_URL } from "./scripts/e2e/auth-state"

/** Chromium only — firefox/webkit are not worth the CI weight here.
 *  Every test starts signed in as the E2E user (global setup writes the
 *  storage state; see scripts/e2e/auth-state.ts). */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./scripts/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    storageState: AUTH_STATE_PATH,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
