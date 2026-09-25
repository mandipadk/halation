// `halation lint`: the rulebook's source detectors, run over files.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { compileDetectors, coveredExtensions } from "./rules.js"

/** Folders never walked into: dependencies and build output. Hidden folders are skipped too. */
export const SKIP_DIRS = new Set(["node_modules", "dist", "build", "out", "coverage", "storybook-static", "bower_components", "vendor", "target"])

const MAX_BYTES = 2 * 1024 * 1024
const IGNORE = /halation-ignore\b([^\n]*)/

export class UsageError extends Error {}

const extOf = (file) => path.extname(file).slice(1).toLowerCase()
const slash = (p) => p.split(path.sep).join("/")

/** The path to show for a file: relative to `cwd` when inside it. */
export function displayPath(abs, cwd = process.cwd()) {
  const rel = path.relative(cwd, abs)
  return slash(rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : abs)
}

/** Rule ids ignored on a line, "all" for a bare `halation-ignore`, or null. */
function ignoredOn(line) {
  const m = line?.match(IGNORE)
  if (!m) return null
  const ids = m[1].match(/\bR\d+\b/g)
  return ids ? new Set(ids) : "all"
}

const isIgnored = (lines, index, id) =>
  [lines[index], lines[index - 1]].some((line) => {
    const ids = ignoredOn(line)
    return ids === "all" || (ids !== null && ids.has(id))
  })

/**
 * Lints `text` as if it were `file` (its extension picks the detectors and
 * its path is matched against each detector's `skip`). Returns findings
 * sorted by position.
 */
export function lintText(text, file, detectors = compileDetectors()) {
  const ext = extOf(file)
  const where = slash(file)
  const active = detectors.filter((d) => d.files.has(ext) && !(d.skip && d.skip.test(where)))
  if (!active.length) return []
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1)
  const lines = text.split("\n")
  const lineOf = (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const findings = []
  for (const d of active) {
    d.re.lastIndex = 0
    for (const m of text.matchAll(d.re)) {
      if (!m[0]) continue
      // Point at the offending text, not the whitespace a pattern starts with.
      const lead = m[0].length - m[0].trimStart().length
      const offset = m.index + (lead < m[0].length ? lead : 0)
      const index = lineOf(offset)
      if (isIgnored(lines, index, d.rule.id)) continue
      const found = m[0].trim().replace(/\s+/g, " ")
      findings.push({
        file,
        line: index + 1,
        column: offset - starts[index] + 1,
        rule: d.rule.id,
        level: d.level,
        says: d.rule.says,
        found: found.length > 60 ? `${found.slice(0, 57)}...` : found,
      })
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule, "en", { numeric: true }))
}

/** Every lintable file under `paths`, skipping dependencies, build output and hidden folders. */
export function collectFiles(paths, { cwd = process.cwd(), extensions = coveredExtensions() } = {}) {
  const wanted = new Set(extensions)
  const out = []
  const seen = new Set()
  const add = (abs) => {
    if (seen.has(abs) || !wanted.has(extOf(abs)) || /\.min\.(js|css)$/.test(abs)) return
    seen.add(abs)
    out.push(abs)
  }
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) walk(abs)
      } else if (entry.isFile() || (entry.isSymbolicLink() && safeIsFile(abs))) add(abs)
    }
  }
  for (const p of paths.length ? paths : ["."]) {
    const abs = path.resolve(cwd, p)
    if (!existsSync(abs)) throw new UsageError(`There's no file or folder at ${p}. Check the path and run the command again.`)
    if (statSync(abs).isDirectory()) walk(abs)
    else add(abs)
  }
  return out
}

function safeIsFile(abs) {
  try {
    return statSync(abs).isFile()
  } catch {
    return false
  }
}

