import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { lintText, stopStateFile } from "../src/lint.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const temps = []
after(() => temps.forEach((d) => [d, stopStateFile(d)].forEach((p) => rmSync(p, { recursive: true, force: true }))))

/** A project folder with a package.json and the given files. */
function project(files = {}, pkg = { name: "app" }) {
  const dir = mkdtempSync(path.join(tmpdir(), "halation-stop-"))
  temps.push(dir)
  writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg))
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    writeFileSync(path.join(dir, rel), text)
  }
  return dir
}

const stop = (dir, extra = {}) =>
  spawnSync(process.execPath, [BIN, "lint", "--stop"], {
    cwd: dir,
    input: JSON.stringify({ session_id: "s", hook_event_name: "Stop", cwd: dir, stop_hook_active: false, ...extra }),
    encoding: "utf8",
  })

describe("halation lint --stop", () => {
  test("exits 2 on a violation written anywhere in src", () => {
    const dir = project({ "src/App.tsx": `export const A = () => <p className="text-body">Hi</p>\n`, "src/deep/vendor/.gen/x.css": ".a { color: #7c3aed; }\n" })
    const r = stop(dir)
    assert.equal(r.status, 2)
    assert.equal(r.stdout, "")
    assert.match(r.stderr, /Halation lint found 1 problem with the design rules in this project, so the work isn't done\. Fix it, then finish:/)
    assert.match(r.stderr, /- src\/deep\/vendor\/\.gen\/x\.css:1:\d+, R17: Colors come from tokens/)
  })

  test("warnings count too", () => {
    const dir = project({ "src/A.tsx": `export const A = () => <span className="size-2 rounded-full" />\n` })
    const r = stop(dir)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /R10 \(warning\)/)
  })

  test("a clean project finishes", () => {
    const dir = project({ "src/App.tsx": `export const A = () => <p className="text-body">Hi</p>\n` })
    const r = stop(dir)
    assert.equal(r.status, 0)
    assert.equal(r.stderr, "")
  })

  test("a project without src finishes", () => assert.equal(stop(project()).status, 0))

  test("it lints the paths package.json names", () => {
    const dir = project({ "app/x.css": ".a { color: red; }\n", "src/x.css": ".a { color: blue; }\n" }, { name: "app", halation: { lint: ["app"] } })
    const r = stop(dir)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /app\/x\.css/)
    assert.doesNotMatch(r.stderr, /src\/x\.css/)
  })

  test("a configured path that's gone blocks", () => {
    const dir = project({}, { name: "app", halation: { lint: ["web"] } })
    const r = stop(dir)
    assert.equal(r.status, 2)
    assert.match(r.stderr, /package\.json asks Halation to lint web before finishing, and there's no file or folder there\./)
  })

  test("lets the stop through when nothing changed since the last one, and tells the person", () => {
    const dir = project({ "src/x.css": ".a { text-transform: uppercase; }\n" })
    assert.equal(stop(dir).status, 2)
    const state = stopStateFile(dir)
    assert.ok(existsSync(state))
    assert.ok(!state.startsWith(dir), "the state lives outside the project")
    const r = stop(dir, { stop_hook_active: true })
    assert.equal(r.status, 0)
    const { systemMessage } = JSON.parse(r.stdout)
    assert.match(systemMessage, /Halation lint still finds 1 problem in this project, and Claude Code stopped without fixing it:/)
    assert.match(systemMessage, /src\/x\.css:1:\d+, R5/)
    assert.match(systemMessage, /Run npx halation lint src to see it\./)
  })

  test("keeps blocking while the problems change", () => {
    const dir = project({ "src/x.css": ".a { text-transform: uppercase; }\n" })
    assert.equal(stop(dir).status, 2)
    writeFileSync(path.join(dir, "src/x.css"), ".a { letter-spacing: 0.2em; }\n")
    assert.equal(stop(dir, { stop_hook_active: true }).status, 2)
  })

  test("blocks again on the first stop of a new turn", () => {
    const dir = project({ "src/x.css": ".a { text-transform: uppercase; }\n" })
    assert.equal(stop(dir).status, 2)
    assert.equal(stop(dir, { stop_hook_active: true }).status, 0)
    assert.equal(stop(dir).status, 2)
  })

  test("a fixed project clears what it remembered", () => {
    const dir = project({ "src/x.css": ".a { text-transform: uppercase; }\n" })
    assert.equal(stop(dir).status, 2)
    writeFileSync(path.join(dir, "src/x.css"), ".a { color: var(--color-fg); }\n")
    assert.equal(stop(dir).status, 0)
    assert.ok(!existsSync(stopStateFile(dir)))
  })

  test("the state file is keyed by project", () => {
    assert.notEqual(stopStateFile("/a/b"), stopStateFile("/a/c"))
    assert.equal(path.dirname(path.dirname(stopStateFile("/a/b"))), tmpdir())
  })

  test("input that isn't JSON says what's wrong", () => {
    const r = spawnSync(process.execPath, [BIN, "lint", "--stop"], { cwd: project(), input: "nope", encoding: "utf8" })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /wasn't JSON/)
  })

  test("its words keep the rules", () => {
    const dir = project({ "src/x.css": ".a { text-transform: uppercase; }\n" })
    const block = stop(dir).stderr.replace(/^- .*$/gm, "")
    const pass = JSON.parse(stop(dir, { stop_hook_active: true }).stdout).systemMessage.replace(/^- .*$/gm, "")
    assert.deepEqual(lintText(`${block}\n${pass}`, "message.md"), [])
  })
})
