import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const DOT = "\u00b7"

describe("halation lint --hook", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "halation-hook-"))
  after(() => rmSync(dir, { recursive: true, force: true }))
  const put = (rel, text) => {
    const file = path.join(dir, rel)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
    return file
  }
  const hook = (payload) =>
    spawnSync(process.execPath, [BIN, "lint", "--hook"], { cwd: dir, input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8" })
  const edit = (file_path, extra = {}) => ({ session_id: "s", hook_event_name: "PostToolUse", tool_name: "Edit", cwd: dir, tool_input: { file_path }, ...extra })

  const bad = put("src/bad.tsx", `export const A = () => (\n  <p className="text-sm">Copy of Claude ${DOT} 412 MB</p>\n)\n`)
  const warn = put("src/warn.tsx", `export const B = () => <span className="size-2 rounded-full" />\n`)
  const clean = put("src/clean.tsx", `export const C = () => <p className="text-body-sm">Hi</p>\n`)
  const other = put("src/tool.py", `label = "text-sm uppercase"\n`)
  const hidden = put(".claude/skills/halation/SKILL.md", `Don't write A ${DOT} B\n`)
  put("package.json", "{}\n")
  const vendored = put("src/vendor/x.css", `.a { text-transform: uppercase; }\n`)
  const dotted = put("src/.x/x.tsx", `export const D = () => <p className="text-sm">Hi</p>\n`)
  const built = put("dist/x.tsx", `export const D = () => <p className="text-sm">Hi</p>\n`)
  const dependency = put("node_modules/pkg/x.tsx", `export const D = () => <p className="text-sm">Hi</p>\n`)
  const bare = put("src/bare.tsx", `// halation-ignore\nexport const E = () => <p className="text-body">Hi</p>\n`)

  test("exits 2 with the problems on stderr when the edited file breaks a rule", () => {
    const r = hook(edit(bad))
    assert.equal(r.status, 2)
    assert.equal(r.stdout, "")
    assert.match(r.stderr, /in src\/bad\.tsx/)
    assert.match(r.stderr, /Line 2, R7: Ten named text styles; no other sizes\. Found "text-sm"\. Instead: The nearest style\./)
    assert.match(r.stderr, /Line 2, R9: Facts are never joined with dots or bars\..*Instead: The Facts component/)
  })

  test("exits 0 silently for a clean file", () => {
    const r = hook(edit(clean))
    assert.equal(r.status, 0)
    assert.equal(r.stderr, "")
  })

  test("warnings are reported too, labelled as warnings", () => {
    const r = hook(edit(warn))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Halation lint found 1 warning with the design rules in src\/warn\.tsx\./)
    assert.match(r.stderr, /Line 1, R10 \(warning\): No status dots/)
  })

  test("errors and warnings are counted apart", () => {
    const both = put("src/both.tsx", `export const F = () => <p className="text-sm"><span className="size-2 rounded-full" /></p>\n`)
    assert.match(hook(edit(both)).stderr, /found 1 problem and 1 warning with the design rules/)
  })

  test("an exception without a rule id is reported", () => {
    const r = hook(edit(bare))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Line 1, R21: An exception names the rule it breaks\..*Instead: An exception needs the rule id it's for, like halation-ignore R9, and a reason\./)
  })

  test("files in src/vendor and dot-folders in src are linted", () => {
    assert.equal(hook(edit(vendored)).status, 2)
    assert.equal(hook(edit(dotted)).status, 2)
  })
  test("build output at the top and dependencies pass", () => {
    assert.equal(hook(edit(built)).status, 0)
    assert.equal(hook(edit(dependency)).status, 0)
  })

  test("files no detector covers pass", () => assert.equal(hook(edit(other)).status, 0))
  test("files in .claude pass", () => assert.equal(hook(edit(hidden)).status, 0))
  test("a path relative to the hook's cwd works", () => assert.equal(hook(edit("src/bad.tsx")).status, 2))
  test("Write and MultiEdit payloads work the same", () => {
    assert.equal(hook(edit(bad, { tool_name: "Write" })).status, 2)
    assert.equal(hook(edit(bad, { tool_name: "MultiEdit" })).status, 2)
  })
  test("a payload without a file passes", () => assert.equal(hook({ tool_input: {} }).status, 0))
  test("a missing file passes", () => assert.equal(hook(edit(path.join(dir, "gone.tsx"))).status, 0))
  test("input that isn't JSON says what's wrong", () => {
    const r = hook("not json")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /wasn't JSON/)
  })
})
