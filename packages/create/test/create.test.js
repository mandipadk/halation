import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { create, packageNameFromDir, titleFromDir } from "../bin/create-halation.js"

const BIN = fileURLToPath(new URL("../bin/create-halation.js", import.meta.url))
const root = mkdtempSync(join(tmpdir(), "create-halation-"))
after(() => rmSync(root, { recursive: true, force: true }))

const read = (...p) => readFileSync(join(...p), "utf8")

test("creates a project from the template with the directory's name", () => {
  const dir = join(root, "acme-notes")
  const out = execFileSync(process.execPath, [BIN, dir], { encoding: "utf8", env: { ...process.env, npm_config_user_agent: "pnpm/11.0.0" } })

  for (const file of ["package.json", "index.html", "tsconfig.json", "vite.config.ts", "README.md", "AGENTS.md", "CLAUDE.md", ".gitignore", "src/main.tsx", "src/App.tsx", "src/project.ts", "src/app.css", ".claude/settings.json", ".claude/skills/halation/SKILL.md"]) {
    assert.ok(existsSync(join(dir, file)), `${file} is missing`)
  }
  assert.ok(!existsSync(join(dir, "_gitignore")), "_gitignore should be renamed")

  assert.equal(JSON.parse(read(dir, "package.json")).name, "acme-notes")
  assert.match(read(dir, "src/project.ts"), /name: "Acme Notes",/)
  assert.match(read(dir, "src/project.ts"), /phenomenon: "rays",/)
  assert.match(read(dir, "index.html"), /<title>Acme Notes<\/title>/)
  assert.match(read(dir, "README.md"), /^# Acme Notes/)
  assert.equal(read(dir, "CLAUDE.md").trim(), "@AGENTS.md")

  const hook = JSON.parse(read(dir, ".claude/settings.json")).hooks.PostToolUse[0]
  assert.equal(hook.matcher, "Edit|Write|MultiEdit")
  assert.equal(hook.hooks[0].command, "npx --no-install halation lint --hook")

  assert.match(out, /pnpm install/)
  assert.match(out, /pnpm dev/)
  assert.match(out, /Claude Code is already set up/)
})

test("--name and --phenomenon are written into the app", () => {
  const dir = join(root, "second")
  execFileSync(process.execPath, [BIN, dir, "--name", `Tom's "field" notes`, "--phenomenon", "caustics"], { encoding: "utf8" })
  const projectFile = read(dir, "src/project.ts")
  assert.ok(projectFile.includes(`name: "Tom's \\"field\\" notes",`))
  assert.match(projectFile, /phenomenon: "caustics",/)
  assert.match(read(dir, "index.html"), /<title>Tom's &quot;field&quot; notes<\/title>/)
  assert.equal(JSON.parse(read(dir, "package.json")).name, "second")
})

test("refuses a directory that already has files in it", () => {
  const dir = join(root, "busy")
  mkdirSync(dir)
  writeFileSync(join(dir, "notes.txt"), "keep me")
  const result = spawnSync(process.execPath, [BIN, dir], { encoding: "utf8" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /already has files/)
  assert.equal(read(dir, "notes.txt"), "keep me")
  assert.ok(!existsSync(join(dir, "package.json")))
})

test("accepts an empty existing directory", () => {
  const dir = join(root, "empty")
  mkdirSync(dir)
  create(dir, { name: "Empty" })
  assert.ok(existsSync(join(dir, "src/App.tsx")))
})

test("rejects an unknown phenomenon", () => {
  const result = spawnSync(process.execPath, [BIN, join(root, "nope"), "--phenomenon", "lasers"], { encoding: "utf8" })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /no phenomenon called "lasers"/)
  assert.ok(!existsSync(join(root, "nope")))
})

test("names come from the directory", () => {
  assert.equal(titleFromDir("/x/my_cool-app"), "My Cool App")
  assert.equal(packageNameFromDir("/x/My Cool App!"), "my-cool-app")
  assert.equal(packageNameFromDir("/x/.hidden"), "hidden")
})
