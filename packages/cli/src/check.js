// `halation check <url>`: the rendered check, run on a real page in a
// headless browser. It needs playwright-core, an optional peer.

import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

/** The checker as a plain script: check.js with its `export` keywords removed. */
export function checkerSource() {
  const entry = fileURLToPath(import.meta.resolve("@halation/core/check"))
  const file = path.join(path.dirname(entry), "check.js")
  return readFileSync(file, "utf8").replace(/^export\s+/gm, "")
}

/** A browsable URL from what was typed: a URL, a host and port, or a local file. */
export function toUrl(input, cwd = process.cwd()) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) || input.startsWith("file:") || input.startsWith("data:")) return input
  const local = path.resolve(cwd, input)
  if (existsSync(local)) return pathToFileURL(local).href
  return `http://${input}`
}

async function loadPlaywright(cwd) {
  const pick = (mod) => mod?.chromium ?? mod?.default?.chromium
  try {
    const found = pick(await import("playwright-core"))
    if (found) return found
  } catch {}
  try {
    const resolved = createRequire(path.join(cwd, "package.json")).resolve("playwright-core")
    return pick(await import(pathToFileURL(resolved).href)) ?? null
  } catch {
    return null
  }
}

async function launch(chromium) {
  // The checker doesn't announce itself: a page can't tell it from a visitor and show it something else.
  const args = ["--disable-blink-features=AutomationControlled"]
  try {
    return await chromium.launch({ channel: "chrome", args })
  } catch (first) {
    try {
      return await chromium.launch({ args })
    } catch {
      throw new Error(`Couldn't start a browser (${String(first.message).split("\n")[0]}). Install Google Chrome, or run npx playwright-core install chromium, and try again.`)
    }
  }
}

const HIDE_AUTOMATION = `Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false, configurable: true })`
const WIDTHS = [1280, 375]
const EMPTY = 5

/** Waits until the page stops changing: no new nodes or attributes for 400 ms, five seconds at most. */
const QUIET = `new Promise((done) => {
  let timer = setTimeout(finish, 400)
  const limit = setTimeout(finish, 5000)
  const watch = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(finish, 400)
  })
  watch.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  function finish() {
    watch.disconnect()
    clearTimeout(limit)
    done()
  }
})`

/** Lets the app render, scrolls end to end so late and lazy content is there, then settles. */
async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  await page.evaluate(QUIET)
  await page.evaluate(async () => {
    const step = Math.max(200, innerHeight * 0.8)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo({ top: y, behavior: "instant" })
      await new Promise((r) => setTimeout(r, 80))
    }
    scrollTo({ top: 0, behavior: "instant" })
  })
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  await page.evaluate(QUIET)
  await page.waitForTimeout(1_200)
}

/**
 * Loads `url` in each color scheme at a desktop and a phone width, and runs the
 * checker on the page and every same-origin frame in it. Returns
 * { url, runs: [{ mode, width, rules, budgets, exempted, elements, errors }], pass }.
 * Options: counterexamples lets [data-counterexample] break the rules, for a
 * design system's own docs showing what not to do.
 */
export async function checkUrl(url, { modes = ["light", "dark"], widths = WIDTHS, counterexamples = false, cwd = process.cwd() } = {}) {
  const chromium = await loadPlaywright(cwd)
  if (!chromium) {
    const err = new Error("Halation check drives a headless browser through playwright-core, which isn't installed: run npm install -D playwright-core (or pnpm add -D playwright-core) and try again.")
    err.missing = true
    throw err
  }
  const script = `(() => {\n${checkerSource()}\nreturn check(document.body, ${JSON.stringify({ counterexamples })})\n})()`
  const browser = await launch(chromium)
  const userAgent = (await browser.newPage().then(async (p) => { const ua = await p.evaluate(() => navigator.userAgent); await p.close(); return ua })).replace(/Headless/g, "")
  const runs = []
  try {
    for (const colorScheme of modes) {
      for (const width of widths) {
        const context = await browser.newContext({ colorScheme, bypassCSP: true, userAgent, viewport: { width, height: width < 600 ? 812 : 800 } })
        await context.addInitScript(HIDE_AUTOMATION)
        const page = await context.newPage()
        const errors = []
        page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]))
        try {
          await page.goto(url, { waitUntil: "load", timeout: 30_000 })
        } catch (e) {
          await browser.close()
          throw new Error(`Couldn't load ${url} (${String(e.message).split("\n")[0]}). Check the address, and that the server is running.`)
        }
        await settle(page)
        const result = await page.evaluate(script)
        // Frames are checked too, and their findings added to the page's.
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue
          const inner = await frame.evaluate(script).catch(() => null)
          if (!inner) continue
          for (const rule of result.rules) {
            const other = inner.rules.find((x) => x.id === rule.id)
            if (!other || other.pass) continue
            rule.pass = false
            rule.count += other.count
            rule.examples = [...rule.examples, ...other.examples.map((e) => `iframe ${e}`)].slice(0, 5)
          }
          result.elements += inner.elements
        }
        runs.push({ mode: colorScheme, width, ...result, errors })
        await context.close()
      }
    }
  } finally {
    await browser.close().catch(() => {})
  }
  const pass = runs.every((r) => r.rules.every((x) => x.pass) && r.budgets.every((b) => b.pass) && !r.errors.length && r.elements >= EMPTY)
  return { url, runs, pass }
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const where = (run) => `${run.mode} mode at ${run.width} px`

