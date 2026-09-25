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
  try {
    return await chromium.launch({ channel: "chrome" })
  } catch (first) {
    try {
      return await chromium.launch()
    } catch {
      throw new Error(`Couldn't start a browser (${String(first.message).split("\n")[0]}). Install Google Chrome, or run npx playwright-core install chromium, and try again.`)
    }
  }
}

/**
 * Loads `url` in each color scheme and runs the checker on it. Returns
 * { url, modes: { light?: result, dark?: result }, pass }.
 */
export async function checkUrl(url, { modes = ["light", "dark"], cwd = process.cwd() } = {}) {
  const chromium = await loadPlaywright(cwd)
  if (!chromium) {
    const err = new Error("Halation check drives a headless browser through playwright-core, which isn't installed: run npm install -D playwright-core (or pnpm add -D playwright-core) and try again.")
    err.missing = true
    throw err
  }
  const script = `(() => {\n${checkerSource()}\nreturn check(document.body)\n})()`
  const browser = await launch(chromium)
  const results = {}
  try {
    for (const colorScheme of modes) {
      const context = await browser.newContext({ colorScheme, bypassCSP: true, viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      try {
        await page.goto(url, { waitUntil: "load", timeout: 30_000 })
      } catch (e) {
        throw new Error(`Couldn't load ${url} (${String(e.message).split("\n")[0]}). Check the address, and that the server is running.`)
      }
      await page.waitForTimeout(500)
      results[colorScheme] = await page.evaluate(script)
      await context.close()
    }
  } finally {
    await browser.close()
  }
  const all = Object.values(results)
  const pass = all.every((r) => r.rules.every((x) => x.pass) && r.budgets.every((b) => b.pass))
  return { url, modes: results, pass }
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** The readable report. */
export function formatCheck({ url, modes, pass }) {
  const names = Object.keys(modes)
  const first = modes[names[0]]
  const out = [`Checked ${url} in ${names.length > 1 ? `${names.join(" and ")} mode` : `${names[0]} mode`}.`, ""]
  const broken = first.rules.map((r) => r.id).filter((id) => names.some((m) => !modes[m].rules.find((r) => r.id === id).pass))
  const kept = first.rules.filter((r) => !broken.includes(r.id))
  if (broken.length) {
    out.push("Broken")
    for (const id of broken) {
      const per = names.map((m) => [m, modes[m].rules.find((r) => r.id === id)])
      out.push(`  ${id.padEnd(4)} ${per[0][1].says}`)
      const failing = per.filter(([, r]) => !r.pass)
      if (failing.length === names.length && failing.every(([, r]) => same(r.examples, failing[0][1].examples) && r.count === failing[0][1].count)) {
        const r = failing[0][1]
        out.push(`       ${names.length > 1 ? "In both modes, " : ""}${plural(r.count, "element")}: ${r.examples.join(", ")}${r.count > r.examples.length ? ", and more" : ""}`)
      } else {
        for (const [m, r] of failing) out.push(`       In ${m} mode, ${plural(r.count, "element")}: ${r.examples.join(", ")}${r.count > r.examples.length ? ", and more" : ""}`)
      }
    }
    out.push("")
  }
  if (kept.length) {
    out.push("Kept")
    for (const r of kept) out.push(`  ${r.id.padEnd(4)} ${r.says}`)
    out.push("")
  }
  out.push("Budgets")
  for (const b of first.budgets) {
    const per = names.map((m) => modes[m].budgets.find((x) => x.name === b.name))
    const unit = /share/i.test(b.name) ? "%" : ""
    const values = per.every((x) => x.value === per[0].value) ? `${per[0].value}${unit}` : per.map((x, i) => `${x.value}${unit} in ${names[i]}`).join(", ")
    const over = per.some((x) => !x.pass)
    out.push(`  ${b.name}: ${values}, limit ${b.limit}${unit}${over ? ". Over the limit." : ""}`)
  }
  out.push("")
  const overBudgets = first.budgets.filter((b) => names.some((m) => !modes[m].budgets.find((x) => x.name === b.name).pass)).length
  if (pass) out.push("Every rule the page check measures is kept.")
  else {
    const parts = [broken.length && `${plural(broken.length, "rule")} broken`, overBudgets && `${plural(overBudgets, "budget")} over the limit`].filter(Boolean)
    out.push(`${parts.join(" and ").replace(/^./, (c) => c.toUpperCase())}. Run halation rules to see why each rule exists and what to do instead.`)
  }
  return `${out.join("\n")}\n`
}
