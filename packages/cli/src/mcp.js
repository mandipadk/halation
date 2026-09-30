// `halation mcp`: Halation's tools for agents, served over the Model Context
// Protocol on stdin and stdout. Messages are newline-delimited JSON-RPC 2.0;
// nothing else goes to stdout, and anything worth logging goes to stderr.

import { readFileSync } from "node:fs"
import path from "node:path"
import { createInterface } from "node:readline"
import { checkUrl, toUrl } from "./check.js"
import { checkDeclaration, colorVector, gate, literalColors } from "./gate.js"
import { lintFiles, lintText, UsageError } from "./lint.js"
import { corePath, coveredExtensions, loadRules } from "./rules.js"
import { EXAMPLES, PRINCIPLES, TELLS } from "./skill.js"

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version

/** Protocol versions this server speaks, newest first. */
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]

const kit = (name) => JSON.parse(readFileSync(new URL(`../kit/${name}`, import.meta.url), "utf8"))
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** A failure the agent can act on: returned as an isError result, not a protocol error. */
class ToolError extends Error {}
/** Arguments that don't fit a tool's or a prompt's schema: a JSON-RPC invalid params error. */
class ParamsError extends Error {}

// ---------------------------------------------------------------------------
// The vocabulary, read from the installed @halation/core

let tokensCache
/** The custom properties in tokens.css: the :root block, and each [data-*="name"] preset. */
function tokens() {
  if (tokensCache) return tokensCache
  const text = readFileSync(corePath("tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  const props = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
  const root = /:root\s*\{([^}]*)\}/.exec(text)
  const presets = (attr) => [...text.matchAll(new RegExp(`\\[data-${attr}="([\\w-]+)"\\]\\s*\\{([^}]*)\\}`, "g"))].map(([, name, block]) => ({ name, props: props(block) }))
  tokensCache = { root: root ? props(root[1]) : {}, forms: presets("form"), accents: presets("accent") }
  return tokensCache
}

/** A length as px, for plain px and rem values; null for anything else. */
function toPx(value) {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|rem)?$/i.exec(String(value).trim())
  if (!m) return null
  const n = Number(m[1])
  if (!m[2]) return n === 0 ? 0 : null
  return m[2].toLowerCase() === "rem" ? n * 16 : n
}
const pxText = (n) => `${Number(n.toFixed(3))}px`

function textStyles() {
  const { root } = tokens()
  return kit("foundations.json").textStyles.map((t) => {
    const token = `--text-${t.name}`
    return {
      name: t.name,
      token,
      size: t.size,
      value: root[token],
      leading: root[`${token}--line-height`],
      tracking: root[`${token}--letter-spacing`],
      weight: Number(root[`${token}--font-weight`]) || undefined,
      usage: t.usage,
      css: `font-size: var(${token})`,
      tailwind: `text-${t.name}`,
    }
  })
}

function colorRoles() {
  const { root } = tokens()
  let usage = {}
  try {
    const swatches = JSON.parse(readFileSync(corePath("swatches.json"), "utf8"))
    usage = Object.fromEntries((swatches[0]?.roles ?? []).map((r) => [r.name, r.usage]))
  } catch {}
  return Object.keys(root)
    .filter((k) => k.startsWith("--color-"))
    .map((token) => {
      const name = token.slice("--color-".length)
      return { name, token, usage: usage[name] ?? "", css: `var(${token})` }
    })
}

const scaleOf = (prefix) =>
  Object.entries(tokens().root)
    .filter(([k]) => k.startsWith(prefix))
    .map(([token, value]) => ({ name: token.slice(prefix.length), token, value }))

function radii() {
  return scaleOf("--radius-").map((r) => ({ ...r, px: toPx(r.value), tailwind: `rounded-${r.name}` }))
}

const GRID = {
  steps: "2 px steps up to 24 px, then 4 px steps: 0, 2, 4 and so on to 24, then 28, 32, 36 and up. Borders are 1 px hairlines.",
  padding: "Padding counts from the border's outside: 13 px of padding inside a 1 px border is 14, on the grid.",
  tailwind: "Tailwind's spacing unit is 4 px, so p-3.5 is 14 px and gap-6 is 24 px.",
  offScale: "A value off the grid that a component needs is a component metric: a --m-* custom property in the component's stylesheet with its reason on the same line. The metric tool writes one.",
}

