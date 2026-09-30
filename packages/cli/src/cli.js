// The command line: parses arguments and hands off to each command.

import { readFileSync } from "node:fs"
import { checkUrl, formatCheck, toUrl } from "./check.js"
import { init } from "./init.js"
import { formatGate, gate } from "./gate.js"
import { guardHook } from "./guard.js"
import { formatReport, lintFiles, lintHook, lintStop, UsageError } from "./lint.js"
import { loadRules } from "./rules.js"
import { renderSkill } from "./skill.js"

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version

const HELP = {
  main: `Halation keeps a project on its design rules.

Usage: halation <command> [options]

Commands
  lint [paths...]   Check source files against the rulebook
  check <url>       Check a rendered page in a headless browser
  gate [dirs...]    Check what a build emitted: its CSS and the styles in its HTML
  rules             Print every rule with its reason
  skill             Print the Claude Code skill for this design system
  init [dir]        Set a project up for agents: skill, hooks, AGENTS.md
  guard --hook      Keep agents from changing the rule files (a Claude Code hook)

Options
  -h, --help        Show help for a command, as in halation lint --help
  -v, --version     Show the version

Run halation <command> --help for a command's options.
`,
  lint: `Check source files against the rulebook's detectors.

Usage: halation lint [paths...] [--json]
       halation lint --hook
       halation lint --stop

Reads the files and folders given (the current folder by default), skipping
node_modules, .git, .claude, and build output at the top of a package. Prints
each problem as file:line:column, the rule and what it says, then why the
rule exists and what to do instead.

Options
  --json    Print the findings as JSON
  --hook    Claude Code hook mode: read the hook's JSON on stdin, lint the
            edited file, and exit 2 with the problems on stderr, warnings
            included, so the agent fixes them
  --stop    Claude Code Stop hook mode: lint the project (src, or the paths
            in package.json under "halation": { "lint": [...] }) and exit 2
            with the problems on stderr, so the agent can't finish with them

A comment saying halation-ignore R9 and why, on a line or the line above it,
skips that rule there. An exception that names no rule skips nothing and is
reported itself. Exits 1 when there's an error; warnings don't fail.
`,
  check: `Check a rendered page against the rules a browser can measure.

Usage: halation check <url> [--json] [--mode light|dark] [--width <px>]

Loads the page in headless Chrome (through playwright-core, which you
install alongside the CLI) in light and dark mode, at a desktop width
(1280 px) and a phone width (375 px), runs the checker, and reports each
rule as kept or broken, with example elements, and the budgets. The url can
be an address, a host and port, or a local HTML file.

Options
  --json                    Print the results as JSON
  --mode <mode>             Check only light or only dark mode
  --width <px>              Check only this width
  --allow-counterexamples   Let elements inside [data-counterexample] break
                            the rules, for docs that show what not to do.
                            They're still counted in the report.

Exits 1 when a rule is broken or a budget is over its limit.
`,
  gate: `Check what a build emitted against the rules a style sheet can show.

Usage: halation gate [dirs...] [--json]

Run it after the project builds. It reads every .css file in the folders
given, and the <style> blocks and style attributes of every .html file, and
checks each declaration: literal colors, sizes outside the text styles,
added letter-spacing, uppercase, gradients, glowing text, fonts outside the
lens, spacing off the grid and radii off the scale. Whatever wrote the style
(a Tailwind arbitrary value like text-[13px], a library, a template), this
is where it shows up.

Without a folder it reads the first of dist, build, out, .next/static and
.output/public that exists.

Halation's own styles pass because they match @halation/core's CSS
declaration for declaration, not because of their class names: a new rule
for an hl- class is checked like any other.

Options
  --json                    Print the findings as JSON
  --allow-counterexamples   Skip rules whose selectors are all inside, or on,
                            a [data-counterexample] element, for docs that
                            show what not to do. They're still counted in
                            the report.

Exits 1 when a declaration breaks a rule, or when there's nothing to read.
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
  adds hooks to .claude/settings.json that keep Claude Code from changing
    the rule files, lint each file it edits, and lint the project before it
    finishes
  adds a Halation section to AGENTS.md, creating it if needed
  makes sure CLAUDE.md includes @AGENTS.md

Running it again updates what it wrote and never adds anything twice.
`,
  guard: `Keep agents from changing the files that hold the project's rules.

Usage: halation guard --hook

A Claude Code PreToolUse hook. It reads the hook's JSON on stdin and exits 2,
which blocks the tool, when an edit or a shell command would change
.claude/settings.json, .claude/settings.local.json, Halation's packages in
node_modules, an installed rulebook, the .halation folder, or the "halation"
settings in package.json. halation init adds it.
`,
}

const OPTIONS = {
  lint: { json: false, hook: false, stop: false },
  guard: { hook: false },
  check: { json: false, mode: "value", width: "value", "allow-counterexamples": false },
  gate: { json: false, "allow-counterexamples": false },
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
        if (flags.hook && flags.stop) throw new UsageError("halation lint takes --hook or --stop, not both.")
        if (flags.stop) {
          const { code, stdout, stderr } = lintStop(process.stdin.isTTY ? "" : await readStdin())
          if (stdout) io.out(stdout)
          if (stderr) io.err(stderr)
          return code
        }
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
      case "guard": {
        if (!flags.hook || positional.length) throw new UsageError("halation guard runs as a Claude Code hook, as halation guard --hook. Run halation init to add it.")
        if (process.stdin.isTTY) {
          io.err("halation guard --hook reads the JSON a Claude Code hook sends on stdin. Run halation init to add the hook.\n")
          return 1
        }
        const { code, stderr } = guardHook(await readStdin())
        if (stderr) io.err(stderr)
        return code
      }
      case "check": {
        if (positional.length !== 1) throw new UsageError(`halation check needs one address to load, as in halation check http://localhost:3000.`)
        if (flags.mode && !["light", "dark"].includes(flags.mode)) throw new UsageError(`--mode is light or dark, not ${flags.mode}.`)
        const width = flags.width === undefined ? undefined : Number(flags.width)
        if (width !== undefined && !(Number.isInteger(width) && width >= 240 && width <= 3840)) throw new UsageError(`--width is a whole number of pixels from 240 to 3840, not ${flags.width}.`)
        let result
        try {
          result = await checkUrl(toUrl(positional[0]), {
            modes: flags.mode ? [flags.mode] : ["light", "dark"],
            widths: width ? [width] : undefined,
            counterexamples: !!flags["allow-counterexamples"],
          })
        } catch (e) {
          io.err(`${e.message}\n`)
          return 1
        }
        io.out(flags.json ? `${JSON.stringify(result, null, 2)}\n` : formatCheck(result))
        return result.pass ? 0 : 1
      }
      case "gate": {
        const result = gate(positional, { counterexamples: !!flags["allow-counterexamples"] })
        if (!result.files) {
          io.err(formatGate(result))
          return 1
        }
        if (flags.json) {
          const rules = loadRules()
          const used = new Set(result.findings.map((f) => f.rule))
          const why = Object.fromEntries(rules.filter((r) => used.has(r.id)).map((r) => [r.id, { slug: r.slug, says: r.says, why: r.why, instead: r.instead }]))
          io.out(`${JSON.stringify({ dirs: result.dirs, files: result.files, errors: result.findings.length, exempted: result.exempted, findings: result.findings, rules: why }, null, 2)}\n`)
        } else io.out(formatGate(result, loadRules()))
        return result.findings.length ? 1 : 0
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
