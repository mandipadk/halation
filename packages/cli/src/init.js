// `halation init`: sets a project up so agents working in it follow the
// rules: the skill, a lint hook after every edit, and a note in AGENTS.md.
// Safe to run again: it updates what it wrote and never duplicates.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { UsageError } from "./lint.js"
import { renderSkill } from "./skill.js"

export const HOOK_COMMAND = "npx --no-install halation lint --hook"
export const HOOK = { matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: HOOK_COMMAND }] }

const START = "<!-- halation:start -->"
const END = "<!-- halation:end -->"

export const AGENTS_SECTION = `${START}
## Design system: Halation

This project's UI follows Halation. Before building or changing any interface, read \`.claude/skills/halation/SKILL.md\`: the rules, the components and what to use for what.

- Reach for \`@halation/react\` before writing markup: \`Facts\` for metadata, \`State\` for status, \`Keys\` for shortcuts, \`Stage\` for a hero atmosphere, one ink \`Button\` for the main action.
- Use the ten text styles and the color roles. No other font sizes, no literal colors, gradients, uppercase labels or added letter-spacing.
- Run \`npx halation lint\` before you finish; it exits 1 when a rule is broken. With the app running, \`npx halation check <url>\` measures the rendered page.
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
  throw new UsageError(`${file} isn't a valid JSON object, so the hook wasn't added. Fix the file (or remove it) and run halation init again.`)
}

const hasHook = (settings) =>
  (settings.hooks?.PostToolUse ?? []).some((entry) => (entry?.hooks ?? []).some((h) => typeof h?.command === "string" && /\bhalation lint --hook\b/.test(h.command)))

/** Adds the lint hook to a settings object in place. Returns true when it changed. */
export function mergeHook(settings) {
  if (hasHook(settings)) return false
  settings.hooks ??= {}
  if (typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) throw new UsageError(`The "hooks" entry in .claude/settings.json isn't an object. Fix it and run halation init again.`)
  settings.hooks.PostToolUse ??= []
  if (!Array.isArray(settings.hooks.PostToolUse)) throw new UsageError(`The "hooks.PostToolUse" entry in .claude/settings.json isn't a list. Fix it and run halation init again.`)
  settings.hooks.PostToolUse.push(structuredClone(HOOK))
  return true
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

  // The hook.
  const settingsFile = path.join(root, ".claude/settings.json")
  const existed = existsSync(settingsFile)
  const settings = existed ? readJson(settingsFile) : {}
  if (mergeHook(settings)) {
    write(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
    done.push(`${existed ? "Added" : "Created .claude/settings.json with"} a hook that lints each file Claude Code edits${existed ? " to .claude/settings.json" : ""}.`)
  } else done.push("The lint hook is already in .claude/settings.json.")

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
