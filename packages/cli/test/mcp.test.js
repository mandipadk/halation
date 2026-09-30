import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { createInterface } from "node:readline"
import { after, before, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { gateCss } from "../src/gate.js"
import { lintText } from "../src/lint.js"
import { loadRules } from "../src/rules.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version
const DOT = "·"

let playwright = true
try {
  await import("playwright-core")
} catch {
  playwright = false
}

/** A project with a source file that breaks a rule, and a build with one that breaks another. */
const project = mkdtempSync(path.join(tmpdir(), "halation-mcp-"))
mkdirSync(path.join(project, "src"))
mkdirSync(path.join(project, "dist"))
writeFileSync(path.join(project, "src/card.css"), ".card {\n  color: #7c3aed;\n}\n")
writeFileSync(path.join(project, "src/clean.css"), ".clean {\n  color: var(--color-fg);\n}\n")
writeFileSync(path.join(project, "dist/app.css"), ".card{padding:13px}\n")
after(() => rmSync(project, { recursive: true, force: true }))

/** Starts `halation mcp` in the project and talks to it one line at a time. */
function connect() {
  const child = spawn(process.execPath, [BIN, "mcp"], { cwd: project, stdio: ["pipe", "pipe", "pipe"] })
  const waiting = new Map()
  const stray = []
  let stderr = ""
  child.stderr.on("data", (d) => (stderr += d))
  createInterface({ input: child.stdout }).on("line", (line) => {
    const message = JSON.parse(line)
    const resolve = waiting.get(message.id)
    if (resolve) {
      waiting.delete(message.id)
      resolve(message)
    } else stray.push(message)
  })
  let next = 1
  const send = (message) => child.stdin.write(`${typeof message === "string" ? message : JSON.stringify(message)}\n`)
  const request = (method, params) => {
    const id = next++
    const reply = new Promise((resolve) => waiting.set(id, resolve))
    send({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) })
    return reply
  }
  const call = async (name, args) => {
    const reply = await request("tools/call", { name, arguments: args })
    assert.ok(reply.result, JSON.stringify(reply.error))
    return reply.result
  }
  const close = () =>
    new Promise((resolve) => {
      child.on("close", (code) => resolve(code))
      child.stdin.end()
    })
  return { child, send, request, call, close, stray, stderr: () => stderr }
}

const data = (result) => {
  assert.equal(result.isError, false, result.content?.[0]?.text)
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
  return result.structuredContent
}
const refusal = (result) => {
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent, undefined)
  return result.content[0].text
}

