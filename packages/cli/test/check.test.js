import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createServer } from "node:http"
import { after, before, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { checkerSource, checkUrl, formatCheck, toUrl } from "../src/check.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const DOT = "\u00b7"
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#fff;color:#111;font-family:Georgia">${body}</body></html>`
const PAGES = {
  "/joined": page(`<p>A ${DOT} B</p>`),
  "/clean": page(`<h1>Claude Work</h1><p>A copy of Claude with its own accounts.</p><dl><dt>Size</dt><dd>412 MB</dd><dt>Opened</dt><dd>Two hours ago</dd></dl>`),
}

let playwright = true
try {
  await import("playwright-core")
} catch {
  playwright = false
}

test("the checker becomes a plain script", () => {
  const source = checkerSource()
  assert.doesNotMatch(source, /^export /m)
  assert.match(source, /^function check\(/m)
})

test("addresses are completed", () => {
  assert.equal(toUrl("http://x.test/a"), "http://x.test/a")
  assert.equal(toUrl("localhost:3000"), "http://localhost:3000")
  assert.match(toUrl("package.json", fileURLToPath(new URL("..", import.meta.url))), /^file:\/\/.*package\.json$/)
})

describe("halation check in a browser", { skip: !playwright && "playwright-core isn't installed" }, () => {
  let server
  let base
  before(async () => {
    server = createServer((req, res) => {
      const html = PAGES[req.url]
      res.writeHead(html ? 200 : 404, { "content-type": "text/html; charset=utf-8" })
      res.end(html ?? "Not found")
    })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  const run = async (t, url, options) => {
    try {
      return await checkUrl(url, options)
    } catch (e) {
      if (/Couldn't start a browser/.test(e.message)) t.skip(e.message)
      else throw e
    }
  }

  test("facts joined with a dot fail R9", async (t) => {
    const result = await run(t, `${base}/joined`)
    if (!result) return
    assert.equal(result.pass, false)
    assert.equal(result.runs.length, 4)
    for (const run of result.runs) {
      const r9 = run.rules.find((r) => r.id === "R9")
      assert.equal(r9.pass, false)
      assert.deepEqual(r9.examples, ["p"])
    }
    const report = formatCheck(result)
    assert.match(report, /Checked .* in light and dark mode, at 1280 px and 375 px\./)
    assert.match(report, /Broken\n {2}R9 {3}No dots joining facts\n {7}Everywhere, 1 element: p/)
    assert.match(report, /Budgets\n {2}Ink buttons in any one view: 0 at most, limit 1/)
  })

  test("a clean page passes", async (t) => {
    const result = await run(t, `${base}/clean`, { modes: ["light"] })
    if (!result) return
    assert.equal(result.pass, true, JSON.stringify(result.runs.flatMap((run) => run.rules.filter((r) => !r.pass))))
    assert.match(formatCheck(result), /Every rule the page check measures is kept\./)
  })

  test("the command exits 1 on a broken rule and 0 on a clean page", async () => {
    // Spawned asynchronously so this process keeps serving the fixture.
    const cli = (...args) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [BIN, "check", ...args])
        let out = ""
        child.stdout.on("data", (d) => (out += d))
        child.stderr.on("data", (d) => (out += d))
        child.on("close", (code) => resolve({ code, out }))
      })
    const broken = await cli(`${base}/joined`, "--mode", "light")
    if (/Couldn't start a browser/.test(broken.out)) return
    assert.equal(broken.code, 1, broken.out)
    assert.match(broken.out, /1 rule broken\./)
    const clean = await cli(`${base}/clean`, "--json", "--mode", "light")
    assert.equal(clean.code, 0, clean.out)
    assert.equal(JSON.parse(clean.out).pass, true)
  })
})

test("check without an address says how to use it", () => {
  const r = spawnSync(process.execPath, [BIN, "check"], { encoding: "utf8" })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /halation check needs one address to load/)
})
