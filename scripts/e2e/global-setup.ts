/** Playwright global setup: makes sure the cached Supabase session exists
 *  before any test runs. See scripts/e2e/auth-state.ts. */

import { ensureStorageState } from "./auth-state"

export default async function globalSetup() {
  await ensureStorageState()
}
