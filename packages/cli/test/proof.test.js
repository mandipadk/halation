import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, describe, test } from "node:test"
import { intact, makeProof, proofSvg, prove, signProof, verify } from "../src/proof.js"

const dirs = []
const tempDir = () => {
  const d = mkdtempSync(path.join(tmpdir(), "halation-proof-"))
  dirs.push(d)
  return d
}
after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

const run = (mode, width, broken = []) => ({
  mode,
  width,
  errors: [],
  elements: 40,
  exempted: { counterexamples: 0, samples: 0, decorative: 0, metrics: 2 },
  rules: ["R1", "R4", "R5"].map((id) => ({ id, pass: !broken.includes(id), count: broken.includes(id) ? 1 : 0, examples: broken.includes(id) ? ["p.eyebrow"] : [] })),
  budgets: [{ name: "Ink buttons in any one view", value: 1, limit: 1, pass: true }],
})
const results = (broken = []) => [
  { url: "http://site.test/", pass: !broken.length, runs: [run("light", 1280), run("dark", 1280, broken)] },
  { url: "http://site.test/about", pass: true, runs: [run("light", 1280), run("dark", 1280)] },
]
const at = new Date("2026-09-29T12:00:00Z")

describe("a proof", () => {
  test("covers every page and run, and its id is the hash of its content", () => {
    const p = makeProof(results(), { name: "Meridian", modes: ["light", "dark"], widths: [1280], at })
    assert.equal(p.pass, true)
    assert.equal(p.pages.length, 2)
    assert.deepEqual(p.measured, ["R1", "R4", "R5"])
    assert.match(p.id, /^[0-9a-f]{64}$/)
    assert.match(p.rulebook.sha256, /^[0-9a-f]{64}$/)
    assert.match(p.checker.sha256, /^[0-9a-f]{64}$/)
    assert.equal(makeProof(results(), { name: "Meridian", modes: ["light", "dark"], widths: [1280], at }).id, p.id, "the same results give the same id")
    assert.ok(intact(p))
  })
  test("any change to it breaks its id", () => {
    const p = makeProof(results(["R5"]), { name: "Meridian", modes: ["light", "dark"], widths: [1280], at })
    assert.equal(p.pass, false)
    assert.ok(intact(p))
    const edited = structuredClone(p)
    edited.pages[0].pass = true
    assert.equal(intact(edited), false)
    const forged = structuredClone(p)
    forged.pages[0].runs[1].broken = []
    assert.equal(intact(forged), false)
  })
  test("its seal says what held, plainly", () => {
    const svg = proofSvg(makeProof(results(), { name: "Meridian", modes: ["light", "dark"], widths: [1280, 375], at }))
    assert.match(svg, /Proven by Halation/)
    assert.match(svg, /3 rules held on 2 pages/)
    assert.match(svg, /Light and dark, at 1280 and 375 px, 29 Sept? 2026/)
    assert.doesNotMatch(svg, /\s[·•]\s/)
    const failed = proofSvg(makeProof(results(["R5"]), { name: "Meridian", modes: ["light", "dark"], widths: [1280], at }))
    assert.match(failed, /Checked by Halation/)
    assert.match(failed, /1 page of 2 broke a rule/)
  })
})

const hasKeygen = spawnSync("ssh-keygen", ["-?"], { encoding: "utf8" }).error === undefined

describe("signing and verifying", { skip: !hasKeygen && "ssh-keygen isn't available" }, () => {
  test("a signed proof verifies against its signer, and not once it's changed", () => {
    const dir = tempDir()
    const key = path.join(dir, "key")
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "owner", "-f", key])
    writeFileSync(path.join(dir, "allowed_signers"), `owner@example ${readFileSync(`${key}.pub`, "utf8")}`)
    const file = path.join(dir, "proof.json")
    writeFileSync(file, `${JSON.stringify(makeProof(results(), { name: "Meridian", modes: ["light"], widths: [1280], at }), null, 2)}\n`)
    signProof(file, key)

    const ok = verify(file, { signers: path.join(dir, "allowed_signers") })
    assert.equal(ok.intact, true)
    assert.deepEqual(ok.signed, { ok: true, by: "owner@example" })

    const other = path.join(dir, "other")
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", "other", "-f", other])
    writeFileSync(path.join(dir, "strangers"), `stranger@example ${readFileSync(`${other}.pub`, "utf8")}`)
    assert.equal(verify(file, { signers: path.join(dir, "strangers") }).signed.ok, false, "someone else's key doesn't vouch for it")

    writeFileSync(file, readFileSync(file, "utf8").replace('"pass": true', '"pass": false'))
    const tampered = verify(file, { signers: path.join(dir, "allowed_signers") })
    assert.equal(tampered.intact, false)
    assert.equal(tampered.signed.ok, false)
  })
  test("an unsigned proof says its signature is missing", () => {
    const dir = tempDir()
    const file = path.join(dir, "proof.json")
    writeFileSync(file, JSON.stringify(makeProof(results(), { name: "Meridian", modes: ["light"], widths: [1280], at })))
    writeFileSync(path.join(dir, "allowed_signers"), "")
    const r = verify(file, { signers: path.join(dir, "allowed_signers") })
    assert.equal(r.intact, true)
    assert.equal(r.signed.ok, false)
    assert.match(r.signed.reason, /no signature/)
  })
})

let playwright = true
try {
  await import("playwright-core")
} catch {
  playwright = false
}

describe("proving a real page", { skip: !playwright && "playwright-core isn't installed" }, () => {
  let server, base
  before(async () => {
    server = createServer((req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
      res.end(`<!doctype html><html><head><meta charset="utf-8"><style>:root { --color-canvas: #ffffff; --color-fg: #111111; --text-title-1: 2rem; --text-body: 1rem; } h1 { font-size: var(--text-title-1); }</style></head><body style="background:#fff;color:#111;font-family:Georgia"><h1>Meridian</h1><p>Every copy keeps its own accounts.</p><p>Open any copy from the menu bar.</p><p>Size</p><p>412 MB</p></body></html>`)
    })
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
    base = `http://127.0.0.1:${server.address().port}`
  })
  after(() => server?.close())

  test("writes the proof and its seal, and they verify", async (t) => {
    const dir = tempDir()
    let made
    try {
      made = await prove([`${base}/`], { out: "proof.json", name: "Meridian", modes: ["light"], widths: [1280], cwd: dir })
    } catch (e) {
      if (/Couldn't start a browser/.test(e.message)) return t.skip(e.message)
      throw e
    }
    assert.equal(made.proof.pass, true, JSON.stringify(made.proof.pages[0].runs[0].broken))
    assert.match(readFileSync(path.join(dir, "proof.svg"), "utf8"), /Proven by Halation/)
    assert.equal(verify(path.join(dir, "proof.json")).intact, true)
  })
})
