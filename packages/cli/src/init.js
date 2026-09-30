// `halation init`: sets a project up so agents working in it follow the
// rules: the skill, hooks that guard the rule files, lint every edit and lint
// the project before the agent finishes, and a note in AGENTS.md. Safe to
// run again: it updates what it wrote and never duplicates.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { UsageError } from "./lint.js"
import { renderSkill } from "./skill.js"

/**
 * The hooks run through one script in the project, so a hook that can't run
 * blocks with a reason instead of passing. It tells "Halation said no" apart
 * from "Halation isn't installed or couldn't run": then only an install is
 * allowed, and the finish check lets the turn end on its second
 * try with a note, rather than sending the agent back forever. The guard keeps
 * agents from editing it.
 */
export const HOOK_SCRIPT = `#!/bin/sh
# Halation's hooks for Claude Code, written by halation init. Takes guard, lint or stop.
cd "\${CLAUDE_PROJECT_DIR:-.}" || exit 2
input=$(cat)
run() {
  if [ -x node_modules/.bin/halation ]; then printf '%s' "$input" | node_modules/.bin/halation "$@"; return $?; fi
  if npx --no-install halation --version </dev/null >/dev/null 2>&1; then printf '%s' "$input" | npx --no-install halation "$@"; return $?; fi
  return 127
}
case "$1" in
  guard) run guard --hook ;;
  lint) run lint --hook ;;
  stop) run lint --stop ;;
  *) echo "hooks.sh takes guard, lint or stop." >&2; exit 2 ;;
esac
status=$?
[ "$status" -eq 0 ] && exit 0
[ "$status" -eq 2 ] && exit 2
# Halation isn't installed, or couldn't run.
case "$1" in
  guard)
    printf '%s' "$input" | grep -Eq '"command"[[:space:]]*:[[:space:]]*"(npm|pnpm|yarn|bun)[[:space:]]+(install|i|ci|add)([[:space:]"]|$)' && exit 0
    echo "Halation isn't installed in this project, or couldn't run, so changes are blocked until it can. Install the project's dependencies first, with npm install or your package manager's install." >&2
    exit 2 ;;
  stop)
    if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
      echo '{"systemMessage": "Halation is not installed or could not run, so the design rules were not checked before this turn ended."}'
      exit 0
    fi
    echo "Halation isn't installed or couldn't run, so the design rules can't be checked. Install the project's dependencies, then finish." >&2
    exit 2 ;;
  *)
    echo "Halation isn't installed or couldn't run, so this change wasn't linted. Install the project's dependencies." >&2
    exit 2 ;;
esac
`
export const HOOK_SCRIPT_PATH = ".halation/hooks.sh"
const hook = (name) => `sh "\${CLAUDE_PROJECT_DIR:-.}/${HOOK_SCRIPT_PATH}" ${name} || exit 2`
export const GUARD_COMMAND = hook("guard")
export const HOOK_COMMAND = hook("lint")
export const STOP_COMMAND = hook("stop")

export const GUARD = { matcher: "Edit|Write|MultiEdit|NotebookEdit|Bash", hooks: [{ type: "command", command: GUARD_COMMAND }] }
export const HOOK = { matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: HOOK_COMMAND }] }
export const STOP = { hooks: [{ type: "command", command: STOP_COMMAND }] }

