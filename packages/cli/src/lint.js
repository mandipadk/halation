// `halation lint`: the rulebook's source detectors, run over files.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { compileDetectors, coveredExtensions, loadRules } from "./rules.js"

/** Folders never linted, wherever they are: dependencies, git and Claude Code's own files. */
export const NEVER_DIRS = new Set(["node_modules", ".git", ".claude"])

/**
 * Build output and vendored copies. They're skipped only where tools put
 * them, directly in the folder being linted or in a package's root, and
 * never inside src, so a folder there can't hide what's in it.
 */
export const BUILD_DIRS = new Set([
  "dist", "build", "out", "coverage", "target", "storybook-static", "vendor", "bower_components",
  ".next", ".nuxt", ".output", ".svelte-kit", ".astro", ".vercel", ".netlify", ".turbo", ".cache", ".parcel-cache", ".wrangler",
])

const MAX_BYTES = 2 * 1024 * 1024
const IGNORE = /halation-ignore(?![\w-])/gi

export class UsageError extends Error {}

const extOf = (file) => path.extname(file).slice(1).toLowerCase()
const slash = (p) => p.split(path.sep).join("/")
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const them = (n) => (n === 1 ? "it" : "them")

/** The path to show for a file: relative to `cwd` when inside it. */
export function displayPath(abs, cwd = process.cwd()) {
  const rel = path.relative(cwd, abs)
  return slash(rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : abs)
}

/**
 * Scans one line from `from` to `to`, with `open` a block comment already
 * open there. Returns the comment open at `to` ("//", "/*", "<!--" or null)
 * and the quote a string is open with, if any.
 */
function scan(text, from, to, open = null) {
  let quote = null
  for (let i = from; i < to; i++) {
    if (open) {
      const close = open === "/*" ? "*/" : "-->"
      if (text.startsWith(close, i)) {
        open = null
        i += close.length - 1
      }
      continue
    }
    const c = text[i]
    if (quote) {
      if (c === "\\") i++
      else if (c === quote) quote = null
      continue
    }
    // An apostrophe inside a word is prose, not the start of a string.
    if (c === '"' || c === "`" || (c === "'" && !/\w/.test(text[i - 1] ?? ""))) quote = c
    else if (text.startsWith("//", i) && text[i - 1] !== ":") return { open: "//", quote: null }
    else if (text.startsWith("/*", i)) {
      open = "/*"
      i++
    } else if (text.startsWith("<!--", i)) {
      open = "<!--"
      i += 3
    }
  }
  return { open, quote }
}

/** The last offset in the sorted list `at` that's below `limit`, or -1. */
function lastBelow(at, limit) {
  let lo = 0
  let hi = at.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (at[mid] < limit) lo = mid + 1
    else hi = mid
  }
  return lo ? at[lo - 1] : -1
}

/** A block comment opened on an earlier line and still open at `lineStart`, or null. */
function carriedComment(text, lineStart, marks, starts, lineOf) {
  if (!lineStart) return null
  for (const [open, close] of [["/*", "*/"], ["<!--", "-->"]]) {
    const at = lastBelow(marks[open], lineStart)
    if (at === -1 || lastBelow(marks[close], lineStart) > at) continue
    const before = scan(text, starts[lineOf(at)], at)
    if (!before.open && !before.quote) return open
  }
  return null
}

/**
 * The exceptions in `text`. A `halation-ignore` counts only inside a comment,
 * and only for the rule ids it names; it covers its own lines and the line
 * after the comment. One inside a comment that names no rule is `unnamed`.
 */
