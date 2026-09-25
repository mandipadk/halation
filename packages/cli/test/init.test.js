import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { HOOK_COMMAND } from "../src/init.js"
import { lintText } from "../src/lint.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))
const temps = []
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })))
const tempDir = () => {
  const d = mkdtempSync(path.join(tmpdir(), "halation-init-"))
  temps.push(d)
  return d
}
const run = (dir, ...args) => spawnSync(process.execPath, [BIN, "init", ...args], { cwd: dir, encoding: "utf8" })
const read = (dir, rel) => readFileSync(path.join(dir, rel), "utf8")
const halationHooks = (settings) => settings.hooks.PostToolUse.flatMap((e) => e.hooks).filter((h) => h.command === HOOK_COMMAND)

describe("halation init", () => {
  test("sets up an empty project", () => {
    const dir = tempDir()
    const r = run(dir)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /Wrote the skill to \.claude\/skills\/halation\/SKILL\.md\./)
    assert.match(r.stdout, /npm install -D @halation\/cli/)
    assert.match(read(dir, ".claude/skills/halation/SKILL.md"), /^---\nname: halation\n/)
    const settings = JSON.parse(read(dir, ".claude/settings.json"))
    assert.deepEqual(settings, { hooks: { PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: HOOK_COMMAND }] }] } })
    assert.match(read(dir, "AGENTS.md"), /<!-- halation:start -->\n## Design system: Halation/)
    assert.equal(read(dir, "CLAUDE.md"), "@AGENTS.md\n")
  })

  test("takes a folder argument", () => {
    const parent = tempDir()
    mkdirSync(path.join(parent, "app"))
    assert.equal(run(parent, "app").status, 0)
    assert.ok(existsSync(path.join(parent, "app/.claude/settings.json")))
  })

  test("merges into existing settings and files, and running twice changes nothing", () => {
    const dir = tempDir()
    mkdirSync(path.join(dir, ".claude"))
    const existing = {
      permissions: { allow: ["Bash(npm test)"] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo pre" }] }],
        PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "prettier --write" }] }],
      },
    }
    writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify(existing))
    writeFileSync(path.join(dir, "AGENTS.md"), "# Agents\n\nRun the tests before committing.\n")
    writeFileSync(path.join(dir, "CLAUDE.md"), "Be brief.\n")
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ devDependencies: { "@halation/cli": "^0.1.0" } }))

    const first = run(dir)
    assert.equal(first.status, 0, first.stderr)
    assert.doesNotMatch(first.stdout, /npm install/)
    const snapshot = () => [".claude/settings.json", "AGENTS.md", "CLAUDE.md", ".claude/skills/halation/SKILL.md"].map((f) => read(dir, f))
    const once = snapshot()

    const settings = JSON.parse(once[0])
    assert.deepEqual(settings.permissions, existing.permissions)
    assert.deepEqual(settings.hooks.PreToolUse, existing.hooks.PreToolUse)
    assert.deepEqual(settings.hooks.PostToolUse[0], existing.hooks.PostToolUse[0])
    assert.equal(halationHooks(settings).length, 1)
    assert.ok(once[1].startsWith("# Agents\n\nRun the tests before committing.\n\n<!-- halation:start -->"))
    assert.equal(once[2], "Be brief.\n\n@AGENTS.md\n")

    const second = run(dir)
    assert.equal(second.status, 0)
    assert.deepEqual(snapshot(), once)
    assert.match(second.stdout, /already in \.claude\/settings\.json/)
    assert.match(second.stdout, /AGENTS\.md already has the Halation section/)
    assert.match(second.stdout, /CLAUDE\.md already points at AGENTS\.md/)
    assert.match(second.stdout, /already current/)
  })

  test("refreshes a stale Halation section in place", () => {
    const dir = tempDir()
    writeFileSync(path.join(dir, "AGENTS.md"), "Intro\n\n<!-- halation:start -->\nold words\n<!-- halation:end -->\n\nOutro\n")
    run(dir)
    const text = read(dir, "AGENTS.md")
    assert.doesNotMatch(text, /old words/)
    assert.ok(text.startsWith("Intro\n\n<!-- halation:start -->"))
    assert.ok(text.endsWith("<!-- halation:end -->\n\nOutro\n"))
    assert.equal(text.match(/halation:start/g).length, 1)
  })

  test("leaves invalid settings alone and says how to fix them", () => {
    const dir = tempDir()
    mkdirSync(path.join(dir, ".claude"))
    writeFileSync(path.join(dir, ".claude/settings.json"), "{ nope")
    const r = run(dir)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /isn't a valid JSON object.*Fix the file/)
    assert.equal(read(dir, ".claude/settings.json"), "{ nope")
  })

  test("a missing folder says what's wrong", () => {
    const r = run(tempDir(), "nowhere")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /There's no folder at nowhere\./)
  })

  test("what it writes keeps the rules itself", () => {
    const dir = tempDir()
    run(dir)
    for (const f of ["AGENTS.md", "CLAUDE.md", ".claude/skills/halation/SKILL.md"]) assert.deepEqual(lintText(read(dir, f), f), [], f)
  })
})
