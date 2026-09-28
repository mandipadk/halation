import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { lintText } from "../src/lint.js"

const BIN = fileURLToPath(new URL("../bin/halation.js", import.meta.url))

describe("halation guard --hook", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "halation-guard-"))
  after(() => rmSync(dir, { recursive: true, force: true }))
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "app", halation: { lint: ["src"] } }, null, 2))
  mkdirSync(path.join(dir, "src"))

  const guard = (payload) =>
    spawnSync(process.execPath, [BIN, "guard", "--hook"], { cwd: dir, input: typeof payload === "string" ? payload : JSON.stringify(payload), encoding: "utf8" })
  const tool = (tool_name, tool_input) => ({ session_id: "s", hook_event_name: "PreToolUse", cwd: dir, tool_name, tool_input })
  const bash = (command) => guard(tool("Bash", { command }))

  test("denies a Write to .claude/settings.json and says why", () => {
    const r = guard(tool("Write", { file_path: path.join(dir, ".claude/settings.json"), content: "{}" }))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Halation's guard stopped this edit: .*\.claude\/settings\.json is Claude Code's settings for this project, which run Halation's hooks\./)
    assert.match(r.stderr, /only the project's owner changes them/)
  })

  test("denies edits to every protected file", () => {
    for (const [name, input] of [
      ["Edit", { file_path: ".claude/settings.local.json", old_string: "a", new_string: "b" }],
      ["MultiEdit", { file_path: ".claude/settings.json", edits: [] }],
      ["Edit", { file_path: "node_modules/@halation/core/rules.json", old_string: "a", new_string: "b" }],
      ["Write", { file_path: "node_modules/@halation/cli/src/lint.js", content: "" }],
      ["Write", { file_path: "node_modules/.pnpm/@halation+core@0.2.0/node_modules/@halation/core/src/check/check.js", content: "" }],
      ["Write", { file_path: "node_modules/some-fork/rules.json", content: "[]" }],
      ["Write", { file_path: ".halation/state.json", content: "{}" }],
      ["NotebookEdit", { notebook_path: ".claude/settings.json", new_source: "" }],
      ["Write", { file_path: ".Claude/Settings.JSON", content: "{}" }],
    ]) assert.equal(guard(tool(name, input)).status, 2, `${name} ${JSON.stringify(input)}`)
  })

  test("allows ordinary edits", () => {
    for (const [name, input] of [
      ["Write", { file_path: "src/App.tsx", content: "" }],
      ["Edit", { file_path: ".claude/skills/halation/SKILL.md", old_string: "a", new_string: "b" }],
      ["Write", { file_path: ".vscode/settings.json", content: "{}" }],
      ["Edit", { file_path: "package.json", old_string: `"name": "app"`, new_string: `"name": "web"` }],
    ]) assert.equal(guard(tool(name, input)).status, 0, `${name} ${JSON.stringify(input)}`)
  })

  test("denies changing the halation settings in package.json", () => {
    assert.equal(guard(tool("Edit", { file_path: "package.json", old_string: `"lint": ["src"]`, new_string: `"halation": { "lint": [] }` })).status, 2)
    const r = guard(tool("Write", { file_path: "package.json", content: JSON.stringify({ name: "app", halation: { lint: ["docs"] } }) }))
    assert.equal(r.status, 2)
    assert.match(r.stderr, /the "halation" settings in package\.json choose what Halation lints/)
    assert.equal(guard(tool("Write", { file_path: "package.json", content: JSON.stringify({ name: "web", halation: { lint: ["src"] } }) })).status, 0)
  })

  test("denies a shell command writing the installed rulebook", () => {
    const r = bash("echo x > node_modules/@halation/core/rules.json")
    assert.equal(r.status, 2)
    assert.match(r.stderr, /Halation's guard stopped this command: it would change Halation's installed packages/)
  })

  test("denies shell commands that change protected files", () => {
    for (const command of [
      "echo '{}' >> .claude/settings.json",
      "cat new.json | tee .claude/settings.local.json",
      "sed -i '' 's/lint --hook/true/' .claude/settings.json",
      "perl -pi -e 's/exit 2/exit 0/' .claude/settings.json",
      "mv /tmp/s.json .claude/settings.json",
      "cp empty.json node_modules/@halation/core/rules.json",
      "rm -rf node_modules/@halation",
      "chmod -x node_modules/@halation/cli/bin/halation.js",
      "truncate -s 0 node_modules/@halation/core/rules.json",
      `node -e "require('fs').writeFileSync('node_modules/@halation/core/rules.json', '[]')"`,
      `python3 -c "open('.claude/settings.json', 'w').write('{}')"`,
      "cd .claude && echo '{}' > settings.json",
      "rm -rf .halation",
      "rm -rf node_modules",
      "npm uninstall @halation/cli",
      "pnpm remove @halation/core",
    ]) assert.equal(bash(command).status, 2, command)
  })

  test("allows shell commands that only read, or write elsewhere", () => {
    for (const command of [
      "cat .claude/settings.json",
      "cat .claude/settings.json 2>/dev/null | jq .hooks",
      "ls node_modules/@halation",
      "npx halation lint src",
      "echo hi > src/notes.txt",
      "rm -rf node_modules/.vite",
      "npm install",
      `node -e "console.log(require('./node_modules/@halation/core/rules.json').length)"`,
    ]) assert.equal(bash(command).status, 0, command)
  })

  test("other tools and empty payloads pass", () => {
    assert.equal(guard(tool("Read", { file_path: ".claude/settings.json" })).status, 0)
    assert.equal(guard({ tool_input: {} }).status, 0)
  })

  test("input that isn't JSON says what's wrong", () => {
    const r = guard("nope")
    assert.equal(r.status, 1)
    assert.match(r.stderr, /wasn't JSON/)
  })

  test("without --hook it says how it runs", () => {
    const r = spawnSync(process.execPath, [BIN, "guard"], { cwd: dir, encoding: "utf8" })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /halation guard --hook/)
  })

  test("its words keep the rules", () => {
    const r = guard(tool("Write", { file_path: ".claude/settings.json", content: "{}" }))
    assert.deepEqual(lintText(r.stderr, "message.md"), [])
  })
})