describe("halation mcp", () => {
  let client
  before(async () => {
    client = connect()
    const init = await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } })
    assert.equal(init.result.protocolVersion, "2025-06-18")
    assert.deepEqual(init.result.serverInfo, { name: "halation", title: "Halation", version: VERSION })
    assert.ok(init.result.capabilities.tools)
    assert.ok(init.result.capabilities.prompts)
    client.send({ jsonrpc: "2.0", method: "notifications/initialized" })
  })
  after(async () => {
    assert.equal(await client.close(), 0)
    assert.deepEqual(client.stray, [], "every message on stdout answers a request")
  })

  test("ping", async () => assert.deepEqual((await client.request("ping")).result, {}))

  test("lists every tool with a schema and a plain description", async () => {
    const { tools } = (await client.request("tools/list")).result
    assert.deepEqual(tools.map((t) => t.name).sort(), ["check", "components", "explain", "gate", "lint", "metric", "rules", "scale"])
    for (const t of tools) {
      assert.equal(t.inputSchema.type, "object", t.name)
      assert.match(t.description, /^[A-Z][^A-Z]/, t.name)
      assert.doesNotMatch(t.description, /\s[·•]\s/, t.name)
      assert.doesNotMatch(t.description.replace(/R\d+|JSON|CSS|HTML/g, ""), /\b[A-Z]{3,}\b/, t.name)
    }
  })

  test("rules: all of them, or one by id", async () => {
    const all = data(await client.call("rules", {}))
    assert.equal(all.rules.length, loadRules().length)
    const one = data(await client.call("rules", { id: "r9" }))
    assert.deepEqual(one.rules.map((r) => r.id), ["R9"])
    assert.ok(one.rules[0].why && one.rules[0].instead && one.rules[0].caughtBy.length)
    assert.match(refusal(await client.call("rules", { id: "R99" })), /There's no rule called R99/)
  })

  test("explain: a rule with its don't and do", async () => {
    const r = data(await client.call("explain", { id: "R9" }))
    assert.equal(r.id, "R9")
    assert.match(r.dont, /412 MB/)
    assert.match(r.do, /Facts/)
    assert.ok(r.tells.length)
    const metric = data(await client.call("explain", { id: "metrics-have-reasons" }))
    assert.equal(metric.id, "R26")
    assert.match(metric.metric, /metric tool/)
  })

  test("scale: read from the installed core", async () => {
    const all = data(await client.call("scale", {}))
    assert.equal(all.text.textStyles.length, 11)
    const body = all.text.textStyles.find((t) => t.name === "body-sm")
    assert.equal(body.value, "0.875rem")
    assert.match(body.usage, /Interface text/)
    const surface = all.color.colorRoles.find((c) => c.name === "surface")
    assert.equal(surface.token, "--color-surface")
    assert.ok(surface.usage)
    assert.deepEqual(all.radius.radii.map((r) => r.name), ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"])
    assert.deepEqual(all.space.spaces.map((s) => s.name), ["gutter", "stage", "group", "split", "section", "scene"])
    assert.ok(all.motion.durations.some((d) => d.token === "--duration-hover" && d.value === "150ms"))
    assert.ok(all.motion.easings.some((e) => e.name === "out" && e.value.startsWith("cubic-bezier")))
    assert.deepEqual(all.form.forms.map((f) => f.name), ["sharp", "round"])
    assert.match(all.grid.grid.steps, /2 px steps up to 24/)
    const radius = data(await client.call("scale", { section: "radius" }))
    assert.deepEqual(Object.keys(radius), ["radii", "note"])
  })

  test("components: the catalog, filtered by a word", async () => {
    const all = data(await client.call("components", {}))
    assert.ok(all.components.length > 20)
    const found = data(await client.call("components", { query: "status" }))
    assert.ok(found.components.some((c) => c.name === "State"))
    assert.ok(found.components.length < all.components.length)
    for (const c of found.components) assert.ok(c.use && c.example, c.name)
  })

  test("lint: paths in the project", async () => {
    const r = data(await client.call("lint", { paths: ["src"] }))
    assert.equal(r.files, 2)
    assert.equal(r.pass, false)
    const f = r.findings.find((x) => x.rule === "R17")
    assert.equal(f.file, "src/card.css")
    assert.equal(f.line, 2)
    assert.ok(f.says && f.instead)
    assert.equal(data(await client.call("lint", { paths: ["src/clean.css"] })).pass, true)
    assert.match(refusal(await client.call("lint", { paths: ["missing"] })), /There's no file or folder at missing/)
    assert.match(refusal(await client.call("lint", { paths: ["../elsewhere"] })), /outside the project/)
  })

  test("lint: text with a filename", async () => {
    const r = data(await client.call("lint", { text: "<p>Size 412 MB</p>\n<p>A ${DOT} B</p>".replace("${DOT}", DOT), filename: "Card.tsx" }))
    assert.deepEqual(r.findings.map((f) => [f.rule, f.line]), [["R9", 2]])
    assert.match(refusal(await client.call("lint", { text: "x" })), /needs a filename/)
    assert.match(refusal(await client.call("lint", { text: "x", filename: "notes.xyz" })), /doesn't read \.xyz files/)
  })

  test("gate: the build output", async () => {
    const r = data(await client.call("gate", {}))
    assert.deepEqual(r.dirs, ["dist"])
    assert.equal(r.files, 1)
    assert.deepEqual(r.findings.map((f) => [f.rule, f.selector]), [["R24", ".card"]])
    assert.ok(r.findings[0].instead)
    assert.match(refusal(await client.call("gate", { dirs: ["build"] })), /There's no file or folder at build/)
  })

  test("check says how to install playwright-core when it's missing", { skip: playwright && "playwright-core is installed" }, async () => {
    assert.match(refusal(await client.call("check", { url: "http://127.0.0.1:1" })), /playwright-core, which isn't installed: run npm install -D playwright-core/)
  })

  describe("check in a browser", { skip: !playwright && "playwright-core isn't installed" }, () => {
    let server
    let base
    before(async () => {
      server = createServer((req, res) => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body style="background:#fff;color:#111"><h1>Storage</h1><p>Claude ${DOT} 412 MB</p><p>One</p><p>Two</p><p>Three</p></body></html>`)
      })
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
      base = `http://127.0.0.1:${server.address().port}`
    })
    after(() => server?.close())

    test("returns the broken rules with examples, and the budgets", async (t) => {
      const result = await client.call("check", { url: `${base}/`, modes: ["light"], widths: [1280] })
      if (result.isError && /Couldn't start a browser/.test(result.content[0].text)) return t.skip(result.content[0].text)
      const r = data(result)
      assert.equal(r.pass, false)
      assert.deepEqual(r.modes, ["light"])
      assert.deepEqual(r.widths, [1280])
      const r9 = r.broken.find((b) => b.id === "R9")
      assert.ok(r9, JSON.stringify(r.broken))
      assert.equal(r9.where, "everywhere")
      assert.ok(r9.examples.length && r9.instead)
      assert.ok(r.budgets.length && r.budgets.every((b) => "limit" in b))
    })
  })

  describe("metric", () => {
    const base = { selector: ".hl-cap", name: "cap-x", value: "9px", reason: "a one-letter cap stays square at 38 px", for: "padding" }

    test("writes the CSS for a value off the grid, and the CSS keeps the rules", async () => {
      const r = data(await client.call("metric", base))
      assert.equal(r.outcome, "declare")
      assert.equal(r.css, ".hl-cap {\n  --m-cap-x: 9px; /* a one-letter cap stays square at 38 px */\n  padding: var(--m-cap-x);\n}\n")
      assert.ok(r.notes.some((n) => /8px and 10px/.test(n)))
      assert.deepEqual(lintText(r.css, "cap.css"), [])
      assert.deepEqual(gateCss(r.css), [])
    })

    test("a material color gets its reason, and lint and the gate accept it", async () => {
      const r = data(await client.call("metric", { selector: ".print", name: "paper", value: "oklch(96% 0.006 80)", reason: "photographic paper, a warm white in either mode", for: "color" }))
      assert.match(r.declaration, /^--m-paper: oklch\(96% 0\.006 80\); \/\* photographic paper/)
      assert.deepEqual(gateCss(`${r.css}\n.print { background: var(--m-paper); }`), [])
      assert.ok(r.notes.some((n) => /materials/.test(n) && /not|never/.test(n)))
      assert.deepEqual(lintText(r.css, "print.css"), [])
      assert.match(refusal(await client.call("metric", { ...base, value: "bluish", for: "color" })), /isn't a color/)
    })

    test("says when the value is already on the scale, and what to use", async () => {
      const cases = [
        [{ value: "14px" }, /on the grid.*padding: 14px \(p-3\.5 in Tailwind\)/],
        [{ value: "13px", border: 1 }, /border's outside/],
        [{ value: "clamp(16px, 4vw, 48px)", for: "gap" }, /named space gutter.*var\(--space-gutter\)/],
        [{ value: "10px", for: "radius" }, /radius step lg.*var\(--radius-lg\)/],
        [{ value: "9999px", for: "radius" }, /already fine for a corner/],
        [{ value: "13px", for: "font-size" }, /text style caption.*var\(--text-caption\)/],
        [{ value: "var(--color-fg)", for: "color" }, /built from the color roles/],
      ]
      for (const [change, message] of cases) {
        const r = data(await client.call("metric", { ...base, ...change }))
        assert.equal(r.outcome, "on-scale", JSON.stringify(change))
        assert.equal(r.needsMetric, false)
        assert.match(r.message, message)
      }
    })

    test("refuses a thin reason or a name that isn't kebab-case", async () => {
      assert.match(refusal(await client.call("metric", { ...base, reason: "looks better" })), /too thin a reason: 2 words/)
      assert.match(refusal(await client.call("metric", { ...base, reason: "  " })), /needs its reason/)
      assert.match(refusal(await client.call("metric", { ...base, reason: "closes the comment */ early here" })), /can't contain/)
      assert.match(refusal(await client.call("metric", { ...base, name: "capX" })), /kebab-case.*Try cap-x\./)
      assert.match(refusal(await client.call("metric", { ...base, name: "cap_x!" })), /kebab-case/)
      assert.equal(data(await client.call("metric", { ...base, name: "--m-cap-x" })).token, "--m-cap-x")
    })

    test("a radius off the scale learns how to nest", async () => {
      const r = data(await client.call("metric", { ...base, name: "print-corner", value: "3px", reason: "a photographic print's corner, cut small", for: "radius" }))
      assert.match(r.css, /border-radius: var\(--m-print-corner\);/)
      assert.deepEqual(lintText(r.css, "print.css"), [])
    })
  })

  describe("errors", () => {
    test("an unknown method", async () => {
      const r = await client.request("resources/list")
      assert.equal(r.error.code, -32601)
      assert.match(r.error.message, /There's no method called resources\/list/)
    })
    test("an unknown tool", async () => {
      const r = await client.request("tools/call", { name: "paint", arguments: {} })
      assert.equal(r.error.code, -32602)
      assert.match(r.error.message, /There's no tool called paint\. The tools are rules/)
    })
    test("arguments that don't fit the schema", async () => {
      for (const [name, args, message] of [
        ["metric", { selector: ".a" }, /need name/],
        ["scale", { section: "shadows" }, /section is one of text/],
        ["lint", { paths: "src" }, /paths should be a list/],
        ["check", { url: "x", widths: [100] }, /at least 240/],
        ["rules", { idd: "R1" }, /There's no argument called idd/],
      ]) {
        const r = await client.request("tools/call", { name, arguments: args })
        assert.equal(r.error?.code, -32602, `${name} ${JSON.stringify(args)}`)
        assert.match(r.error.message, message)
      }
    })
    test("a message that isn't JSON, and a notification nobody answers", async () => {
      client.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 99 } })
      const parsed = new Promise((resolve) => {
        const check = setInterval(() => {
          const found = client.stray.findIndex((m) => m.error?.code === -32700)
          if (found !== -1) {
            clearInterval(check)
            resolve(client.stray.splice(found, 1)[0])
          }
        }, 10)
      })
      client.send("{not json")
      const r = await parsed
      assert.equal(r.id, null)
      assert.deepEqual((await client.request("ping")).result, {})
    })
  })

  describe("prompts", () => {
    test("lists new-component", async () => {
      const { prompts } = (await client.request("prompts/list")).result
      assert.deepEqual(prompts.map((p) => p.name), ["new-component"])
      assert.deepEqual(prompts[0].arguments.map((a) => [a.name, a.required]), [["component", true]])
    })
    test("gets it with the component filled in", async () => {
      const { messages } = (await client.request("prompts/get", { name: "new-component", arguments: { component: "a storage meter" } })).result
      assert.equal(messages.length, 1)
      assert.equal(messages[0].role, "user")
      const text = messages[0].content.text
      assert.match(text, /a storage meter/)
      for (const tool of ["components", "scale", "metric", "lint", "check"]) assert.match(text, new RegExp(`\\b${tool}\\b`))
      assert.doesNotMatch(text, /\s[·•]\s/)
    })
    test("needs its argument, and a name it knows", async () => {
      assert.equal((await client.request("prompts/get", { name: "new-component", arguments: {} })).error.code, -32602)
      assert.equal((await client.request("prompts/get", { name: "old-component" })).error.code, -32602)
    })
  })
})

test("echoes an older protocol version it speaks, and offers its own for one it doesn't", async () => {
  for (const [asked, answered] of [["2025-03-26", "2025-03-26"], ["2099-01-01", "2025-06-18"]]) {
    const client = connect()
    const r = await client.request("initialize", { protocolVersion: asked, capabilities: {}, clientInfo: { name: "test", version: "1" } })
    assert.equal(r.result.protocolVersion, answered)
    assert.equal(await client.close(), 0)
  }
})

test("halation mcp --help, and no arguments", async () => {
  const { spawnSync } = await import("node:child_process")
  const help = spawnSync(process.execPath, [BIN, "mcp", "--help"], { encoding: "utf8" })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /^Usage: halation mcp$/m)
  const extra = spawnSync(process.execPath, [BIN, "mcp", "now"], { encoding: "utf8", input: "" })
  assert.equal(extra.status, 1)
  assert.match(extra.stderr, /halation mcp takes no arguments/)
  assert.match(spawnSync(process.execPath, [BIN, "--help"], { encoding: "utf8" }).stdout, /^ {2}mcp\b/m)
})
