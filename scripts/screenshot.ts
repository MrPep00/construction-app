/** Screenshots a route (optionally after driving the UI) at 360px and
 *  1280px in both themes, so agent sessions can actually verify the
 *  interactive UI they build — CLAUDE.md pt 17.
 *
 *  Requires the dev server running (pnpm dev) and E2E_EMAIL / E2E_PASSWORD
 *  in .env.local; the Supabase session is cached by scripts/e2e/auth-state.ts.
 *
 *  Usage:
 *    pnpm tsx scripts/screenshot.ts --route /projects/<id>/floors/1 \
 *      --name unit-dialog \
 *      --click "button:has-text('Dodaj lokal')" \
 *      --fill "#unit-name=Węzeł cieplny" \
 *      --wait 300
 *
 *  Options:
 *    --route <path>        required, app-relative
 *    --name <slug>         output prefix (default: derived from the route)
 *    --click <selector>    repeatable, applied in order
 *    --fill <sel=value>    repeatable, applied in order with the clicks
 *    --wait <ms>           extra settle time after the actions (default 250)
 *    --width <px>          repeatable, overrides the 360/1280 defaults
 *    --theme <light|dark>  repeatable, overrides both-themes default
 *    --full                full-page instead of viewport screenshot
 *
 *  Writes .screenshots/<name>-<theme>-<width>.png and prints each path.
 */

import fs from "node:fs"
import path from "node:path"
import { chromium, type Page } from "@playwright/test"
import {
  AUTH_STATE_PATH,
  BASE_URL,
  SCREENSHOT_DIR,
  ensureStorageState,
} from "./e2e/auth-state"

type Action = { kind: "click" | "fill"; selector: string; value?: string }

type Options = {
  route: string
  name: string
  actions: Action[]
  wait: number
  widths: number[]
  themes: ("light" | "dark")[]
  fullPage: boolean
}

function parseArgs(argv: string[]): Options {
  const actions: Action[] = []
  const widths: number[] = []
  const themes: ("light" | "dark")[] = []
  let route = ""
  let name = ""
  let wait = 250
  let fullPage = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`Brak wartości dla ${arg}`)
      return value
    }
    switch (arg) {
      case "--route":
        route = next()
        break
      case "--name":
        name = next()
        break
      case "--click":
        actions.push({ kind: "click", selector: next() })
        break
      case "--fill": {
        const raw = next()
        const eq = raw.indexOf("=")
        if (eq === -1) throw new Error(`--fill oczekuje "selektor=wartość"`)
        actions.push({
          kind: "fill",
          selector: raw.slice(0, eq),
          value: raw.slice(eq + 1),
        })
        break
      }
      case "--wait":
        wait = Number(next())
        break
      case "--width":
        widths.push(Number(next()))
        break
      case "--theme": {
        const value = next()
        if (value !== "light" && value !== "dark") {
          throw new Error("--theme przyjmuje light albo dark")
        }
        themes.push(value)
        break
      }
      case "--full":
        fullPage = true
        break
      default:
        throw new Error(`Nieznany argument: ${arg}`)
    }
  }

  if (!route) throw new Error("--route jest wymagany")
  // Git Bash rewrites a leading "/" into a Windows path, so routes may arrive
  // bare ("projects/x") — normalise instead of failing on it.
  if (!route.startsWith("/")) route = `/${route}`
  if (!name) {
    name = route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "page"
  }

  return {
    route,
    name,
    actions,
    wait,
    widths: widths.length > 0 ? widths : [360, 1280],
    themes: themes.length > 0 ? themes : ["light", "dark"],
    fullPage,
  }
}

async function runActions(page: Page, actions: Action[]) {
  for (const action of actions) {
    const locator = page.locator(action.selector).first()
    await locator.waitFor({ state: "visible", timeout: 15_000 })
    if (action.kind === "click") await locator.click()
    else await locator.fill(action.value ?? "")
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  await ensureStorageState()
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const written: string[] = []

  try {
    for (const theme of options.themes) {
      for (const width of options.widths) {
        const context = await browser.newContext({
          storageState: AUTH_STATE_PATH,
          viewport: { width, height: width < 500 ? 780 : 900 },
          colorScheme: theme,
          deviceScaleFactor: 2,
        })
        // next-themes reads localStorage("theme"); colorScheme alone would
        // only cover the "system" case.
        await context.addInitScript(
          (value) => window.localStorage.setItem("theme", value),
          theme
        )

        const page = await context.newPage()
        const response = await page.goto(
          new URL(options.route, BASE_URL).toString(),
          { waitUntil: "networkidle" }
        )
        if (response && response.status() >= 400) {
          throw new Error(
            `${options.route} zwróciło ${response.status()} — zalogowany? dev server działa?`
          )
        }
        if (new URL(page.url()).pathname.startsWith("/login")) {
          throw new Error(
            "Przekierowano na /login — sesja nieważna. Usuń .screenshots/.auth.json i spróbuj ponownie."
          )
        }

        await runActions(page, options.actions)
        await page.waitForTimeout(options.wait)

        const file = path.join(
          SCREENSHOT_DIR,
          `${options.name}-${theme}-${width}.png`
        )
        await page.screenshot({ path: file, fullPage: options.fullPage })
        written.push(file)
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  for (const file of written) console.log(path.relative(process.cwd(), file))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
