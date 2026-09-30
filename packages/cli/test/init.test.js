import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, test } from "node:test"
import { fileURLToPath } from "node:url"
import { GUARD_COMMAND, HOOK_COMMAND, HOOK_SCRIPT, HOOK_SCRIPT_PATH, MCP_SERVER, mergeHook, mergeMcp, STOP_COMMAND } from "../src/init.js"
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
const halationHooks = (settings) =>
  ["PreToolUse", "PostToolUse", "Stop"].flatMap((event) => settings.hooks[event].flatMap((e) => e.hooks)).filter((h) => [GUARD_COMMAND, HOOK_COMMAND, STOP_COMMAND].includes(h.command))
const EXPECTED = {
  hooks: {
    PreToolUse: [{ matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash", hooks: [{ type: "command", command: GUARD_COMMAND }] }],
    PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: HOOK_COMMAND }] }],
    Stop: [{ hooks: [{ type: "command", command: STOP_COMMAND }] }],
  },
}

describe("halation init", () => {
  test("sets up an empty project", () => {
    const dir = tempDir()
    const r = run(dir)
    assert.equal(r.status, 0, r.stderr)
    assert.match(r.stdout, /Wrote the skill to \.claude\/skills\/halation\/SKILL\.md\./)
    assert.match(r.stdout, /npm install -D @halation\/cli/)
    assert.match(read(dir, ".claude/skills/halation/SKILL.md"), /^---\nname: halation\n/)
    assert.deepEqual(JSON.parse(read(dir, ".claude/settings.json")), EXPECTED)
    assert.match(r.stdout, /Created \.claude\/settings\.json with hooks that keep Claude Code from changing the rule files, lint each file it edits, and lint the project before it finishes\./)
    assert.match(read(dir, "AGENTS.md"), /<!-- halation:start -->\n## Design system: Halation/)
    assert.equal(read(dir, "CLAUDE.md"), "@AGENTS.md\n")
    assert.deepEqual(JSON.parse(read(dir, ".mcp.json")), { mcpServers: { halation: { command: "npx", args: ["--no-install", "halation", "mcp"] } } })
    assert.match(r.stdout, /Created \.mcp\.json with the Halation MCP server, which gives agents the rules, the scale and checks for their own work\./)
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
    assert.deepEqual(settings.hooks.PreToolUse[0], existing.hooks.PreToolUse[0])
    assert.deepEqual(settings.hooks.PostToolUse[0], existing.hooks.PostToolUse[0])
    assert.equal(halationHooks(settings).length, 3)
    assert.match(first.stdout, /Added hooks that keep Claude Code from changing the rule files.* to \.claude\/settings\.json\./)
    assert.ok(once[1].startsWith("# Agents\n\nRun the tests before committing.\n\n<!-- halation:start -->"))
    assert.equal(once[2], "Be brief.\n\n@AGENTS.md\n")

    const second = run(dir)
    assert.equal(second.status, 0)
    assert.deepEqual(snapshot(), once)
    assert.match(second.stdout, /The Halation hooks are already in \.claude\/settings\.json/)
    assert.match(second.stdout, /AGENTS\.md already has the Halation section/)
    assert.match(second.stdout, /CLAUDE\.md already points at AGENTS\.md/)
    assert.match(second.stdout, /already current/)
  })

  test("upgrades an old lint hook in place and adds the others", () => {
    const dir = tempDir()
    mkdirSync(path.join(dir, ".claude"))
    const old = { hooks: { PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: "npx --no-install halation lint --hook" }] }] } }
    writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify(old))
    const r = run(dir)
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(JSON.parse(read(dir, ".claude/settings.json")), EXPECTED)
  })

  test("says when it only updated a hook", () => {
    const settings = structuredClone(EXPECTED)
    settings.hooks.Stop[0].hooks[0].command = "npx --no-install halation lint --stop"
    assert.equal(mergeHook(settings), "updated")
    assert.deepEqual(settings, EXPECTED)
    assert.equal(mergeHook(settings), false)
    const dir = tempDir()
    mkdirSync(path.join(dir, ".claude"))
    writeFileSync(path.join(dir, ".claude/settings.json"), JSON.stringify({ hooks: { ...EXPECTED.hooks, PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "halation guard --hook" }] }] } }))
    assert.match(run(dir).stdout, /Updated the Halation hooks in \.claude\/settings\.json\./)
    assert.deepEqual(JSON.parse(read(dir, ".claude/settings.json")), EXPECTED)
  })

  test("leaves a hook someone else shares an entry with where it is", () => {
    const settings = { hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "prettier --write" }, { type: "command", command: "npx --no-install halation lint --hook" }] }] } }
    mergeHook(settings)
    assert.equal(settings.hooks.PostToolUse.length, 1)
    assert.equal(settings.hooks.PostToolUse[0].matcher, "Write")
    assert.equal(settings.hooks.PostToolUse[0].hooks[1].command, HOOK_COMMAND)
  })

  test("the template's settings are exactly what init writes", () => {
    const template = fileURLToPath(new URL("../../create/template/.claude/settings.json", import.meta.url))
    const text = readFileSync(template, "utf8")
    const settings = JSON.parse(text)
    assert.equal(mergeHook(settings), false)
    assert.equal(`${JSON.stringify(settings, null, 2)}\n`, text)
    const dir = tempDir()
    run(dir)
    assert.equal(read(dir, ".claude/settings.json"), text)
  })

  describe(".mcp.json", () => {
    test("adds the server beside the ones already there, and running twice changes nothing", () => {
      const dir = tempDir()
      const other = { command: "node", args: ["tools/server.js"], env: { TOKEN_FILE: ".token" } }
      writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { tools: other }, extra: true }))
      const first = run(dir)
      assert.equal(first.status, 0, first.stderr)
      assert.match(first.stdout, /Added the Halation MCP server to \.mcp\.json\. It gives agents the rules, the scale and checks for their own work\./)
      const once = read(dir, ".mcp.json")
      assert.deepEqual(JSON.parse(once), { mcpServers: { tools: other, halation: MCP_SERVER }, extra: true })
      const second = run(dir)
      assert.match(second.stdout, /The Halation MCP server is already in \.mcp\.json\./)
      assert.equal(read(dir, ".mcp.json"), once)
    })

    test("brings an older entry up to date", () => {
      const dir = tempDir()
      writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { halation: { command: "halation", args: ["mcp"] } } }))
      const r = run(dir)
      assert.match(r.stdout, /Updated the Halation MCP server in \.mcp\.json\./)
      assert.deepEqual(JSON.parse(read(dir, ".mcp.json")), { mcpServers: { halation: MCP_SERVER } })
      const config = { mcpServers: { halation: structuredClone(MCP_SERVER) } }
      assert.equal(mergeMcp(config), false)
      assert.equal(mergeMcp({}), "added")
    })

    test("an empty file gets the server, and a broken one is left alone", () => {
      const empty = tempDir()
      writeFileSync(path.join(empty, ".mcp.json"), "")
      assert.equal(run(empty).status, 0)
      assert.deepEqual(JSON.parse(read(empty, ".mcp.json")), { mcpServers: { halation: MCP_SERVER } })
      for (const text of ["{ nope", JSON.stringify({ mcpServers: [] })]) {
        const dir = tempDir()
        writeFileSync(path.join(dir, ".mcp.json"), text)
        const r = run(dir)
        assert.equal(r.status, 1)
        assert.match(r.stderr, /\.mcp\.json.*Fix (the file|it)/)
        assert.equal(read(dir, ".mcp.json"), text)
      }
    })

    test("the starter ships what init writes", () => {
      const shipped = readFileSync(fileURLToPath(new URL("../../create/template/.mcp.json", import.meta.url)), "utf8")
      const dir = tempDir()
      run(dir)
      assert.equal(read(dir, ".mcp.json"), shipped)
    })
  })

  describe("the hook script", () => {
    // A project with the script, and a PATH whose npx never finds Halation, so only node_modules counts.
    const project = (cli) => {
      const dir = tempDir()
      mkdirSync(path.join(dir, ".halation"), { recursive: true })
      writeFileSync(path.join(dir, HOOK_SCRIPT_PATH), HOOK_SCRIPT)
      const stubs = path.join(dir, ".stubs")
      mkdirSync(stubs)
      writeFileSync(path.join(stubs, "npx"), "#!/bin/sh\nexit 1\n")
      chmodSync(path.join(stubs, "npx"), 0o755)
      if (cli) {
        mkdirSync(path.join(dir, "node_modules/.bin"), { recursive: true })
        writeFileSync(path.join(dir, "node_modules/.bin/halation"), cli)
        chmodSync(path.join(dir, "node_modules/.bin/halation"), 0o755)
      }
      return dir
    }
    const real = `#!/bin/sh\nexec "${process.execPath}" "${BIN}" "$@"\n`
    const hook = (dir, command, payload) =>
      spawnSync("sh", ["-c", command], { cwd: dir, input: JSON.stringify(payload), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir, PATH: `${path.join(dir, ".stubs")}:/usr/bin:/bin` } })
    const bash = (command) => ({ tool_name: "Bash", tool_input: { command } })

    test("before Halation is installed, only an install gets through", () => {
      const dir = project()
      for (const c of ["npm install", "pnpm i", "yarn add -D @halation/cli", "bun install"]) assert.equal(hook(dir, GUARD_COMMAND, bash(c)).status, 0, c)
      for (const c of ["ls", "echo hi > src/app.css", "npm run build"]) {
        const r = hook(dir, GUARD_COMMAND, bash(c))
        assert.equal(r.status, 2, c)
        assert.match(r.stderr, /Halation isn't installed in this project, or couldn't run/)
      }
      assert.equal(hook(dir, GUARD_COMMAND, { tool_name: "Write", tool_input: { file_path: "src/app.css", content: "" } }).status, 2)
      assert.equal(hook(dir, HOOK_COMMAND, { tool_name: "Write", tool_input: { file_path: "src/app.css" } }).status, 2)
    })

    test("the finish check can't loop: the second try ends the turn, with a note", () => {
      const dir = project()
      const first = hook(dir, STOP_COMMAND, { stop_hook_active: false })
      assert.equal(first.status, 2)
      assert.match(first.stderr, /can't be checked/)
      const again = hook(dir, STOP_COMMAND, { stop_hook_active: true })
      assert.equal(again.status, 0)
      assert.match(JSON.parse(again.stdout).systemMessage, /not checked before this turn ended/)
    })

    test("a CLI that crashes counts as one that can't run", () => {
      const dir = project("#!/bin/sh\nexit 1\n")
      assert.equal(hook(dir, GUARD_COMMAND, bash("ls")).status, 2)
      assert.equal(hook(dir, GUARD_COMMAND, bash("npm install")).status, 0)
      assert.equal(hook(dir, STOP_COMMAND, { stop_hook_active: true }).status, 0)
    })

    test("once installed, Halation decides", () => {
      const dir = project(real)
      assert.equal(hook(dir, GUARD_COMMAND, bash("ls")).status, 0)
      assert.equal(hook(dir, GUARD_COMMAND, { tool_name: "Write", tool_input: { file_path: path.join(dir, "src/app.css"), content: "" } }).status, 0)
      const settings = hook(dir, GUARD_COMMAND, { tool_name: "Edit", tool_input: { file_path: path.join(dir, ".claude/settings.json") } })
      assert.equal(settings.status, 2)
      const script = hook(dir, GUARD_COMMAND, bash(`echo 'exit 0' > ${HOOK_SCRIPT_PATH}`))
      assert.equal(script.status, 2)
      assert.equal(hook(dir, GUARD_COMMAND, { tool_name: "Write", tool_input: { file_path: path.join(dir, HOOK_SCRIPT_PATH), content: "exit 0" } }).status, 2)
    })

    test("the starter ships the current script", () => {
      const shipped = readFileSync(fileURLToPath(new URL("../../create/template/.halation/hooks.sh", import.meta.url)), "utf8")
      assert.equal(shipped, HOOK_SCRIPT)
    })

    test("without the script, every hook blocks", () => {
      const dir = project(real)
      rmSync(path.join(dir, HOOK_SCRIPT_PATH))
      for (const command of [GUARD_COMMAND, HOOK_COMMAND, STOP_COMMAND]) assert.equal(hook(dir, command, bash("ls")).status, 2, command)
    })
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