function motion() {
  const { durations, eases } = kit("foundations.json")
  const { root } = tokens()
  return {
    durations: durations.map((d) => ({ name: d.name, token: `--duration-${d.name}`, value: root[`--duration-${d.name}`] ?? `${d.ms}ms`, usage: d.usage })),
    easings: eases.map((e) => ({ name: e.name, token: `--ease-${e.name}`, value: root[`--ease-${e.name}`], usage: e.usage })),
    stagger: root["--stagger"],
  }
}

const SECTIONS = ["text", "color", "radius", "space", "grid", "motion", "form"]

function scale(section) {
  const { forms, accents } = tokens()
  const all = {
    text: () => ({ textStyles: textStyles(), note: "Eleven styles and no other sizes. Use <Text size>, <Heading size>, hl-text-<name>, or text-<name> in Tailwind." }),
    color: () => ({ colorRoles: colorRoles(), accents: accents.map((a) => a.name), note: "Colors come from the roles, never from literal values. Set data-accent on an element to retint what's inside it." }),
    radius: () => ({ radii: radii(), note: "Corners come from the radius scale, a full pill, or nest inside their parent's: the parent's radius minus the inset, as calc(var(--radius-2xl) - 8px)." }),
    space: () => ({ spaces: scaleOf("--space-").map((s) => ({ ...s, css: `var(${s.token})` })), note: "Named spaces for layout. Inside components, spacing uses the grid." }),
    grid: () => ({ grid: GRID }),
    motion: () => motion(),
    form: () => ({ forms: forms.map((f) => ({ name: f.name, css: `data-form="${f.name}"`, radius: Object.fromEntries(Object.entries(f.props).map(([k, v]) => [k.replace(/^--radius-/, ""), v])) })), note: "Set data-form on any element to make the corners inside it sharper or rounder." }),
  }
  if (section) return all[section]()
  return Object.fromEntries(SECTIONS.map((s) => [s, all[s]()]))
}

// ---------------------------------------------------------------------------
// Rules and components

function findRule(input) {
  const rules = loadRules()
  const raw = String(input).trim()
  const id = /^r?\d+$/i.test(raw) ? `R${raw.replace(/^r/i, "")}` : raw.toUpperCase()
  const rule = rules.find((r) => r.id === id || r.slug === raw.toLowerCase())
  if (!rule) throw new ToolError(`There's no rule called ${raw}. Rules run from ${rules[0].id} to ${rules.at(-1).id}; the rules tool lists them all.`)
  return rule
}

const describeRule = (r) => ({ id: r.id, slug: r.slug, says: r.says, why: r.why, instead: r.instead, caughtBy: r.caught, lintDetector: Boolean(r.lint?.length) })

const METRIC_RULES = new Set(["R7", "R17", "R24", "R25", "R26"])

function explain(input) {
  const r = findRule(input)
  const ex = EXAMPLES[r.id]
  const mentions = (line) => new RegExp(`\\b${r.id}\\b`).test(line)
  return {
    ...describeRule(r),
    dont: ex?.dont ?? r.says,
    do: ex?.do ?? r.instead,
    principles: PRINCIPLES.filter(mentions),
    tells: TELLS.filter(mentions),
    exception: `A deliberate exception gets a comment naming the rule and why, on that line or the line above: /* halation-ignore ${r.id}: the reason */.`,
    ...(METRIC_RULES.has(r.id) ? { metric: "When a component needs a value off the scale, declare it as a component metric with its reason. The metric tool writes the CSS." } : {}),
  }
}

function components(query) {
  const catalog = kit("components.json")
  const words = String(query ?? "").toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (...fields) => words.every((w) => fields.some((f) => String(f).toLowerCase().includes(w)))
  const list = catalog.components.filter((c) => !words.length || matches(c.name, c.use, c.example))
  const needs = catalog.needs.filter((n) => !words.length || matches(n.need, n.use))
  return { package: catalog.package, query: query || undefined, count: list.length, components: list, needs }
}

// ---------------------------------------------------------------------------
// Lint, gate, check

function inProject(root, p) {
  const abs = path.resolve(root, p)
  const rel = path.relative(root, abs)
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new ToolError(`${p} is outside the project. Lint reads paths inside ${root}; pass them relative to it.`)
  return p
}

function withRule(findings) {
  const byId = new Map(loadRules().map((r) => [r.id, r]))
  return findings.map((f) => ({ ...f, instead: byId.get(f.rule)?.instead ?? "" }))
}