function exceptions(text, starts, lineOf) {
  const covers = new Map()
  const unnamed = []
  const tokens = [...text.matchAll(IGNORE)]
  if (!tokens.length) return { covers, unnamed }
  const marks = { "/*": [], "*/": [], "<!--": [], "-->": [] }
  for (const m of text.matchAll(/\/\*|\*\/|<!--|-->/g)) marks[m[0]].push(m.index)
  for (const m of tokens) {
    const line = lineOf(m.index)
    const lineStart = starts[line]
    const { open } = scan(text, lineStart, m.index, carriedComment(text, lineStart, marks, starts, lineOf))
    if (!open) continue
    const lineEnd = line + 1 < starts.length ? starts[line + 1] - 1 : text.length
    let end = open === "//" ? lineEnd : text.indexOf(open === "/*" ? "*/" : "-->", m.index)
    if (end === -1) end = text.length
    const rest = text.slice(m.index + m[0].length, end)
    const ids = rest.match(/\bR\d+\b/gi)
    if (ids) {
      for (let l = line, last = lineOf(end) + 1; l <= last; l++) {
        if (!covers.has(l)) covers.set(l, new Set())
        for (const id of ids) covers.get(l).add(id.toUpperCase())
      }
    } else unnamed.push({ offset: m.index, line, said: `${m[0]}${rest}`.trim().replace(/\s+/g, " ") })
  }
  return { covers, unnamed }
}

const clip = (s) => (s.length > 60 ? `${s.slice(0, 57)}...` : s)

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
  const { covers, unnamed } = exceptions(text, starts, lineOf)
  const isIgnored = (line, id) => covers.get(line)?.has(id) ?? false
  const found = []
  for (const d of active) {
    d.re.lastIndex = 0
    for (const m of text.matchAll(d.re)) {
      if (!m[0]) continue
      // Point at the offending text, not the whitespace a pattern starts with.
      const lead = m[0].length - m[0].trimStart().length
      const offset = m.index + (lead < m[0].length ? lead : 0)
      const index = lineOf(offset)
      if (isIgnored(index, d.rule.id)) continue
      found.push({
        start: m.index,
        end: m.index + m[0].length,
        file,
        line: index + 1,
        column: offset - starts[index] + 1,
        rule: d.rule.id,
        level: d.level,
        says: d.rule.says,
        found: clip(m[0].trim().replace(/\s+/g, " ")),
      })
    }
  }
  // A rule's detectors can overlap; one stretch of text is one problem.
  found.sort((a, b) => a.rule.localeCompare(b.rule) || a.start - b.start || b.end - a.end)
  const findings = []
  let kept = null
  for (const { start, end, ...f } of found) {
    if (kept && kept.rule === f.rule && start < kept.end) continue
    kept = { rule: f.rule, end }
    findings.push(f)
  }
  if (unnamed.length) {
    const rule = loadRules().find((r) => r.id === "R21")
    for (const u of unnamed) {
      findings.push({ file, line: u.line + 1, column: u.offset - starts[u.line] + 1, rule: "R21", level: "error", says: rule.says, found: clip(u.said) })
    }
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column || a.rule.localeCompare(b.rule, "en", { numeric: true }))
}

/** The nearest folder at or above `dir` with a package.json, or null. */
export function projectRoot(dir) {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    if (existsSync(path.join(d, "package.json"))) return d
    if (path.dirname(d) === d) return null
  }
}

/** Whether `root` is a src folder or inside one, counting from its project root. */
function startsInSrc(root) {
  const project = projectRoot(root) ?? root
  return path.basename(root) === "src" || path.relative(project, root).split(path.sep).includes("src")
}

/** Whether a walk from `root` skips the folder `name` inside `parent`. */
function skipsDir(parent, name, root, inSrc) {
  if (NEVER_DIRS.has(name)) return true
  return BUILD_DIRS.has(name) && !inSrc && (parent === root || existsSync(path.join(parent, "package.json")))
}

/** Whether lint skips the file `abs` when linting from `root`. */
export function isSkipped(abs, root) {
  const rel = path.relative(root, abs)
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return abs.split(path.sep).some((s) => NEVER_DIRS.has(s))
  let dir = root
  let inSrc = startsInSrc(root)
  for (const name of rel.split(path.sep).slice(0, -1)) {
    if (skipsDir(dir, name, root, inSrc)) return true
    inSrc ||= name === "src"
    dir = path.join(dir, name)
  }
  return false
}

