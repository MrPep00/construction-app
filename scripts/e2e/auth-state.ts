/** Signs the E2E user into Supabase and caches the resulting cookies as a
 *  Playwright storage state, so screenshot runs (and future tests) start
 *  authenticated.
 *
 *  The app stores its session in cookies written by @supabase/ssr. Rather
 *  than reproducing that cookie format by hand, this uses the very same
 *  library with an in-memory cookie jar: whatever the server client writes
 *  on sign-in is exactly what the app reads back.
 *
 *  Credentials come from E2E_EMAIL / E2E_PASSWORD in .env.local and are
 *  never printed or committed. */

import fs from "node:fs"
import path from "node:path"
import { config as loadEnv } from "dotenv"
import { createServerClient } from "@supabase/ssr"

loadEnv({ path: path.join(process.cwd(), ".env.local") })

export const SCREENSHOT_DIR = path.join(process.cwd(), ".screenshots")
export const AUTH_STATE_PATH = path.join(SCREENSHOT_DIR, ".auth.json")
export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

/** Supabase access tokens live an hour; re-sign well before that. */
const MAX_STATE_AGE_MS = 30 * 60 * 1000

type StoredCookie = {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly: boolean
  secure: boolean
  sameSite: "Lax" | "Strict" | "None"
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Brak ${name} — ustaw je w .env.local (nie commitujemy tych wartości).`
    )
  }
  return value
}

function isPasswordAuthDisabled(message: string): boolean {
  return /disabled|not enabled|unsupported|provider/i.test(message)
}

export async function signInAndSaveState(): Promise<string> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  const email = requireEnv("E2E_EMAIL")
  const password = requireEnv("E2E_PASSWORD")

  const jar = new Map<string, { name: string; value: string }>()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar.values()],
      setAll: (cookies) => {
        for (const cookie of cookies) {
          jar.set(cookie.name, { name: cookie.name, value: cookie.value })
        }
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (isPasswordAuthDisabled(error.message)) {
      throw new Error(
        `Logowanie hasłem odrzucone przez Supabase ("${error.message}").\n` +
          "Włącz je w dashboardzie: Authentication → Sign In / Providers → " +
          "Email → Password authentication (i upewnij się, że użytkownik " +
          "testowy ma ustawione hasło). Nie obchodzimy tego skryptem."
      )
    }
    throw new Error(`Logowanie nie powiodło się: ${error.message}`)
  }

  if (jar.size === 0) {
    throw new Error(
      "Supabase nie zapisał żadnych ciasteczek sesji — sprawdź wersję @supabase/ssr."
    )
  }

  const host = new URL(BASE_URL).hostname
  const cookies: StoredCookie[] = [...jar.values()].map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: host,
    path: "/",
    // Session cookie: Playwright keeps it for the lifetime of the context
    expires: -1,
    httpOnly: false,
    secure: BASE_URL.startsWith("https://"),
    sameSite: "Lax",
  }))

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  fs.writeFileSync(
    AUTH_STATE_PATH,
    JSON.stringify({ cookies, origins: [] }, null, 2),
    "utf-8"
  )
  return AUTH_STATE_PATH
}

/** Returns the storage-state path, signing in only when the cached state is
 *  missing or stale. */
export async function ensureStorageState(): Promise<string> {
  try {
    const stat = fs.statSync(AUTH_STATE_PATH)
    if (Date.now() - stat.mtimeMs < MAX_STATE_AGE_MS) return AUTH_STATE_PATH
  } catch {
    // no cached state yet
  }
  return signInAndSaveState()
}