function lint({ paths, text, filename }, root) {
  if (text !== undefined || filename !== undefined) {
    if (paths?.length) throw new ToolError("Pass paths, or text with a filename, not both.")
    if (text === undefined || !filename) throw new ToolError("Text needs a filename too, such as card.css or Card.tsx: its extension picks the detectors.")
    const ext = path.extname(filename).slice(1).toLowerCase()
    const covered = coveredExtensions()
    if (!covered.includes(ext)) throw new ToolError(`Lint doesn't read .${ext || filename} files. Name the text with one of ${covered.map((e) => `.${e}`).join(", ")}.`)
    const findings = lintText(text, filename).map(({ start, ...f }) => f)
    return summarize(1, findings)
  }
  const list = (paths ?? []).map((p) => inProject(root, p))
  const { files, findings } = lintFiles(list, { cwd: root })
  if (!files) throw new ToolError(`There were no files to lint. Lint reads ${coveredExtensions().map((e) => `.${e}`).join(", ")} files, outside dependency and build folders.`)
  return summarize(files, findings)
}

function summarize(files, findings) {
  const errors = findings.filter((f) => f.level === "error").length
  return { files, errors, warnings: findings.length - errors, pass: errors === 0, findings: withRule(findings) }
}

function runGate({ dirs, allowCounterexamples }, root) {
  const result = gate((dirs ?? []).map((d) => inProject(root, d)), { cwd: root, counterexamples: !!allowCounterexamples })
  if (!result.files) throw new ToolError(`There were no .css or .html files in ${result.dirs.join(", ")} to read. Build the project first, or name the folder that holds the build output.`)
  return { dirs: result.dirs, files: result.files, errors: result.findings.length, pass: !result.findings.length, exempted: result.exempted, findings: withRule(result.findings) }
}

const EMPTY = 5

async function runCheck({ url, modes, widths, allowCounterexamples }, root) {
  let result
  try {
    result = await checkUrl(toUrl(url, root), { modes: modes?.length ? modes : ["light", "dark"], widths: widths?.length ? widths : undefined, counterexamples: !!allowCounterexamples, cwd: root })
  } catch (e) {
    throw new ToolError(e.message)
  }
  const { runs } = result
  const where = (run) => `${run.mode} mode at ${run.width} px`
  const byId = new Map(loadRules().map((r) => [r.id, r]))
  const problems = []
  for (const run of runs) {
    if (run.elements < EMPTY) problems.push(`In ${where(run)}, the page rendered almost nothing (${plural(run.elements, "visible element")}). A blank or crashed page doesn't pass.`)
    for (const e of new Set(run.errors)) problems.push(`In ${where(run)}, the page threw an error: ${e}`)
  }
  const broken = []
  const kept = []
  for (const { id, says } of runs[0].rules) {
    const failing = runs.map((run) => [run, run.rules.find((r) => r.id === id)]).filter(([, r]) => r && !r.pass)
    if (!failing.length) {
      kept.push(id)
      continue
    }
    broken.push({
      id,
      says,
      instead: byId.get(id)?.instead ?? "",
      count: Math.max(...failing.map(([, r]) => r.count)),
      examples: [...new Set(failing.flatMap(([, r]) => r.examples))].slice(0, 5),
      where: failing.length === runs.length ? "everywhere" : failing.map(([run]) => where(run)),
    })
  }
  const budgets = runs[0].budgets.map((b) => {
    const per = runs.map((run) => run.budgets.find((x) => x.name === b.name))
    return { name: b.name, value: Math.max(...per.map((x) => x.value)), limit: b.limit, pass: per.every((x) => x.pass) }
  })
  const exempted = {}
  for (const k of ["counterexamples", "samples", "decorative", "metrics"]) {
    const n = Math.max(...runs.map((run) => run.exempted?.[k] ?? 0))
    if (n) exempted[k] = n
  }
  return {
    url: result.url,
    pass: result.pass,
    modes: [...new Set(runs.map((r) => r.mode))],
    widths: [...new Set(runs.map((r) => r.width))],
    problems,
    broken,
    kept,
    budgets,
    exempted,
  }
}

// ---------------------------------------------------------------------------
// Component metrics

const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()