/** Lints files on disk. Returns { files, findings }. */
export function lintFiles(paths, { cwd = process.cwd() } = {}) {
  const detectors = compileDetectors()
  const files = collectFiles(paths, { cwd, extensions: coveredExtensions(detectors) })
  const findings = []
  for (const abs of files) {
    if (statSync(abs).size > MAX_BYTES) continue
    findings.push(...lintText(readFileSync(abs, "utf8"), displayPath(abs, cwd), detectors))
  }
  return { files: files.length, findings }
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The readable report. */
export function formatReport({ files, findings }, rules) {
  if (!files) return `There were no files to lint. Lint reads ${coveredExtensions().map((e) => `.${e}`).join(", ")} files, outside dependency, build and hidden folders.\n`
  if (!findings.length) return `No problems in ${plural(files, "file")}.\n`
  const out = []
  for (const f of findings) {
    out.push(`${f.file}:${f.line}:${f.column}  ${f.rule}  ${f.says} Found "${f.found}".${f.level === "warn" ? " (warning)" : ""}`)
  }
  out.push("")
  const byId = new Map(rules.map((r) => [r.id, r]))
  for (const id of [...new Set(findings.map((f) => f.rule))]) {
    const r = byId.get(id)
    out.push(`${r.id}: ${r.says}`, `  Why: ${r.why}`, `  Instead: ${r.instead}`, "")
  }
  const errors = findings.filter((f) => f.level === "error").length
  const warnings = findings.length - errors
  const counts = [errors && plural(errors, "error"), warnings && plural(warnings, "warning")].filter(Boolean).join(" and ")
  const touched = new Set(findings.map((f) => f.file)).size
  out.push(`Found ${counts} in ${plural(touched, "file")}, out of ${plural(files, "file")} linted.`)
  if (errors) out.push(`Fix the errors, or when one is deliberate, add a comment saying halation-ignore ${findings.find((f) => f.level === "error").rule} on that line or the line above.`)
  return `${out.join("\n")}\n`
}

/**
 * Hook mode: `input` is the JSON Claude Code sends to a PostToolUse hook.
 * Returns { code, stderr }: code 2 with a message when the edited file
 * breaks an error-level rule, so the agent sees it; 0 otherwise.
 */
export function lintHook(input, { cwd = process.cwd() } = {}) {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    return { code: 1, stderr: "halation lint --hook reads the JSON a Claude Code hook sends on stdin, and what it got wasn't JSON. Run it from a hook, or run halation lint with a path instead.\n" }
  }
  const base = typeof payload?.cwd === "string" ? payload.cwd : cwd
  const given = payload?.tool_input?.file_path ?? payload?.tool_input?.path
  if (typeof given !== "string" || !given) return { code: 0, stderr: "" }
  const abs = path.resolve(base, given)
  const shown = displayPath(abs, base)
  const segments = path.relative(base, abs).split(path.sep).slice(0, -1)
  if (segments.some((s) => SKIP_DIRS.has(s) || (s.startsWith(".") && s !== ".."))) return { code: 0, stderr: "" }
  if (!safeIsFile(abs) || statSync(abs).size > MAX_BYTES) return { code: 0, stderr: "" }
  const detectors = compileDetectors()
  if (!coveredExtensions(detectors).includes(extOf(abs))) return { code: 0, stderr: "" }
  const errors = lintText(readFileSync(abs, "utf8"), shown, detectors).filter((f) => f.level === "error")
  if (!errors.length) return { code: 0, stderr: "" }
  const byId = new Map(detectors.map((d) => [d.rule.id, d.rule]))
  const lines = [`Halation lint found ${plural(errors.length, "problem")} in ${shown} that break the design rules. Fix them before moving on:`]
  for (const f of errors) lines.push(`- Line ${f.line}, ${f.rule}: ${f.says} Found "${f.found}". Instead: ${byId.get(f.rule).instead}`)
  lines.push("If one is deliberate, add a comment saying halation-ignore and the rule id on that line or the line above.")
  return { code: 2, stderr: `${lines.join("\n")}\n` }
}
