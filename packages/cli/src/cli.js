// The command line: parses arguments and hands off to each command.

import { readFileSync } from "node:fs"
import { checkUrl, formatCheck, toUrl } from "./check.js"
import { init } from "./init.js"
import { formatReport, lintFiles, lintHook, UsageError } from "./lint.js"
import { loadRules } from "./rules.js"
import { renderSkill } from "./skill.js"

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version

const HELP = {
  main: `Halation keeps a project on its design rules.

Usage: halation <command> [options]

Commands
  lint [paths...]   Check source files against the rulebook
  check <url>       Check a rendered page in a headless browser
  rules             Print every rule with its reason
  skill             Print the Claude Code skill for this design system
  init [dir]        Set a project up for agents: skill, lint hook, AGENTS.md

Options
  -h, --help        Show help for a command, as in halation lint --help
  -v, --version     Show the version

Run halation <command> --help for a command's options.
`,
  lint: `Check source files against the rulebook's detectors.

Usage: halation lint [paths...] [--json]
       halation lint --hook

Reads the files and folders given (the current folder by default), skipping
node_modules, build output and hidden folders. Prints each problem as
file:line:column, the rule and what it says, then why the rule exists and
what to do instead.

Options
  --json    Print the findings as JSON
  --hook    Claude Code hook mode: read the hook's JSON on stdin, lint the
            edited file, and exit 2 with the problems on stderr so the agent
            fixes them

A comment saying halation-ignore R9 on a line, or the line above it, skips
that rule there. Exits 1 when there's an error; warnings don't fail.
`,
  check: `Check a rendered page against the rules a browser can measure.

Usage: halation check <url> [--json] [--mode light|dark]

Loads the page in headless Chrome (through playwright-core, which you
install alongside the CLI) in light and dark mode, runs the checker, and
reports each rule as kept or broken, with example elements, and the
budgets. The url can be an address, a host and port, or a local HTML file.

Options
  --json          Print the results as JSON
  --mode <mode>   Check only light or only dark mode

Exits 1 when a rule is broken or a budget is over its limit.
`,
  rules: `Print every rule: what it says, why, what to do instead, and what catches it.

Usage: halation rules [--json]

Options
  --json    Print the rulebook as JSON
`,
  skill: `Print a SKILL.md for Claude Code, generated from the rulebook and the components.

Usage: halation skill > .claude/skills/halation/SKILL.md

halation init writes it for you.
`,
  init: `Set a project up so agents working in it keep the rules.

Usage: halation init [dir]

In the project folder (the current one by default) it:
  writes .claude/skills/halation/SKILL.md
  adds a hook to .claude/settings.json that lints each file Claude Code edits
  adds a Halation section to AGENTS.md, creating it if needed
  makes sure CLAUDE.md includes @AGENTS.md

Running it again updates what it wrote and never adds anything twice.
`,
}

const OPTIONS = {
  lint: { json: false, hook: false },
  check: { json: false, mode: "value" },
  rules: { json: false },
  skill: {},
  init: {},
}

function parse(command, argv) {
  const known = OPTIONS[command]
  const flags = {}
  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "-h" || arg === "--help") flags.help = true
    else if (arg === "--") positional.push(...argv.slice(i + 1)), (i = argv.length)
    else if (arg.startsWith("-")) {
      const [name, inline] = arg.replace(/^--?/, "").split("=", 2)
      if (!(name in known)) throw new UsageError(`halation ${command} has no ${arg} option. Run halation ${command} --help to see the options.`)
      if (known[name] === "value") {
        const value = inline ?? argv[++i]
        if (value === undefined) throw new UsageError(`${arg} needs a value. Run halation ${command} --help to see the options.`)
        flags[name] = value
      } else flags[name] = true
    } else positional.push(arg)
  }
  return { flags, positional }
}

const readStdin = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

/** Runs the CLI. Returns the exit code. */
export async function main(argv, io = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) }) {
  const [command, ...rest] = argv
  if (!command || command === "-h" || command === "--help" || command === "help") {
    const topic = command === "help" && rest[0] in HELP ? rest[0] : "main"
    io.out(HELP[topic])
    return 0
  }
  if (command === "-v" || command === "--version") {
    io.out(`${VERSION}\n`)
    return 0
  }
  if (!(command in OPTIONS)) {
    io.err(`There's no command called ${command}.\n\n${HELP.main}`)
    return 1
  }
  try {
    const { flags, positional } = parse(command, rest)
    if (flags.help) {
      io.out(HELP[command])
      return 0
    }
    switch (command) {
      case "lint": {
        if (flags.hook) {
          if (process.stdin.isTTY) {
            io.err("halation lint --hook reads the JSON a Claude Code hook sends on stdin. Run halation init to add the hook, or run halation lint with a path instead.\n")
            return 1
          }
          const { code, stderr } = lintHook(await readStdin())
          if (stderr) io.err(stderr)
          return code
        }
        const result = lintFiles(positional)
        if (flags.json) {
          const rules = loadRules()
          const used = new Set(result.findings.map((f) => f.rule))
          const why = Object.fromEntries(rules.filter((r) => used.has(r.id)).map((r) => [r.id, { slug: r.slug, says: r.says, why: r.why, instead: r.instead }]))
          const errors = result.findings.filter((f) => f.level === "error").length
          io.out(`${JSON.stringify({ files: result.files, errors, warnings: result.findings.length - errors, findings: result.findings, rules: why }, null, 2)}\n`)
        } else io.out(formatReport(result, loadRules()))
        return result.findings.some((f) => f.level === "error") ? 1 : 0
      }
      case "check": {
        if (positional.length !== 1) throw new UsageError(`halation check needs one address to load, as in halation check http://localhost:3000.`)
        if (flags.mode && !["light", "dark"].includes(flags.mode)) throw new UsageError(`--mode is light or dark, not ${flags.mode}.`)
        let result
        try {
          result = await checkUrl(toUrl(positional[0]), { modes: flags.mode ? [flags.mode] : ["light", "dark"] })
        } catch (e) {
          io.err(`${e.message}\n`)
          return 1
        }
        io.out(flags.json ? `${JSON.stringify(result, null, 2)}\n` : formatCheck(result))
        return result.pass ? 0 : 1
      }
      case "rules": {
        const rules = loadRules()
        if (flags.json) {
          io.out(`${JSON.stringify(rules, null, 2)}\n`)
          return 0
        }
        const lines = []
        for (const r of rules) {
          lines.push(`${r.id}  ${r.says}`, `    Why: ${r.why}`, `    Instead: ${r.instead}`, `    Caught by: ${r.caught.map((c, i) => (i ? c.toLowerCase() : c)).join(", ")}${r.lint?.length ? " (halation lint has a detector)" : ""}`, "")
        }
        io.out(lines.join("\n"))
        return 0
      }
      case "skill": {
        if (positional.length) throw new UsageError("halation skill takes no arguments; it prints to stdout. Redirect it to a file, or run halation init.")
        io.out(await renderSkill())
        return 0
      }
      case "init": {
        if (positional.length > 1) throw new UsageError("halation init takes one folder at most, as in halation init my-app.")
        const { root, done, cliInstalled } = await init(positional[0] ?? ".")
        io.out(`Set up Halation for agents in ${root}\n${done.map((d) => `  ${d}`).join("\n")}\n`)
        if (!cliInstalled) io.out("The hook runs the CLI from this project, so install it here too: npm install -D @halation/cli\n")
        return 0
      }
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`${e.message}\n`)
      return 1
    }
    throw e
  }
  return 1
}