const nearly = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6
const onGrid = (px) => {
  const n = Math.abs(px)
  return n < 1e-6 || (n <= 24 + 1e-6 ? nearly(n, 2) : nearly(n, 4))
}
/** The grid steps on either side of a value. */
function gridAround(px) {
  const n = Math.abs(px)
  const below = n <= 24 ? Math.floor(n / 2) * 2 : Math.floor(n / 4) * 4
  const above = n < 24 ? Math.ceil(n / 2) * 2 : Math.ceil(n / 4) * 4
  return [...new Set([below, above])].map(pxText)
}

const PROPERTY = { padding: "padding", margin: "margin", gap: "gap", radius: "border-radius", "font-size": "font-size", color: "background" }
const TW = { padding: "p", margin: "m", gap: "gap" }

/** Whether a color value can be read: a literal, a named color, or light-dark() of two of them. */
function readableColor(value) {
  const v = value.trim()
  const ld = /^light-dark\((.*)\)$/is.exec(v)
  if (ld) {
    const parts = splitTopLevel(ld[1])
    return parts.length === 2 && parts.every(readableColor)
  }
  if (colorVector(v)) return true
  const found = literalColors(v)
  return found.length === 1 && found[0].text.toLowerCase() === v.toLowerCase()
}

function splitTopLevel(s, sep = ",") {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++
    else if (s[i] === ")") depth--
    else if (depth === 0 && (sep === " " ? /\s/.test(s[i]) : s[i] === sep)) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out.map((p) => p.trim()).filter(Boolean)
}

/**
 * Whether a value needs a metric at all. Returns a sentence saying what to
 * use instead when it doesn't, or null when it does.
 */
function alreadyOnScale(kind, value, border) {
  const v = value.trim()
  const property = PROPERTY[kind]
  const passes = !checkDeclaration({ prop: property, value: v }).length

  if (kind === "padding" || kind === "margin" || kind === "gap") {
    const space = scaleOf("--space-").find((s) => s.value.replace(/\s+/g, "") === v.replace(/\s+/g, ""))
    if (space) return `${v} is the named space ${space.name}. Write ${property}: var(${space.token}); it doesn't need a metric.`
    const parts = splitTopLevel(v, " ")
    const px = parts.map(toPx)
    const tw = px.length === 1 && px[0] !== null && px[0] >= 0 ? ` (${TW[kind]}-${px[0] / 4} in Tailwind)` : ""
    if (passes) return `${v} is on the grid (${GRID.steps.split(":")[0]}), so it doesn't need a metric. Write ${property}: ${v}${tw}.`
    if (kind === "padding" && border > 0 && px.every((n) => n !== null && (onGrid(n) || onGrid(n + border)))) {
      return `Padding counts from the border's outside, and ${v} with a ${Number(border.toFixed(3))} px border lands on the grid, so it doesn't need a metric. Write padding: ${v}.`
    }
    return null
  }
  if (kind === "radius") {
    if (passes) return `${v} is already fine for a corner (the radius scale, a full pill or none), so it doesn't need a metric.`
    const px = toPx(v)
    const step = px !== null && radii().find((r) => r.px !== null && Math.abs(r.px - px) < 1e-6)
    if (step) return `${v} is the radius step ${step.name}. Write border-radius: var(${step.token}) (${step.tailwind} in Tailwind); it doesn't need a metric, and it follows the project's form.`
    return null
  }
  if (kind === "font-size") {
    if (passes) return `${v} is already a text style or a small relative nudge, so it doesn't need a metric.`
    const px = toPx(v)
    const style = textStyles().find((t) => t.value === v || (px !== null && toPx(t.value) !== null && Math.abs(toPx(t.value) - px) < 1e-6))
    if (style) return `${v} is the text style ${style.name}. Write font-size: var(${style.token}) (${style.tailwind} in Tailwind, or <Text size="${style.name}">); it doesn't need a metric.`
    return null
  }
  if (kind === "color") {
    const vars = [...v.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])
    const literals = literalColors(v).filter((c) => !c.clear)
    if (vars.length && vars.every((x) => x.startsWith("--color-")) && !literals.length) return `${v} is built from the color roles already. Use it as it is; it doesn't need a metric.`
    return null
  }
  return null
}