/** Every hook init adds: the event, the entry, and how to recognize an earlier version of it. */
export const HOOKS = [
  { event: "PreToolUse", entry: GUARD, mark: /\bhalation guard --hook\b|\.halation\/hooks\.sh"? guard\b/ },
  { event: "PostToolUse", entry: HOOK, mark: /\bhalation lint --hook\b|\.halation\/hooks\.sh"? lint\b/ },
  { event: "Stop", entry: STOP, mark: /\bhalation lint --stop\b|\.halation\/hooks\.sh"? stop\b/ },
]

const START = "<!-- halation:start -->"
const END = "<!-- halation:end -->"

export const AGENTS_SECTION = `${START}
## Design system: Halation

This project's UI follows Halation. Before building or changing any interface, read \`.claude/skills/halation/SKILL.md\`: the rules, the components and what to use for what.

- Reach for \`@halation/react\` before writing markup: \`Facts\` for metadata, \`State\` for status, \`Keys\` for shortcuts, \`Stage\` for a hero atmosphere, one ink \`Button\` for the main action.
- Use the eleven text styles and the color roles. No other font sizes, no literal colors, gradients, uppercase labels or added letter-spacing.
- Run \`npx halation lint\` before you finish; it exits 1 when a rule is broken. With the app running, \`npx halation check <url>\` measures the rendered page.
- After building, run \`npx halation gate dist\` (or the build's folder); it reads what the build emitted and exits 1 when a style is off the system.
- \`npx halation rules\` prints every rule with its reason. A deliberate exception gets a comment saying \`halation-ignore\` and the rule id on that line or the line above.
${END}
`

function readJson(file) {
  const text = readFileSync(file, "utf8")
  if (!text.trim()) return {}
  try {
    const value = JSON.parse(text)
    if (value && typeof value === "object" && !Array.isArray(value)) return value
  } catch {}
  throw new UsageError(`${file} isn't a valid JSON object, so the hooks weren't added. Fix the file (or remove it) and run halation init again.`)
}

/**
 * Adds Halation's hooks to a settings object in place, and brings an older
 * version of one up to date where it stands. Returns "added", "updated", or
 * false when everything was already there.
 */
export function mergeHook(settings) {
  settings.hooks ??= {}
  if (typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) throw new UsageError(`The "hooks" entry in .claude/settings.json isn't an object. Fix it and run halation init again.`)
  let result = false
  for (const { event, entry, mark } of HOOKS) {
    settings.hooks[event] ??= []
    const list = settings.hooks[event]
    if (!Array.isArray(list)) throw new UsageError(`The "hooks.${event}" entry in .claude/settings.json isn't a list. Fix it and run halation init again.`)
    const ours = list.flatMap((e) => (Array.isArray(e?.hooks) ? e.hooks.map((h) => [e, h]) : [])).filter(([, h]) => typeof h?.command === "string" && mark.test(h.command))
    if (!ours.length) {
      list.push(structuredClone(entry))
      result = "added"
      continue
    }
    for (const [e, h] of ours) {
      const command = entry.hooks[0].command
      if (h.command !== command) {
        h.command = command
        result ||= "updated"
      }
      if (e.hooks.length === 1 && entry.matcher && e.matcher !== entry.matcher) {
        e.matcher = entry.matcher
        result ||= "updated"
      }
    }
  }
  return result
}

/** Sets up `dir`. Returns the list of things it did, as sentences. */
export async function init(dir = ".", { cwd = process.cwd() } = {}) {
  const root = path.resolve(cwd, dir)
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new UsageError(`There's no folder at ${dir}. Create it, or pass the folder of an existing project, and run halation init again.`)
  const done = []
  const write = (file, text) => {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, text)
  }

  // The skill.
  const skillFile = path.join(root, ".claude/skills/halation/SKILL.md")
  const skill = await renderSkill()
  if (!existsSync(skillFile)) {
    write(skillFile, skill)
    done.push("Wrote the skill to .claude/skills/halation/SKILL.md.")
  } else if (readFileSync(skillFile, "utf8") !== skill) {
    write(skillFile, skill)
    done.push("Updated the skill in .claude/skills/halation/SKILL.md.")
  } else done.push("The skill in .claude/skills/halation/SKILL.md is already current.")

  // The hooks, and the script they run.
  const scriptFile = path.join(root, HOOK_SCRIPT_PATH)
  if (!existsSync(scriptFile) || readFileSync(scriptFile, "utf8") !== HOOK_SCRIPT) {
    const had = existsSync(scriptFile)
    write(scriptFile, HOOK_SCRIPT)
    done.push(`${had ? "Updated" : "Wrote"} the script the hooks run, ${HOOK_SCRIPT_PATH}.`)
  }
  const settingsFile = path.join(root, ".claude/settings.json")
  const existed = existsSync(settingsFile)
  const settings = existed ? readJson(settingsFile) : {}
  const merged = mergeHook(settings)
  const hooks = "hooks that keep Claude Code from changing the rule files, lint each file it edits, and lint the project before it finishes"
  if (merged) write(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
  if (!existed) done.push(`Created .claude/settings.json with ${hooks}.`)
  else if (merged === "added") done.push(`Added ${hooks} to .claude/settings.json.`)
  else if (merged === "updated") done.push("Updated the Halation hooks in .claude/settings.json.")
  else done.push("The Halation hooks are already in .claude/settings.json.")

  // AGENTS.md.
  const agentsFile = path.join(root, "AGENTS.md")
  if (!existsSync(agentsFile)) {
    write(agentsFile, `# Agents\n\n${AGENTS_SECTION}`)
    done.push("Created AGENTS.md with a Halation section.")
  } else {
    const text = readFileSync(agentsFile, "utf8")
    const start = text.indexOf(START)
    const end = text.indexOf(END, start)
    if (start === -1 || end === -1) {
      write(agentsFile, `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}${AGENTS_SECTION}`)
      done.push("Added a Halation section to AGENTS.md.")
    } else {
      const next = `${text.slice(0, start)}${AGENTS_SECTION.trimEnd()}${text.slice(end + END.length)}`
      if (next !== text) {
        write(agentsFile, next)
        done.push("Updated the Halation section in AGENTS.md.")
      } else done.push("AGENTS.md already has the Halation section.")
    }
  }

  // CLAUDE.md points at AGENTS.md.
  const claudeFile = path.join(root, "CLAUDE.md")
  if (!existsSync(claudeFile)) {
    write(claudeFile, "@AGENTS.md\n")
    done.push("Created CLAUDE.md, which points Claude Code at AGENTS.md.")
  } else {
    const text = readFileSync(claudeFile, "utf8")
    if (/^\s*@AGENTS\.md\s*$/m.test(text)) done.push("CLAUDE.md already points at AGENTS.md.")
    else {
      write(claudeFile, `${text.replace(/\s*$/, "")}${text.trim() ? "\n\n" : ""}@AGENTS.md\n`)
      done.push("Added @AGENTS.md to CLAUDE.md.")
    }
  }

  return { root, done, cliInstalled: hasCli(root) }
}

function hasCli(root) {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))
    return Boolean(pkg.dependencies?.["@halation/cli"] || pkg.devDependencies?.["@halation/cli"])
  } catch {
    return false
  }
}