/** Every lintable file under `paths`, skipping dependencies and build output. */
export function collectFiles(paths, { cwd = process.cwd(), extensions = coveredExtensions() } = {}) {
  const wanted = new Set(extensions)
  const out = []
  const seen = new Set()
  const add = (abs) => {
    if (seen.has(abs) || !wanted.has(extOf(abs)) || /\.min\.(js|css)$/.test(abs)) return
    seen.add(abs)
    out.push(abs)
  }
  const walk = (dir, root, inSrc) => {
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
        if (!skipsDir(dir, entry.name, root, inSrc)) walk(abs, root, inSrc || entry.name === "src")
      } else if (entry.isFile() || (entry.isSymbolicLink() && safeIsFile(abs))) add(abs)
    }
  }
  for (const p of paths.length ? paths : ["."]) {
    const abs = path.resolve(cwd, p)
    if (!existsSync(abs)) throw new UsageError(`There's no file or folder at ${p}. Check the path and run the command again.`)
    if (statSync(abs).isDirectory()) walk(abs, abs, startsInSrc(abs))
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

const counted = (findings, problem = "error") => {
  const errors = findings.filter((f) => f.level === "error").length
  const warnings = findings.length - errors
  return [errors && plural(errors, problem), warnings && plural(warnings, "warning")].filter(Boolean).join(" and ")
}

/** The readable report. */
export function formatReport({ files, findings }, rules) {
  if (!files) return `There were no files to lint. Lint reads ${coveredExtensions().map((e) => `.${e}`).join(", ")} files, outside dependency and build folders.\n`
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
  const touched = new Set(findings.map((f) => f.file)).size
  out.push(`Found ${counted(findings)} in ${plural(touched, "file")}, out of ${plural(files, "file")} linted.`)
  const error = findings.find((f) => f.level === "error" && f.rule !== "R21")
  if (error) out.push(`Fix the errors, or when one is deliberate, add a comment saying halation-ignore ${error.rule} and why, on that line or the line above.`)
  return `${out.join("\n")}\n`
}

const EXCEPTION_HINT = "If one is deliberate, add a comment saying halation-ignore, the rule id and why, on that line or the line above."

/** One finding as a line the agent reads. */
const agentLine = (f, byId, where) =>
  `- ${where(f)}, ${f.rule}${f.level === "warn" ? " (warning)" : ""}: ${f.says} Found "${f.found}". Instead: ${byId.get(f.rule).instead}`

/**
 * Hook mode: `input` is the JSON Claude Code sends to a PostToolUse hook.
 * Returns { code, stderr }: code 2 with a message when the edited file
 * breaks a rule, warnings included, so the agent sees it; 0 otherwise.
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
  if (isSkipped(abs, base)) return { code: 0, stderr: "" }
  if (!safeIsFile(abs) || statSync(abs).size > MAX_BYTES) return { code: 0, stderr: "" }
  const detectors = compileDetectors()
  if (!coveredExtensions(detectors).includes(extOf(abs))) return { code: 0, stderr: "" }
  const findings = lintText(readFileSync(abs, "utf8"), shown, detectors)
  if (!findings.length) return { code: 0, stderr: "" }
  const byId = new Map(loadRules().map((r) => [r.id, r]))
  const lines = [`Halation lint found ${counted(findings, "problem")} with the design rules in ${shown}. Fix ${them(findings.length)} before moving on:`]
  for (const f of findings) lines.push(agentLine(f, byId, (x) => `Line ${x.line}`))
  lines.push(EXCEPTION_HINT)
  return { code: 2, stderr: `${lines.join("\n")}\n` }
}

/** The paths the Stop hook lints: package.json's "halation": { "lint": [...] }, or src. */
export function stopPaths(root) {
  try {
    const lint = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"))?.halation?.lint
    const list = (Array.isArray(lint) ? lint : [lint]).filter((p) => typeof p === "string" && p)
    if (list.length) return { paths: list, configured: true }
  } catch {}
  return { paths: ["src"], configured: false }
}

/** Where the Stop hook remembers what it last reported for a project: outside the project, keyed by its path. */
export const stopStateFile = (root) => path.join(tmpdir(), "halation", `stop-${createHash("sha256").update(root).digest("hex").slice(0, 16)}.json`)

const MAX_LISTED = 40

/**
 * Stop hook mode: `input` is the JSON Claude Code sends to a Stop hook. Lints
 * the project and returns { code, stdout, stderr }: code 2 with the problems
 * on stderr, so the agent can't finish with them. When the agent was already
 * sent back once and nothing changed, it lets the stop through (code 0) and
 * tells the person instead, so the two can't loop forever.
 */
export function lintStop(input, { cwd = process.cwd() } = {}) {
  let payload = {}
  if (input.trim()) {
    try {
      payload = JSON.parse(input)
    } catch {
      return { code: 1, stdout: "", stderr: "halation lint --stop reads the JSON a Claude Code Stop hook sends on stdin, and what it got wasn't JSON. Run it from the hook, or run halation lint with a path instead.\n" }
    }
  }
  const start = path.resolve(typeof payload?.cwd === "string" ? payload.cwd : cwd)
  const root = projectRoot(start) ?? start
  const state = stopStateFile(root)
  const { paths, configured } = stopPaths(root)
  const present = paths.filter((p) => existsSync(path.resolve(root, p)))
  const missing = configured ? paths.filter((p) => !present.includes(p)) : []
  const { findings } = present.length ? lintFiles(present, { cwd: root }) : { findings: [] }
  if (!findings.length && !missing.length) {
    rmSync(state, { force: true })
    return { code: 0, stdout: "", stderr: "" }
  }

  const byId = new Map(loadRules().map((r) => [r.id, r]))
  const where = (f) => `${f.file}:${f.line}:${f.column}`
  const command = `npx halation lint ${paths.join(" ")}`
  const keys = [...findings.map((f) => `${where(f)} ${f.rule} ${f.found}`), ...missing.map((p) => `missing ${p}`)].sort()
  const fingerprint = createHash("sha256").update(keys.join("\n")).digest("hex")
  let last = null
  try {
    last = JSON.parse(readFileSync(state, "utf8")).fingerprint
  } catch {}

  if (payload?.stop_hook_active === true && last === fingerprint) {
    rmSync(state, { force: true })
    const lines = [`Halation lint still finds ${counted(findings, "problem") || "a problem"} in this project, and Claude Code stopped without fixing ${them(keys.length)}:`]
    for (const f of findings.slice(0, 10)) lines.push(`- ${where(f)}, ${f.rule}: ${f.says}`)
    if (findings.length > 10) lines.push(`- and ${plural(findings.length - 10, "more problem")}`)
    for (const p of missing) lines.push(`- package.json asks to lint ${p}, and there's nothing there.`)
    lines.push(`Run ${command} to see ${them(keys.length)}.`)
    return { code: 0, stdout: `${JSON.stringify({ systemMessage: lines.join("\n") })}\n`, stderr: "" }
  }

  mkdirSync(path.dirname(state), { recursive: true })
  writeFileSync(state, JSON.stringify({ root, fingerprint }))
  const lines = []
  if (findings.length) {
    lines.push(`Halation lint found ${counted(findings, "problem")} with the design rules in this project, so the work isn't done. Fix ${them(findings.length)}, then finish:`)
    for (const f of findings.slice(0, MAX_LISTED)) lines.push(agentLine(f, byId, where))
    if (findings.length > MAX_LISTED) lines.push(`- and ${plural(findings.length - MAX_LISTED, "more problem")}. Run ${command} to see them all.`)
    lines.push(EXCEPTION_HINT)
  }
  for (const p of missing) lines.push(`package.json asks Halation to lint ${p} before finishing, and there's no file or folder there. Put the files back, or ask the user to change "halation": { "lint": [...] } in package.json.`)
  return { code: 2, stdout: "", stderr: `${lines.join("\n")}\n` }
}