function metric({ selector, name, value, reason, for: kind, border }) {
  const sel = String(selector).trim()
  const val = String(value).trim()
  if (!sel || /[{};]/.test(sel)) throw new ToolError(`The selector should be the component's class or selector, such as .hl-cap, without braces or semicolons. Got ${JSON.stringify(selector)}.`)
  if (!val || /[{};]|\/\*|\*\//.test(val)) throw new ToolError(`The value should be one CSS value, such as 9px, without braces, semicolons or comments. Got ${JSON.stringify(value)}.`)

  const instead = alreadyOnScale(kind, val, border ?? 0)
  if (instead) return { outcome: "on-scale", needsMetric: false, message: instead }

  if (kind === "color" && !readableColor(val)) throw new ToolError(`${val} isn't a color this tool can read. Give a literal such as oklch(96% 0.006 80) or #f4efe6, or light-dark() of two of them.`)

  const bare = String(name).trim().replace(/^--m-|^--/, "")
  if (!KEBAB.test(bare)) {
    const suggestion = kebab(bare)
    throw new ToolError(`A metric's name is kebab-case: lowercase words joined by hyphens, such as cap-x.${suggestion && KEBAB.test(suggestion) ? ` Try ${suggestion}.` : ""}`)
  }

  const why = String(reason ?? "").trim().replace(/\s+/g, " ")
  if (!why) throw new ToolError("A metric needs its reason: what the component needs this value for, in a few words, such as a one-letter cap stays square at 38 px. The reason is what lets the next person keep it or retire it (R26).")
  if (why.includes("*/") || why.includes("/*")) throw new ToolError("The reason goes inside a CSS comment, so it can't contain /* or */.")
  const words = why.split(" ").filter((w) => /[a-z0-9]/i.test(w))
  if (words.length < 4) throw new ToolError(`"${why}" is too thin a reason: ${plural(words.length, "word")}. Say what the component needs the value for, in four words or more, such as a one-letter cap stays square at 38 px.`)

  const token = `--m-${bare}`
  const property = PROPERTY[kind]
  const comment = `/* ${why} */`
  const declaration = `${token}: ${val}; ${comment}`
  const use = kind === "color" ? `background: var(${token});` : `${property}: var(${token});`
  const css = `${sel} {\n  ${declaration}\n  ${use}\n}\n`
  const notes = ["Put it in the component's stylesheet, with the reason on the same line. Not in a style attribute or a script, where it doesn't count as the component's (R26).", "Lint the stylesheet after adding it."]
  if (kind === "padding" || kind === "margin" || kind === "gap") {
    const off = splitTopLevel(val, " ").map(toPx).filter((n) => n !== null && !onGrid(n))
    if (off.length) notes.unshift(`The nearest grid steps are ${off.flatMap(gridAround).filter((x, i, a) => a.indexOf(x) === i).join(" and ")}. If one of them works, use it and skip the metric.`)
    if (kind === "padding" && !border) notes.push("Padding counts from the border's outside: if the element has a border, pass its width as border and the value may already be on the grid.")
  }
  if (kind === "radius") {
    const px = toPx(val)
    const nests = px === null ? [] : radii().filter((r) => r.px !== null && r.px > px && onGrid(r.px - px) && r.px - px <= 24).slice(0, 2)
    if (nests.length) notes.unshift(`If this corner sits inside a rounded parent, nest it instead: ${nests.map((r) => `calc(var(${r.token}) - ${pxText(r.px - px)})`).join(" or ")}, the parent's radius minus the inset.`)
  }
  if (kind === "font-size") notes.unshift("A metric size is for the component's own material, such as a glyph on a keycap or a numeral on a dial. Running text takes one of the eleven text styles.")
  if (kind === "color") {
    notes.unshift(
      "Metric colors are for a component's materials, such as photographic paper or a night sky: things that keep their own color in either mode. Text, fills, lines and states take the color roles, never a new interface color.",
      "The comment names R17 so lint accepts the literal, and carries the reason R26 asks for. Use the metric wherever the material shows: background, fill or border-color.",
    )
  }
  return { outcome: "declare", needsMetric: true, token, declaration, use: `var(${token})`, css, notes }
}

// ---------------------------------------------------------------------------
// The tools

const str = (description) => ({ type: "string", description })

export const TOOLS = [
  {
    name: "rules",
    description: "Every rule in the rulebook: what it says, why it exists, what to do instead and what catches it. Pass an id, such as R9, for one rule.",
    inputSchema: { type: "object", properties: { id: str("A rule id such as R9, or its slug") }, additionalProperties: false },
    run: ({ id }) => (id ? { rules: [describeRule(findRule(id))] } : { rules: loadRules().map(describeRule) }),
  },
  {
    name: "explain",
    description: "One rule in depth: what it says, why, what to do instead, a don't and a do, the principles and tells that name it, and what catches it.",
    inputSchema: { type: "object", properties: { id: str("A rule id such as R9, or its slug") }, required: ["id"], additionalProperties: false },
    run: ({ id }) => explain(id),
  },
  {
    name: "scale",
    description: "The vocabulary to build with, read from the installed @halation/core: the eleven text styles, the color roles, the radius scale, the named spaces, the spacing grid, durations, easings and the form presets. Pass a section for one part.",
    inputSchema: { type: "object", properties: { section: { type: "string", enum: SECTIONS, description: "One part of the scale" } }, additionalProperties: false },
    run: ({ section }) => scale(section),
  },
  {
    name: "components",
    description: "The components in @halation/react, each with what it's for and an example, and what to use for common needs. Pass a word, such as status or dialog, to find the ones that match.",
    inputSchema: { type: "object", properties: { query: str("Words to match against each component's name, use and example") }, additionalProperties: false },
    run: ({ query }) => components(query),
  },
  {
    name: "lint",
    description: "Lints source against the rulebook and returns each finding with its line, the rule, what the rule says and what to do instead. Pass paths relative to the project, or text with a filename whose extension says what kind of file it is. With neither, it lints the whole project.",
    inputSchema: {
      type: "object",
      properties: {
        paths: { type: "array", items: { type: "string" }, description: "Files or folders, relative to the project" },
        text: str("Source to lint without saving it"),
        filename: str("The file the text would be, such as Card.tsx or card.css"),
      },
      additionalProperties: false,
    },
    run: (args, root) => lint(args, root),
  },
  {
    name: "gate",
    description: "Reads what a build emitted, its CSS and the styles in its HTML, and returns each declaration that's off the system. Without dirs it reads the first of dist, build, out, .next/static and .output/public.",
    inputSchema: {
      type: "object",
      properties: {
        dirs: { type: "array", items: { type: "string" }, description: "Build output folders, relative to the project" },
        allowCounterexamples: { type: "boolean", description: "Skip rules whose selectors sit inside a [data-counterexample] element, and count them" },
      },
      additionalProperties: false,
    },
    run: (args, root) => runGate(args, root),
  },
  {
    name: "check",
    description: "Loads a page in headless Chrome, in light and dark mode at a desktop and a phone width, and returns which rules broke with example elements, the budgets and what was exempted. Needs playwright-core in the project.",
    inputSchema: {
      type: "object",
      properties: {
        url: str("An address, a host and port, or a local HTML file"),
        modes: { type: "array", items: { type: "string", enum: ["light", "dark"] }, description: "The color schemes to check; both by default" },
        widths: { type: "array", items: { type: "integer", minimum: 240, maximum: 3840 }, description: "Viewport widths in px; 1280 and 375 by default" },
        allowCounterexamples: { type: "boolean", description: "Let elements inside [data-counterexample] break the rules, and count them" },
      },
      required: ["url"],
      additionalProperties: false,
    },
    run: (args, root) => runCheck(args, root),
  },
  {
    name: "metric",
    description: "Declares a component metric: a value off the scale that a component needs, as a --m-* custom property with its reason on the same line (R26). Returns the CSS to add, or says the value is already on the scale and what to use instead. Refuses a name that isn't kebab-case or a reason under four words.",
    inputSchema: {
      type: "object",
      properties: {
        selector: str("The component's selector, such as .hl-cap"),
        name: str("The metric's name in kebab-case, without --m-, such as cap-x"),
        value: str("The CSS value, such as 9px"),
        reason: str("Why the component needs this value, in four words or more"),
        for: { type: "string", enum: Object.keys(PROPERTY), description: "What the value is for" },
        border: { type: "number", minimum: 0, description: "For padding: the element's border width in px, since padding counts from the border's outside" },
      },
      required: ["selector", "name", "value", "reason", "for"],
      additionalProperties: false,
    },
    run: (args) => metric(args),
  },
]

// ---------------------------------------------------------------------------
// The prompt

export const PROMPTS = [
  {
    name: "new-component",
    description: "Walks through building a new component inside Halation's rules: start from what exists, compose, declare any value off the scale with its reason, lint, then check the rendered page.",
    arguments: [{ name: "component", description: "What the component is, such as a storage meter for a settings page", required: true }],
    render: ({ component }) => `Build a new component for this project with Halation: ${component}.

1. Start from what exists. Call components with a word or two from the brief to find the pieces to compose, and scale for the text styles, color roles, radii, named spaces, grid and motion tokens.
2. Compose. Build from @halation/react components and the tokens: var(--text-*) or <Text size>, var(--color-*), var(--radius-*), var(--space-*), and spacing on the grid (2 px steps up to 24, then 4 px steps). Add a class of your own for what's new, and keep its styles in a stylesheet.
3. When a value truly has to be off the scale, call metric with the selector, a kebab-case name, the value, what it's for and the reason in a few words. Paste the CSS it returns into the component's stylesheet. If it says the value is already on the scale, use what it names instead.
4. Lint. Call lint with the files you changed, or with text and a filename for a draft, and fix every error. Call explain with a rule's id when you want its reason and a don't and a do.
5. Check the rendered page. With the app running, call check with its address and fix what broke. After a build, call gate.

Keep copy in sentence case, facts in Facts, states in State, and one ink button per view.`,
  },
]

// ---------------------------------------------------------------------------
// Arguments

/** Checks a value against the small part of JSON Schema the tools use. Returns a problem, or null. */
function invalid(value, schema, where) {
  if (schema.enum && !schema.enum.includes(value)) return `${where} is one of ${schema.enum.join(", ")}, not ${JSON.stringify(value)}.`
  switch (schema.type) {
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return `${where} should be an object.`
      for (const key of schema.required ?? []) if (value[key] === undefined) return `${where === "arguments" ? "The arguments" : where} need ${key}.`
      for (const [key, v] of Object.entries(value)) {
        const sub = schema.properties?.[key]
        if (!sub) {
          if (schema.additionalProperties === false) return `There's no argument called ${key}. The arguments are ${Object.keys(schema.properties ?? {}).join(", ") || "none"}.`
          continue
        }
        const problem = invalid(v, sub, key)
        if (problem) return problem
      }
      return null
    }
    case "array":
      if (!Array.isArray(value)) return `${where} should be a list.`
      for (const item of value) {
        const problem = invalid(item, schema.items ?? {}, `each of ${where}`)
        if (problem) return problem
      }
      return null
    case "string":
      return typeof value === "string" ? null : `${where} should be a string.`
    case "boolean":
      return typeof value === "boolean" ? null : `${where} should be true or false.`
    case "integer":
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) return `${where} should be a ${schema.type === "integer" ? "whole number" : "number"}.`
      if (schema.minimum !== undefined && value < schema.minimum) return `${where} is at least ${schema.minimum}.`
      if (schema.maximum !== undefined && value > schema.maximum) return `${where} is at most ${schema.maximum}.`
      return null
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// The protocol

const PARSE_ERROR = -32700
const INVALID_REQUEST = -32600
const METHOD_NOT_FOUND = -32601
const INVALID_PARAMS = -32602
const INTERNAL_ERROR = -32603

const INSTRUCTIONS =
  "Halation's rules for this project's interface, as tools. Before building a component, call scale and components to learn the vocabulary. Declare any value off the scale with metric. Lint what you wrote, and check the rendered page. The new-component prompt walks through it."

/**
 * An MCP server without a transport: `receive` takes one message (a line of
 * JSON) and resolves to the response to send, or null for none. `root` is
 * the project the tools read, by default the current folder.
 */
export function createMcpServer({ root = process.cwd() } = {}) {
  root = path.resolve(root)
  const byName = new Map(TOOLS.map((t) => [t.name, t]))
  const prompts = new Map(PROMPTS.map((p) => [p.name, p]))
  let protocolVersion = PROTOCOL_VERSIONS[0]

  const methods = {
    initialize(params) {
      const asked = params?.protocolVersion
      if (typeof asked !== "string") throw new ParamsError("initialize needs the client's protocolVersion.")
      protocolVersion = PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0]
      return { protocolVersion, capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } }, serverInfo: { name: "halation", title: "Halation", version: VERSION }, instructions: INSTRUCTIONS }
    },
    ping: () => ({}),
    "tools/list": () => ({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) }),
    async "tools/call"(params) {
      const name = params?.name
      if (typeof name !== "string") throw new ParamsError("tools/call needs the name of a tool.")
      const tool = byName.get(name)
      if (!tool) throw new ParamsError(`There's no tool called ${name}. The tools are ${TOOLS.map((t) => t.name).join(", ")}.`)
      const args = params.arguments ?? {}
      const problem = invalid(args, tool.inputSchema, "arguments")
      if (problem) throw new ParamsError(`${name}: ${problem}`)
      try {
        const result = await tool.run(args, root)
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result, isError: false }
      } catch (e) {
        if (e instanceof ToolError || e instanceof UsageError) return { content: [{ type: "text", text: e.message }], isError: true }
        process.stderr.write(`halation mcp: ${name} failed: ${e?.stack ?? e}\n`)
        return { content: [{ type: "text", text: `Halation hit an unexpected error in ${name}: ${e?.message ?? e}. Please report it with the arguments you passed.` }], isError: true }
      }
    },
    "prompts/list": () => ({ prompts: PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, arguments: args })) }),
    "prompts/get"(params) {
      const name = params?.name
      if (typeof name !== "string") throw new ParamsError("prompts/get needs the name of a prompt.")
      const prompt = prompts.get(name)
      if (!prompt) throw new ParamsError(`There's no prompt called ${name}. The prompts are ${PROMPTS.map((p) => p.name).join(", ")}.`)
      const args = params.arguments ?? {}
      if (typeof args !== "object" || Array.isArray(args)) throw new ParamsError("A prompt's arguments are an object of strings.")
      for (const a of prompt.arguments) {
        if (a.required && !(typeof args[a.name] === "string" && args[a.name].trim())) throw new ParamsError(`The ${name} prompt needs ${a.name}: ${a.description.charAt(0).toLowerCase()}${a.description.slice(1)}.`)
      }
      return { description: prompt.description, messages: [{ role: "user", content: { type: "text", text: prompt.render(args) } }] }
    },
  }

  const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } })

  async function receive(line) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      return error(null, PARSE_ERROR, "That message isn't valid JSON. Send one JSON-RPC message per line.")
    }
    if (Array.isArray(msg)) return error(null, INVALID_REQUEST, "Batches aren't supported. Send one JSON-RPC message per line.")
    if (!msg || typeof msg !== "object") return error(null, INVALID_REQUEST, "A message is a JSON-RPC 2.0 object.")
    const id = typeof msg.id === "string" || typeof msg.id === "number" ? msg.id : null
    const isRequest = "id" in msg && msg.id !== null
    if (msg.jsonrpc !== "2.0") return isRequest || !("method" in msg) ? error(id, INVALID_REQUEST, 'A message needs "jsonrpc": "2.0".') : null
    if (typeof msg.method !== "string") return "result" in msg || "error" in msg ? null : error(id, INVALID_REQUEST, "A request needs a method.")
    // Notifications (initialized, cancelled and the rest) need no answer.
    if (!isRequest) return null
    const handler = Object.hasOwn(methods, msg.method) ? methods[msg.method] : null
    if (!handler) return error(id, METHOD_NOT_FOUND, `There's no method called ${msg.method}.`)
    if (msg.params !== undefined && (typeof msg.params !== "object" || msg.params === null || Array.isArray(msg.params))) return error(id, INVALID_PARAMS, "Params are an object.")
    try {
      return { jsonrpc: "2.0", id, result: await handler(msg.params) }
    } catch (e) {
      if (e instanceof ParamsError) return error(id, INVALID_PARAMS, e.message)
      process.stderr.write(`halation mcp: ${msg.method} failed: ${e?.stack ?? e}\n`)
      return error(id, INTERNAL_ERROR, `Halation hit an unexpected error: ${e?.message ?? e}`)
    }
  }

  return { receive, get protocolVersion() { return protocolVersion } }
}

/**
 * Serves over stdio until the input ends: one JSON-RPC message per line in,
 * one per line out. Requests run side by side, so a ping answers while a
 * page check is still loading.
 */
export async function serveMcp({ input = process.stdin, output = process.stdout, root = process.cwd() } = {}) {
  const server = createMcpServer({ root })
  // Only protocol messages go to stdout: anything a dependency logs goes to stderr.
  const saved = { log: console.log, info: console.info, debug: console.debug }
  console.log = console.info = console.debug = (...args) => console.error(...args)
  const send = (message) => output.write(`${JSON.stringify(message)}\n`)
  const pending = new Set()
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      if (!line.trim()) continue
      const job = server.receive(line).then((response) => response && send(response))
      pending.add(job)
      job.finally(() => pending.delete(job))
    }
    await Promise.allSettled([...pending])
  } finally {
    Object.assign(console, saved)
  }
}