/** The readable report. */
export function formatCheck({ url, runs, pass }) {
  const out = [`Checked ${url} in ${[...new Set(runs.map((r) => r.mode))].join(" and ")} mode, at ${[...new Set(runs.map((r) => r.width))].map((w) => `${w} px`).join(" and ")}.`, ""]
  const problems = []
  for (const run of runs) {
    if (run.elements < EMPTY) problems.push(`In ${where(run)}, the page rendered almost nothing (${plural(run.elements, "visible element")}). A blank or crashed page doesn't pass.`)
    for (const e of [...new Set(run.errors)]) problems.push(`In ${where(run)}, the page threw an error: ${e}`)
  }
  if (problems.length) out.push("Problems", ...problems.map((p) => `  ${p}`), "")
  const ids = runs[0].rules.map((r) => r.id)
  const broken = ids.filter((id) => runs.some((run) => !run.rules.find((r) => r.id === id).pass))
  if (broken.length) {
    out.push("Broken")
    for (const id of broken) {
      const per = runs.map((run) => [run, run.rules.find((r) => r.id === id)])
      out.push(`  ${id.padEnd(4)} ${per[0][1].says}`)
      const failing = per.filter(([, r]) => !r.pass)
      const first = failing[0][1]
      if (failing.length === runs.length && failing.every(([, r]) => same(r.examples, first.examples) && r.count === first.count)) {
        out.push(`       Everywhere, ${plural(first.count, "element")}: ${first.examples.join(", ")}${first.count > first.examples.length ? ", and more" : ""}`)
      } else {
        for (const [run, r] of failing) out.push(`       In ${where(run)}, ${plural(r.count, "element")}: ${r.examples.join(", ")}${r.count > r.examples.length ? ", and more" : ""}`)
      }
    }
    out.push("")
  }
  const kept = runs[0].rules.filter((r) => !broken.includes(r.id))
  if (kept.length) {
    out.push("Kept")
    for (const r of kept) out.push(`  ${r.id.padEnd(4)} ${r.says}`)
    out.push("")
  }
  out.push("Budgets")
  for (const b of runs[0].budgets) {
    const per = runs.map((run) => run.budgets.find((x) => x.name === b.name))
    const unit = /share/i.test(b.name) ? "%" : ""
    const worst = per.reduce((m, x) => (x.value > m.value ? x : m), per[0])
    const over = per.some((x) => !x.pass)
    out.push(`  ${b.name}: ${worst.value}${unit} at most, limit ${b.limit}${unit}${over ? ". Over the limit." : ""}`)
  }
  out.push("")
  const most = (k) => Math.max(...runs.map((run) => run.exempted[k] ?? 0))
  const exempt = { counterexamples: most("counterexamples"), samples: most("samples"), decorative: most("decorative"), metrics: most("metrics") }
  if (exempt.counterexamples || exempt.samples || exempt.decorative || exempt.metrics) {
    out.push("Exempted, and counted")
    if (exempt.samples) out.push(`  ${plural(exempt.samples, "element")} in declared samples may use their own colors and sizes.`)
    if (exempt.decorative) out.push(`  ${plural(exempt.decorative, "text element")} in samples hidden from assistive technology are pictures of an interface, so their contrast isn't measured.`)
    if (exempt.metrics) out.push(`  ${plural(exempt.metrics, "element")} take a value from a component metric, declared on the component with its reason.`)
    if (exempt.counterexamples) out.push(`  ${plural(exempt.counterexamples, "element")} in counterexamples, allowed by --allow-counterexamples.`)
    out.push("")
  }
  const overBudgets = runs[0].budgets.filter((b) => runs.some((run) => !run.budgets.find((x) => x.name === b.name).pass)).length
  if (pass) out.push("Every rule the page check measures is kept.")
  else {
    const parts = [problems.length && plural(problems.length, "problem"), broken.length && `${plural(broken.length, "rule")} broken`, overBudgets && `${plural(overBudgets, "budget")} over the limit`].filter(Boolean)
    out.push(`${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}. Run halation rules to see why each rule exists and what to do instead.`)
  }
  return `${out.join("\n")}\n`
}
