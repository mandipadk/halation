// `halation guard --hook`: a Claude Code PreToolUse hook that keeps agents
// away from the files that hold a project's rules: the settings that run
// Halation's hooks, the installed rulebook and Halation's own files.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const slash = (p) => p.split(path.sep).join("/")

/** What a protected file is, in words, or null when anyone may change it. */
export function protectedFile(file) {
  const p = slash(file).toLowerCase()
  if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(p)) return "Claude Code's settings for this project, which run Halation's hooks"
  if (/(^|\/)node_modules\/(.*\/)?@halation[/+]/.test(p)) return "Halation's installed packages, which hold the rulebook and the checks"
  if (/(^|\/)node_modules\/.*\/(rules\.json|rulebook\.[a-z]+)$/.test(p)) return "an installed rulebook"
  if (/(^|\/)\.halation(\/|$)/.test(p)) return "Halation's files for this project"
  return null
}

/** Paths in a shell command that belong to the rules, with what each one is. */
const MENTIONS = [
  [(c) => /\.claude(?![\w-])/i.test(c) && /settings(\.local)?\.json/i.test(c), "Claude Code's settings for this project, which run Halation's hooks"],
  [(c) => /node_modules[\\/](?:\.pnpm[\\/])?@halation(?:[\\/+]|(?=$|[\s"';&|)]))|@halation\+/i.test(c), "Halation's installed packages, which hold the rulebook and the checks"],
  [(c) => /node_modules[\\/][^\s;&|]*(?:rules\.json|rulebook)/i.test(c), "an installed rulebook"],
  [(c) => /(?:^|[\s"'=/])\.halation(?:[\\/\s"';&|)]|$)/i.test(c), "Halation's files for this project"],
  [(c) => /(?:^|[\s"'=])(?:\.\/)?node_modules[\\/]?(?=$|[\s"';&|)])/.test(c), "the project's installed packages, Halation's among them"],
]

/** Shell operations that write, move or delete files. */
const WRITES = [
  /(?<![\d<>=&|-])>{1,2}(?![>&=])/,
  /\btee\b/,
  /\bsed\b[^|;&]*\s(?:-[a-z]*i|--in-place)/i,
  /\bperl\b[^|;&]*\s-[a-z]*i/i,
  /\b(?:mv|cp|rm|rmdir|chmod|chown|truncate|ln|unlink|dd|rsync)\b/,
  /\bgit\s+(?:checkout|restore|rm|mv|apply)\b/,
  /\b(?:python3?|node|deno|bun|ruby)\b[^|;&]*\s(?:-[a-z]*[ce]\b|--eval\b)[\s\S]*(?:write|open\([^)]*["'][wax+]|unlink|rename|copy|truncate|rmSync|rmdir|remove|chmod)/i,
]

/** The tools that write files. */
const EDITS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"])

/** Package managers taking Halation out. */
const UNINSTALL = /\b(?:npm|pnpm|yarn|bun)\s+(?:uninstall|remove|rm|un|r)\b[^;&|]*@halation\//i

/** The "halation" settings in package.json text, or undefined when there are none. */
function configOf(text) {
  try {
    return JSON.stringify(JSON.parse(text)?.halation)
  } catch {
    return /"halation"\s*:/.test(text) ? "unreadable" : undefined
  }
}

/** Whether a Write, Edit or MultiEdit would change the "halation" settings in package.json. */
function changesConfig(tool, input, abs) {
  if (path.basename(abs) !== "package.json") return false
  if (tool === "Write") {
    const now = existsSync(abs) ? configOf(readFileSync(abs, "utf8")) : undefined
    return configOf(String(input.content ?? "")) !== now
  }
  const edits = tool === "MultiEdit" ? (Array.isArray(input.edits) ? input.edits : []) : [input]
  return edits.some((e) => /"halation"\s*:/.test(`${e?.old_string ?? ""}\n${e?.new_string ?? ""}`))
}

const OWNER = "These files are the project's rules, and only the project's owner changes them. Leave them as they are and fix the code instead; if a rule seems wrong for this project, tell the user."

/**
 * Hook mode: `input` is the JSON Claude Code sends to a PreToolUse hook.
 * Returns { code, stderr }: code 2 with the reason when the tool would change
 * a protected file, so Claude Code blocks it; 0 otherwise.
 */
export function guardHook(input, { cwd = process.cwd() } = {}) {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    return { code: 1, stderr: "halation guard --hook reads the JSON a Claude Code hook sends on stdin, and what it got wasn't JSON. Run halation init to add the hook.\n" }
  }
  const base = typeof payload?.cwd === "string" ? payload.cwd : cwd
  const tool = payload?.tool_name
  const toolInput = payload?.tool_input ?? {}
  const deny = (what, message) => ({ code: 2, stderr: `Halation's guard stopped this ${what}: ${message}\n` })

  if (tool === "Bash") {
    const command = typeof toolInput.command === "string" ? toolInput.command : ""
    if (UNINSTALL.test(command)) return deny("command", `it would uninstall Halation, which holds the rulebook and the checks. ${OWNER}`)
    if (!WRITES.some((w) => w.test(command))) return { code: 0, stderr: "" }
    const hit = MENTIONS.find(([test]) => test(command))
    return hit ? deny("command", `it would change ${hit[1]}. ${OWNER}`) : { code: 0, stderr: "" }
  }

  const given = toolInput.file_path ?? toolInput.notebook_path ?? toolInput.path
  if (!EDITS.has(tool) || typeof given !== "string" || !given) return { code: 0, stderr: "" }
  const abs = path.resolve(base, given)
  const what = protectedFile(abs)
  if (what) return deny("edit", `${given} is ${what}. ${OWNER}`)
  if (changesConfig(tool, toolInput, abs)) {
    return deny("edit", `the "halation" settings in package.json choose what Halation lints before Claude Code finishes, so they're part of the project's rules, and only the project's owner changes them. Leave them as they are; if they need to change, tell the user.`)
  }
  return { code: 0, stderr: "" }
}
