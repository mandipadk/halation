// `halation gate`: reads what a build emitted (its CSS files, and the style
// blocks and style attributes of its HTML) and refuses declarations that are
// off the system, whatever produced them: a Tailwind arbitrary value, a
// library's styles, CSS-in-JS extracted at build time, a style in a template.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { corePath, loadRules } from "./rules.js"
import { displayPath, UsageError } from "./lint.js"

/** Where builds usually put their output, in the order they're looked for. */
export const BUILD_OUTPUT = ["dist", "build", "out", ".next/static", ".output/public"]

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const clip = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 3)}...` : s)
const slash = (p) => p.split(path.sep).join("/")

// ---------------------------------------------------------------------------
// Parsing

/** Where the string starting at `i` (at its quote) ends: just past the closing quote, or at a newline. */
function stringEnd(text, i) {
  const quote = text[i]
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j]
    if (c === "\\") j++
    else if (c === quote) return j + 1
    else if (c === "\n") return j
  }
  return text.length
}

const commentEnd = (text, i) => {
  const end = text.indexOf("*/", i + 2)
  return end === -1 ? text.length : end + 2
}

/** Whether `(` at `i` opens an unquoted url(), whose contents are raw. */
function rawUrl(text, i) {
  if (!/url$/i.test(text.slice(Math.max(0, i - 3), i)) || /[\w-]/.test(text[i - 4] ?? "")) return false
  let j = i + 1
  while (/\s/.test(text[j] ?? "")) j++
  return text[j] !== '"' && text[j] !== "'"
}

/**
 * Scans from `i` to the first `;`, `{` or `}` outside strings, comments,
 * escapes and brackets. With `braces`, balanced `{}` are stepped over too
 * (custom property values may hold them). Returns the offset of the stop
 * character, or the text's length.
 */
function scanTo(text, i, braces = false) {
  let depth = 0
  for (; i < text.length; i++) {
    const c = text[i]
    if (c === "\\") i++
    else if (c === '"' || c === "'") i = stringEnd(text, i) - 1
    else if (c === "/" && text[i + 1] === "*") i = commentEnd(text, i) - 1
    else if (c === "(" && rawUrl(text, i)) {
      const end = text.indexOf(")", i)
      i = end === -1 ? text.length : end
    } else if (c === "(" || c === "[" || (braces && c === "{")) depth++
    else if ((c === ")" || c === "]" || (braces && c === "}")) && depth > 0) depth--
    else if (depth === 0 && (c === ";" || c === "{" || c === "}")) return i
  }
  return text.length
}

/** Splits `s` at top-level occurrences of `sep` (a single character, or whitespace when " "). */
export function splitTop(s, sep = ",") {
  const out = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "\\") i++
    else if (c === '"' || c === "'") i = stringEnd(s, i) - 1
    else if (c === "(" || c === "[") depth++
    else if ((c === ")" || c === "]") && depth > 0) depth--
    else if (depth === 0 && (sep === " " ? /\s/.test(c) : c === sep)) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out.map((p) => p.trim()).filter((p) => p !== "")
}

const stripComments = (s) => {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"' || s[i] === "'") {
      const end = stringEnd(s, i)
      out += s.slice(i, end)
      i = end - 1
    } else if (s[i] === "/" && s[i + 1] === "*") i = commentEnd(s, i) - 1
    else out += s[i]
  }
  return out
}

/** Resolves a nested selector against its parent, the way CSS nesting does. */
function nest(parent, child) {
  if (!parent) return child
  const p = splitTop(parent).length > 1 ? `:is(${parent})` : parent
  return splitTop(child)
    .map((c) => (c.includes("&") ? c.replaceAll("&", p) : `${parent} ${c}`))
    .join(", ")
}

/** At-rules whose blocks hold descriptors, not styles: nothing in them is checked. */
const DESCRIPTOR_AT = new Set(["font-face", "property", "counter-style", "font-palette-values", "font-feature-values", "theme", "view-transition", "color-profile"])

/**
 * Parses a style sheet into its declarations, flattened: each has the
 * selector it applies to (nesting resolved), the at-rules around it, the
 * property, the value and where it starts. Comments, strings, escapes,
 * nested at-rules, and custom properties whose values hold braces or
 * semicolons in strings are all handled.
 */
export function parseCss(text, { base = 0, selector = null } = {}) {
  const decls = []
  const block = (i, ctx) => {
    while (i < text.length) {
      const c = text[i]
      if (/\s|;/.test(c)) {
        i++
        continue
      }
      if (c === "/" && text[i + 1] === "*") {
        i = commentEnd(text, i)
        continue
      }
      if (c === "<" && text.startsWith("<!--", i)) {
        i += 4
        continue
      }
      if (c === "-" && text.startsWith("-->", i)) {
        i += 3
        continue
      }
      if (c === "}") return i + 1
      if (c === "@") {
        const name = /^@([\w-]+)/.exec(text.slice(i, i + 64))?.[1]?.toLowerCase() ?? ""
        const stop = scanTo(text, i + 1 + name.length)
        const prelude = stripComments(text.slice(i + 1 + name.length, stop)).trim().replace(/\s+/g, " ")
        if (text[stop] !== "{") {
          i = text[stop] === ";" ? stop + 1 : stop
          continue
        }
        const at = `@${name}${prelude ? ` ${prelude}` : ""}`
        const inner = {
          ...ctx,
          at: [...ctx.at, at],
          keyframes: ctx.keyframes || /keyframes$/.test(name),
          descriptors: ctx.descriptors || DESCRIPTOR_AT.has(name.replace(/^-\w+-/, "")),
          properties: ctx.properties || (name === "layer" && /^properties$/i.test(prelude)),
          selector: /keyframes$/.test(name) ? null : ctx.selector,
          atName: name,
        }
        i = block(stop + 1, inner)
        continue
      }
      const custom = /^--[\w-]*\s*:/.test(text.slice(i, i + 256))
      const stop = scanTo(text, i, custom)
      if (text[stop] === "{" && !custom) {
        const prelude = stripComments(text.slice(i, stop)).trim().replace(/\s+/g, " ")
        i = block(stop + 1, { ...ctx, selector: ctx.keyframes ? prelude : nest(ctx.selector, prelude) })
        continue
      }
      const raw = text.slice(i, stop)
      const colon = raw.indexOf(":")
      if (colon > 0) {
        const prop = stripComments(raw.slice(0, colon)).trim()
        let value = raw.slice(colon + 1)
        if (!prop.startsWith("--")) value = stripComments(value)
        value = value.trim()
        let important = false
        const bang = /!\s*important\s*$/i.exec(value)
        if (bang) {
          important = true
          value = value.slice(0, bang.index).trim()
        }
        if (/^-?[a-z_-][\w-]*$/i.test(prop)) {
          decls.push({
            selector: ctx.selector ?? (ctx.at.length ? ctx.at[ctx.at.length - 1] : ""),
            at: ctx.at,
            keyframes: ctx.keyframes,
            descriptors: ctx.descriptors,
            properties: ctx.properties,
            prop: prop.startsWith("--") ? prop : prop.toLowerCase(),
            value,
            important,
            offset: base + i,
          })
        }
      }
      i = text[stop] === "}" ? stop : stop + 1
    }
    return i
  }
  block(0, { selector, at: [], keyframes: false, descriptors: false, properties: false })
  return decls
}

const ENTITIES = { quot: '"', apos: "'", amp: "&", lt: "<", gt: ">", nbsp: " " }
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return ENTITIES[e.toLowerCase()] ?? m
  })

/**
 * The styles in an HTML document: the text of each CSS <style> block and
 * each style="" attribute, with where it starts and, for an attribute, its tag.
 */
export function extractHtml(text) {
  const sheets = []
  const attrs = []
  const lower = text.toLowerCase()
  let i = 0
  while ((i = text.indexOf("<", i)) !== -1) {
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4)
      i = end === -1 ? text.length : end + 3
      continue
    }
    const name = /^<([a-z][\w:-]*)/i.exec(text.slice(i, i + 64))?.[1]?.toLowerCase()
    if (!name) {
      const end = text.indexOf(">", i + 1)
      i = end === -1 ? text.length : end + 1
      continue
    }
    // The tag's attributes.
    let j = i + 1 + name.length
    const tagAttrs = {}
    let style = null
    while (j < text.length && text[j] !== ">") {
      if (/[\s/]/.test(text[j])) {
        j++
        continue
      }
      const attr = /^[^\s=>/]+/.exec(text.slice(j, j + 256))?.[0] ?? text[j]
      j += attr.length
      while (/\s/.test(text[j] ?? "")) j++
      if (text[j] !== "=") {
        tagAttrs[attr.toLowerCase()] = ""
        continue
      }
      j++
      while (/\s/.test(text[j] ?? "")) j++
      let value
      let at = j
      if (text[j] === '"' || text[j] === "'") {
        const end = text.indexOf(text[j], j + 1)
        at = j + 1
        value = text.slice(j + 1, end === -1 ? text.length : end)
        j = end === -1 ? text.length : end + 1
      } else {
        value = /^[^\s>]*/.exec(text.slice(j))[0]
        j += value.length
      }
      tagAttrs[attr.toLowerCase()] = value
      if (attr.toLowerCase() === "style") style = { text: decode(value), offset: at, tag: name }
    }
    if (style) attrs.push({ ...style, counterexample: "data-counterexample" in tagAttrs })
    j++
    if (name === "script" || name === "style") {
      const close = lower.indexOf(`</${name}`, j)
      const end = close === -1 ? text.length : close
      const type = (tagAttrs.type ?? "text/css").toLowerCase().trim()
      if (name === "style" && (type === "" || type === "text/css")) sheets.push({ text: text.slice(j, end), offset: j })
      i = end
      continue
    }
    i = j
  }
  return { sheets, attrs }
}

// ---------------------------------------------------------------------------
// Colors

/** Every CSS named color except transparent and currentColor. */
const NAMED = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral " +
    "cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange " +
    "darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey " +
    "dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred " +
    "indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey " +
    "lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon " +
    "mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue " +
    "mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred " +
    "papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna " +
    "silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
)

const COLOR_FN = /(?<![\w-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi
/** Properties where a bare word can be a color. */
const TAKES_COLOR = /color|background|border|outline|shadow|^fill$|^stroke$|^filter$|column-rule|text-decoration|text-emphasis|-webkit-text-stroke|^caret|^accent/

/** The index just past the parenthesis that closes the one at `open`. */
function closeParen(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === "\\") i++
    else if (c === '"' || c === "'") i = stringEnd(s, i) - 1
    else if (c === "(") depth++
    else if (c === ")" && --depth === 0) return i + 1
  }
  return s.length
}

/** `s` with strings and url() contents blanked out, same length, so offsets still line up. */
function blankRaw(s) {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'") {
      const end = stringEnd(s, i)
      out += c + " ".repeat(Math.max(0, end - i - 2)) + (end - i > 1 ? c : "")
      i = end - 1
    } else if (c === "(" && /url$/i.test(s.slice(Math.max(0, i - 3), i))) {
      const end = closeParen(s, i)
      out += `(${" ".repeat(Math.max(0, end - i - 2))})`
      i = end - 1
    } else out += c
  }
  return out
}

const num = (t, percentScale = 1) => {
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|turn|grad)?$/i.exec(t)
  if (!m) return t.toLowerCase() === "none" ? 0 : Number.NaN
  const n = Number(m[1])
  const unit = (m[2] ?? "").toLowerCase()
  if (unit === "%") return (n / 100) * percentScale
  if (unit === "rad") return (n * 180) / Math.PI
  if (unit === "turn") return n * 360
  if (unit === "grad") return n * 0.9
  return n
}

const mul = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2])
const D50_TO_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
]
const XYZ_TO_SRGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
]
const P3_TO_XYZ = [
  [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
]
const decodeSrgb = (c) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4)

function linearToOklab([R, G, B]) {
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** Whether an OKLab color lies outside sRGB, where an sRGB fallback can only approximate it. */
function outsideSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return rgb.some((c) => c < -0.002 || c > 1.002)
}

function labToLinear(L, a, b) {
  const fy = (L + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200
  const e = 216 / 24389
  const k = 24389 / 27
  const xyz = [fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k, L > k * e ? fy ** 3 : L / k, fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k]
  const d50 = [xyz[0] * 0.3457 / 0.3585, xyz[1], (xyz[2] * (1 - 0.3457 - 0.3585)) / 0.3585]
  return mul(XYZ_TO_SRGB, mul(D50_TO_D65, d50))
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))
}

const polar = (C, h) => [C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]

/** A color literal as [L, a, b, alpha] in OKLab, or null when it can't be computed (a var inside, a relative color). */
export function colorVector(literal) {
  const s = literal.trim().toLowerCase()
  if (s === "transparent") return [0, 0, 0, 0]
  if (s[0] === "#") {
    const hex = s.slice(1)
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex
    const v = [0, 2, 4, 6].map((i) => (i < full.length ? Number.parseInt(full.slice(i, i + 2), 16) / 255 : 1))
    if (v.some(Number.isNaN)) return null
    return [...linearToOklab(v.slice(0, 3).map(decodeSrgb)), v[3]]
  }
  const m = /^([a-z]+)\((.*)\)$/s.exec(s)
  if (!m || /var\(|from\s|calc\(/.test(m[2])) return null
  const [main, alphaPart] = m[2].includes("/") ? m[2].split("/") : [m[2], null]
  let parts = main.includes(",") ? main.split(",") : main.trim().split(/\s+/)
  parts = parts.map((p) => p.trim()).filter(Boolean)
  const fn = m[1]
  let space = null
  if (fn === "color") space = parts.shift()
  let alpha = alphaPart === null ? (parts.length === 4 ? num(parts.pop()) : 1) : num(alphaPart.trim())
  if (parts.length !== 3) return null
  let lab
  if (fn === "rgb" || fn === "rgba") lab = linearToOklab(parts.map((p) => decodeSrgb(p.endsWith("%") ? num(p) : num(p) / 255)))
  else if (fn === "hsl" || fn === "hsla") lab = linearToOklab(hslToRgb(num(parts[0]), num(parts[1]), num(parts[2])).map(decodeSrgb))
  else if (fn === "hwb") {
    const [h, w, b] = [num(parts[0]), num(parts[1]), num(parts[2])]
    const rgb = hslToRgb(h, 1, 0.5).map((c) => (w + b >= 1 ? w / (w + b) : c * (1 - w - b) + w))
    lab = linearToOklab(rgb.map(decodeSrgb))
  } else if (fn === "oklch") lab = [num(parts[0]), ...polar(num(parts[1], 0.4), num(parts[2]))]
  else if (fn === "oklab") lab = [num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)]
  else if (fn === "lab") lab = linearToOklab(labToLinear(num(parts[0], 100), num(parts[1], 125), num(parts[2], 125)))
  else if (fn === "lch") lab = linearToOklab(labToLinear(num(parts[0], 100), ...polar(num(parts[1], 150), num(parts[2]))))
  else if (fn === "color" && (space === "srgb" || space === "srgb-linear")) {
    const v = parts.map((p) => num(p))
    lab = linearToOklab(space === "srgb" ? v.map(decodeSrgb) : v)
  } else if (fn === "color" && space === "display-p3") lab = linearToOklab(mul(XYZ_TO_SRGB, mul(P3_TO_XYZ, parts.map((p) => decodeSrgb(num(p))))))
  else return null
  if ([...lab, alpha].some(Number.isNaN)) return null
  alpha = Math.max(0, Math.min(1, alpha))
  return [...lab, alpha]
}

/**
 * Whether two color vectors are the same color, within what minifiers
 * round away. A color outside sRGB may have been approximated by an sRGB
 * fallback, so it matches more loosely.
 */
const sameColor = (x, y) => {
  if (!x || !y) return false
  if (x[3] < 0.005 && y[3] < 0.005) return true
  const d = Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
  const limit = outsideSrgb(x) || outsideSrgb(y) ? 0.06 : 0.008
  return d < limit && Math.abs(x[3] - y[3]) < 0.011
}

/**
 * The literal colors in a value: hex, color functions (except relative
 * colors built from a var), and, when `names`, named colors. Each comes with
 * whether it's fully clear, which counts as transparent.
 */
export function literalColors(value, { names = true } = {}) {
  const s = blankRaw(value)
  const found = []
  for (const m of s.matchAll(/(?<![\w&#-])#([0-9a-f]{3,8})(?![\w-])/gi)) {
    if (![3, 4, 6, 8].includes(m[1].length)) continue
    found.push({ text: m[0], at: m.index })
  }
  COLOR_FN.lastIndex = 0
  for (const m of s.matchAll(COLOR_FN)) {
    const open = m.index + m[0].length - 1
    const end = closeParen(s, open)
    const args = s.slice(open + 1, end - 1).trim()
    if (/^from\s+var\(/i.test(args)) continue
    found.push({ text: value.slice(m.index, end), at: m.index })
  }
  if (names) {
    for (const m of s.matchAll(/(?<![\w.#$@-])([a-z]+)(?![\w(-])/gi)) {
      if (NAMED.has(m[1].toLowerCase())) found.push({ text: m[1], at: m.index })
    }
  }
  // A literal nested in another (a hex inside a relative color) is reported once, by the outer one.
  found.sort((a, b) => a.at - b.at || b.text.length - a.text.length)
  const out = []
  let reach = -1
  for (const f of found) {
    if (f.at < reach) continue
    reach = f.at + f.text.length
    const v = colorVector(f.text)
    out.push({ text: f.text, clear: !!v && v[3] < 0.005 })
  }
  return out
}

// ---------------------------------------------------------------------------
// Halation's own declarations, and matching them however a minifier wrote them

/** A value in one spelling: case, whitespace, quotes, numbers and units evened out, colors pulled out as vectors. */
export function canonValue(value) {
  // Strings to double quotes, everything else lowercase.
  let s = ""
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === '"' || c === "'") {
      const end = stringEnd(value, i)
      s += `"${value.slice(i + 1, end - 1).replaceAll('"', '\\"')}"`
      i = end - 1
    } else s += c.toLowerCase()
  }
  s = s.replace(/\s+/g, " ").replace(/\s*([(),/*])\s*/g, "$1").trim()
  // Colors out, as numbered placeholders.
  const colors = []
  const take = (text) => {
    colors.push(colorVector(text))
    return `§${colors.length - 1}§`
  }
  let out = ""
  for (let i = 0; i < s.length; ) {
    COLOR_FN.lastIndex = i
    const fn = COLOR_FN.exec(s)
    const hex = /(?<![\w&#-])#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/g
    hex.lastIndex = i
    const h = hex.exec(s)
    const word = /(?<![\w-])transparent(?![\w-])/g
    word.lastIndex = i
    const w = word.exec(s)
    const next = [fn && { at: fn.index, end: closeParen(s, fn.index + fn[0].length - 1) }, h && { at: h.index, end: h.index + h[0].length }, w && { at: w.index, end: w.index + w[0].length }]
      .filter(Boolean)
      .sort((a, b) => a.at - b.at)[0]
    if (!next) {
      out += s.slice(i)
      break
    }
    const text = s.slice(next.at, next.end)
    out += s.slice(i, next.at) + (colorVector(text) ? take(text) : text)
    i = next.end
  }
  s = out
  // Numbers: leading zeros, trailing zeros, ms to s, zero lengths to 0.
  s = s.replace(/(?<![\w§.-])([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)/g, (m, n, unit) => {
    let v = Number(n)
    if (unit === "ms") {
      v /= 1000
      unit = "s"
    }
    if (v === 0 && unit !== "s" && unit !== "deg" && unit !== "x" && unit !== "fr") return "0"
    return `${+v.toFixed(4)}${unit}`
  })
  s = s.replace(/\s*([(),/*])\s*/g, "$1")
  // lightningcss writes light-dark() as a pair of vars; read it back, and a pair of equal colors as one.
  s = s.replace(/var\(--lightningcss-light,((?:[^()]|\([^()]*\))*)\)var\(--lightningcss-dark,((?:[^()]|\([^()]*\))*)\)/g, "light-dark($1,$2)")
  s = s.replace(/light-dark\((§(\d+)§),(§(\d+)§)\)/g, (m, a, i, b, j) => (sameColor(colors[+i], colors[+j]) ? a : m))
  // A linear gradient going down says nothing a minifier keeps.
  s = s.replace(/((?:repeating-)?linear-gradient\()(?:to bottom|180deg),/g, "$1")
  // Renumber the colors in order of appearance.
  const used = []
  s = s.replace(/§(\d+)§/g, (m, i) => {
    used.push(colors[+i])
    return "§"
  })
  return { key: s.replace(/\s*§\s*/g, "§"), colors: used }
}

/** A selector in one spelling: whitespace, quotes in attribute selectors, pseudo-element colons and case evened out. */
export function canonSelector(sel) {
  let s = ""
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (c === "\\") {
      s += sel.slice(i, i + 2)
      i++
    } else if (c === '"' || c === "'") {
      const end = stringEnd(sel, i)
      const inner = sel.slice(i + 1, end - 1)
      s += /^-?[a-z_][\w-]*$/i.test(inner) ? inner : `"${inner}"`
      i = end - 1
    } else s += c
  }
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*([>+~,()=\]\[])\s*/g, "$1")
    .replace(/::(before|after|first-line|first-letter)\b/gi, ":$1")
    .toLowerCase()
    .trim()
}

const BOX = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius", "border-bottom-right-radius", "border-bottom-left-radius"],
  inset: ["top", "right", "bottom", "left"],
}
const PAIRS = {
  "padding-inline": ["padding-inline-start", "padding-inline-end"],
  "padding-block": ["padding-block-start", "padding-block-end"],
  "margin-inline": ["margin-inline-start", "margin-inline-end"],
  "margin-block": ["margin-block-start", "margin-block-end"],
  gap: ["row-gap", "column-gap"],
}

/** A shorthand as its longhands, so a minifier merging or splitting them still matches. */
function longhands(prop, value) {
  const parts = splitTop(value, " ")
  if (BOX[prop] && parts.length >= 1 && parts.length <= 4 && !value.includes("/")) {
    const [t, r = t, b = t, l = r] = parts
    return BOX[prop].map((p, i) => [p, [t, r, b, l][i]])
  }
  if (PAIRS[prop] && parts.length >= 1 && parts.length <= 2) {
    const [a, z = a] = parts
    return [
      [PAIRS[prop][0], a],
      [PAIRS[prop][1], z],
    ]
  }
  return null
}

const unprefixed = (prop) => prop.replace(/^-(webkit|moz|ms|o)-/, "")

/** An index of declarations known to be Halation's own (or Tailwind's preflight), keyed by selector, property and value. */
export class OwnStyles {
  constructor() {
    this.map = new Map()
    this.sources = []
  }
  addCss(text, source) {
    this.sources.push(source)
    for (const d of parseCss(text.replace(/--theme\(/g, "var("))) this.add(d.selector, d.prop, d.value)
    return this
  }
  add(selector, prop, value) {
    const put = (p, v) => {
      for (const sel of splitTop(selector || "")) {
        const { key, colors } = canonValue(v)
        const k = `${canonSelector(sel)}\u0000${unprefixed(p)}\u0000${key}`
        if (!this.map.has(k)) this.map.set(k, [])
        this.map.get(k).push(colors)
      }
    }
    put(prop, value)
    for (const [p, v] of longhands(prop, value) ?? []) put(p, v)
  }
  hasOne(sel, prop, value) {
    const { key, colors } = canonValue(value)
    const list = this.map.get(`${sel}\u0000${unprefixed(prop)}\u0000${key}`)
    return !!list?.some((c) => c.length === colors.length && c.every((v, i) => (v && colors[i] ? sameColor(v, colors[i]) : v === colors[i])))
  }
  /** Whether this exact declaration, under every selector it's written for, is one of the known ones. */
  has(selector, prop, value) {
    if (!selector) return false
    return splitTop(selector).every((raw) => {
      const sel = canonSelector(raw)
      if (this.hasOne(sel, prop, value)) return true
      const parts = longhands(prop, value)
      return !!parts && parts.every(([p, v]) => this.hasOne(sel, p, v))
    })
  }
}

/** The CSS folder of an installed @halation/core, found from `from` (a folder), or the one the CLI was installed with. */
function coreCssDirs(from) {
  const dirs = new Set()
  try {
    dirs.add(path.dirname(corePath("tokens.css")))
  } catch {}
  for (const dir of from) {
    try {
      dirs.add(path.dirname(createRequire(path.join(dir, "package.json")).resolve("@halation/core/tokens.css")))
    } catch {}
  }
  return [...dirs]
}

/** Tailwind's preflight, when the project (or Halation's theme) can resolve tailwindcss. */
function preflightFiles(from) {
  const files = new Set()
  for (const dir of from) {
    try {
      files.add(createRequire(path.join(dir, "package.json")).resolve("tailwindcss/preflight.css"))
    } catch {}
  }
  return [...files]
}

/** Halation's own styles, read from every CSS file of the installed core, plus Tailwind's preflight when it's installed. */
export function loadOwnStyles(from = [process.cwd()]) {
  const own = new OwnStyles()
  const cssDirs = coreCssDirs(from)
  for (const dir of cssDirs) {
    for (const name of readdirSync(dir).sort()) if (name.endsWith(".css")) own.addCss(readFileSync(path.join(dir, name), "utf8"), path.join(dir, name))
  }
  for (const file of preflightFiles([...from, ...cssDirs.map((d) => path.dirname(d))])) own.addCss(readFileSync(file, "utf8"), file)
  return own
}

// ---------------------------------------------------------------------------
// The checks

const KEYWORDS = new Set(["inherit", "initial", "unset", "revert", "revert-layer"])
const isKeyword = (v) => KEYWORDS.has(v.trim().toLowerCase())

/** The var() names a value reads. */
const varsIn = (v) => [...v.matchAll(/var\(\s*(--[\w-]+)/gi)].map((m) => m[1].toLowerCase())

/** A lone var(), with or without a fallback: its name, or null. */
const loneVar = (v) => {
  const t = v.trim()
  if (!/^var\(/i.test(t) || closeParen(t, 3) !== t.length) return null
  return /^var\(\s*(--[\w-]+)/i.exec(t)?.[1].toLowerCase() ?? null
}

/** The fallback of a lone var(), or null. */
const fallbackOf = (v) => {
  const t = v.trim()
  const inner = t.slice(4, -1)
  const parts = splitTop(inner)
  return parts.length > 1 ? inner.slice(inner.indexOf(",") + 1).trim() : null
}

// A small calc() evaluator, for spacing and radii: lengths in px, a var's value from `env`.

class Unknown extends Error {}

function evaluate(expr, env) {
  let i = 0
  const s = expr.trim()
  const ws = () => {
    while (/\s/.test(s[i] ?? "")) i++
  }
  const sum = () => {
    let v = product()
    for (;;) {
      ws()
      if (s[i] === "+" || s[i] === "-") {
        const op = s[i++]
        const r = product()
        v = op === "+" ? v + r : v - r
      } else return v
    }
  }
  const product = () => {
    let v = unary()
    for (;;) {
      ws()
      if (s[i] === "*" || s[i] === "/") {
        const op = s[i++]
        const r = unary()
        v = op === "*" ? v * r : v / r
      } else return v
    }
  }
  const args = () => {
    const out = []
    for (;;) {
      out.push(sum())
      ws()
      if (s[i] === ",") i++
      else if (s[i] === ")") {
        i++
        return out
      } else throw new Unknown()
    }
  }
  const unary = () => {
    ws()
    if (s[i] === "-" && !/\d|\./.test(s[i + 1] ?? "")) {
      i++
      return -unary()
    }
    if (s[i] === "+") {
      i++
      return unary()
    }
    if (s[i] === "(") {
      i++
      const v = sum()
      ws()
      if (s[i++] !== ")") throw new Unknown()
      return v
    }
    const n = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?([a-z%]*)/i.exec(s.slice(i))
    if (n) {
      i += n[0].length
      const v = Number.parseFloat(n[0])
      const unit = n[1].toLowerCase()
      if (unit === "" || unit === "px") return v
      if (unit === "rem") return v * 16
      if (unit === "%") return env.percent(v)
      throw new Unknown()
    }
    const f = /^([a-z-]+)\(/i.exec(s.slice(i))
    if (!f) throw new Unknown()
    const name = f[1].toLowerCase()
    i += f[0].length
    if (name === "var") {
      ws()
      const v = /^--[\w-]+/.exec(s.slice(i))?.[0]
      if (!v) throw new Unknown()
      i += v.length
      ws()
      // Skip a fallback; the var's value comes from env.
      if (s[i] === ",") {
        let depth = 0
        for (; i < s.length; i++) {
          if (s[i] === "(") depth++
          else if (s[i] === ")" && depth-- === 0) break
        }
      }
      if (s[i++] !== ")") throw new Unknown()
      return env.variable(v.toLowerCase())
    }
    if (name === "calc") {
      const v = sum()
      ws()
      if (s[i++] !== ")") throw new Unknown()
      return v
    }
    if (name === "min" || name === "max") return Math[name](...args())
    if (name === "clamp") {
      const [lo, v, hi] = args()
      return Math.max(lo, Math.min(v, hi))
    }
    throw new Unknown()
  }
  const v = sum()
  ws()
  if (i !== s.length) throw new Unknown()
  return v
}

/**
 * The custom properties defined in what's being checked, by name. A value
 * that reads one through var() passes when every definition of it passes the
 * same check: an alias like --gutter: var(--space-gutter) is still a named
 * space, and --gutter: 13px is still off the grid.
 */
let aliases = null
const resolving = new Set()
function aliasOk(name, check) {
  const defs = aliases?.get(name)
  if (!defs?.length || resolving.has(name)) return false
  resolving.add(name)
  try {
    return defs.every((d) => check(d.value))
  } finally {
    resolving.delete(name)
  }
}

/**
 * Every custom property definition in a list of declarations, by name, each
 * as { value, own }: own when it's one of Halation's own declarations.
 */
export function definitions(decls, own = null) {
  const defs = new Map()
  for (const d of decls) {
    if (!d.prop.startsWith("--") || d.descriptors) continue
    if (!defs.has(d.prop)) defs.set(d.prop, [])
    defs.get(d.prop).push({ value: d.value, own: !!own?.has(d.selector, d.prop, d.value), properties: d.properties })
  }
  return defs
}

/**
 * The first variable a value reads (outside the color tokens and Tailwind's
 * own variables, which are checked where they're defined) whose definition,
 * outside Halation's own CSS, holds a literal color, followed through other
 * variables. Null when there's none.
 */
function colorThroughAlias(value, seen = new Set()) {
  for (const name of varsIn(blankRaw(value))) {
    if (/^--(color|tw|lightningcss)-/.test(name) || seen.has(name)) continue
    seen.add(name)
    for (const d of aliases?.get(name) ?? []) {
      if (d.own) continue
      if (literalColors(d.value).some((c) => !c.clear)) return name
      const deeper = colorThroughAlias(d.value, seen)
      if (deeper) return deeper
    }
  }
  return null
}

const near = (x, step) => Math.abs(x / step - Math.round(x / step)) < 1e-6
/** On the grid: 2 px steps up to 24 px, then 4 px steps. */
const onGrid = (px) => {
  const n = Math.abs(px)
  return n < 1e-6 || (n <= 24 + 1e-6 ? near(n, 2) : near(n, 4))
}

/** Whether a spacing value (padding, margin, gap) sits on the grid. */
function spacingOk(value, { margin = false } = {}) {
  if (isKeyword(value)) return true
  return splitTop(value, " ").every((part) => {
    const p = part.toLowerCase()
    if (margin && p === "auto") return true
    if (p === "normal" && !margin) return true
    const vars = varsIn(p)
    if (vars.some((v) => /^--(space|spacing|m)-/.test(v))) return true
    const other = vars.filter((v) => v !== "--spacing" && !/^--tw-[\w-]*reverse$/.test(v))
    if (other.length) return other.every((v) => aliasOk(v, (x) => spacingOk(x, { margin })))
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)%$/.test(p)) return true
    const run = (spacing, reverse) =>
      evaluate(p, {
        percent: () => 0,
        variable: (name) => (name === "--spacing" ? spacing : reverse),
      })
    try {
      for (const reverse of vars.some((v) => v.startsWith("--tw-")) ? [0, 1] : [0]) {
        if (vars.includes("--spacing")) {
          const a = run(4, reverse)
          const b = run(8, reverse)
          const steps = (b - a) / 4
          const rest = a - 4 * steps
          if (!near(steps, 0.5) || !onGrid(rest)) return false
        } else if (!onGrid(run(4, reverse))) return false
      }
      return true
    } catch (e) {
      if (e instanceof Unknown) return false
      throw e
    }
  })
}

const FULL = new Set(["9999px", "999px", "50%", "100%"])

/** Whether a radius value comes from the scale, a full pill, or nests inside a parent's. */
function radiusOk(value) {
  if (isKeyword(value)) return true
  return splitTop(value.replace(/\//g, " "), " ").every((part) => {
    const p = part.toLowerCase()
    if (FULL.has(p) || /^[+-]?0*\.?0+(?:[a-z%]+)?$/.test(p)) return true
    const vars = varsIn(p)
    if (vars.length) return vars.every((v) => /^--(radius|m)-/.test(v) || aliasOk(v, radiusOk))
    try {
      const px = evaluate(p, { percent: (n) => (n === 50 || n === 100 ? 9999 : Number.NaN), variable: () => Number.NaN })
      return px === 0 || px >= 999
    } catch {
      return false
    }
  })
}

/** Whether a font-size is one of the text styles, or a small relative nudge like the serif phrase's 1.06em. */
function fontSizeOk(value) {
  const v = value.trim().toLowerCase()
  if (isKeyword(v)) return true
  const lone = loneVar(v)
  if (lone) return (/^--text-[\w-]+$/.test(lone) && !lone.includes("--", 2)) || /^--m-/.test(lone) || aliasOk(lone, fontSizeOk)
  const rel = /^([+-]?(?:\d+\.?\d*|\.\d+))(em|%)$/.exec(v)
  if (rel) {
    const n = Number(rel[1]) / (rel[2] === "%" ? 100 : 1)
    return n >= 0.9 - 1e-9 && n <= 1.2 + 1e-9
  }
  // Built from text tokens and component metrics: calc(var(--m-unit) * 1em), or a
  // text style capped by a metric, min(var(--text-display-xl), var(--m-fit)).
  if (/^(calc|min|max|clamp)\(/.test(v)) {
    const vars = varsIn(v)
    const bare = v.replace(/var\((?:[^()]|\([^()]*\))*\)/g, "")
    return vars.length > 0 && vars.every((x) => (/^--text-[\w-]+$/.test(x) && !x.includes("--", 2)) || /^--m-/.test(x)) && !/\d(px|rem|vw|vh|vmin|vmax|vi|vb|ch|ex|pt|pc|cm|mm|in|q|lh|rlh|cap|ic|%)\b/.test(bare)
  }
  return false
}

/** Whether a letter-spacing adds nothing beyond the text styles' own tracking. */
function trackingOk(value) {
  const v = value.trim().toLowerCase()
  if (isKeyword(v) || v === "normal" || /^[+-]?(?:0+\.?0*|\.0+)(?:[a-z%]+)?$/.test(v)) return true
  const lone = loneVar(v)
  if (lone === "--tw-tracking") return fallbackOf(v) === null || trackingOk(fallbackOf(v))
  return !!lone && (/^--(text-[\w-]+--letter-spacing|font-serif--letter-spacing)$/.test(lone) || aliasOk(lone, trackingOk))
}

/** Whether a font-family comes from the lens's tokens (or Tailwind's defaults, which Halation's theme points at them). */
function familyOk(value) {
  const v = value.trim()
  if (isKeyword(v)) return true
  const lone = loneVar(v)
  if (!lone) return false
  if (/^--font-[\w-]+$/.test(lone) && !/--letter-spacing$/.test(lone)) return true
  return lone === "--default-font-family" || lone === "--default-mono-font-family" || aliasOk(lone, familyOk)
}

/** Faces that give a page the default, generated look when they lead a stack. */
const DEFAULT_LOOK = new Set(["inter", "roboto", "arial", "helvetica", "helvetica neue", "open sans", "montserrat", "poppins", "lato", "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui", "sans-serif", "serif"])

/** Whether a font token's definition leads with a face of its own rather than a default look. */
function lensFaceOk(value) {
  const v = value.trim()
  if (isKeyword(v)) return true
  const first = splitTop(v)[0] ?? ""
  if (/^var\(/i.test(first)) return true
  return !DEFAULT_LOOK.has(first.replace(/^["']|["']$/g, "").trim().toLowerCase())
}

const FONT_PREFIX = /^(normal|italic|oblique|small-caps|all-small-caps|bold|bolder|lighter|[1-9]00|\d+|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded|var\(--[\w-]*weight[\w-]*\))$/i
const SYSTEM_FONTS = new Set(["caption", "icon", "menu", "message-box", "small-caption", "status-bar"])

/** The `font` shorthand in parts: its size and its family (null when it's a keyword or a system font). */
function fontParts(value) {
  const v = value.trim()
  if (isKeyword(v) || SYSTEM_FONTS.has(v.toLowerCase())) return null
  const tokens = splitTop(v, " ")
  let at = tokens.findIndex((t) => splitTop(t, "/").length > 1 || t.endsWith("/"))
  if (at === -1) at = tokens.findIndex((t) => !FONT_PREFIX.test(t) && !/^oblique\s/i.test(t))
  if (at === -1) return { size: "", family: "", caps: tokens.some((t) => /small-caps/i.test(t)) }
  let size = splitTop(tokens[at], "/")[0] ?? ""
  let rest = tokens.slice(at + 1)
  if (tokens[at].endsWith("/")) rest = rest.slice(1)
  else if (rest[0]?.startsWith("/")) rest = rest[0] === "/" ? rest.slice(2) : rest.slice(1)
  // A slash with spaces around it splits the size token differently.
  size = size.replace(/\/.*$/, "")
  return { size, family: rest.join(" "), caps: tokens.slice(0, at).some((t) => /small-caps/i.test(t)) }
}

const ALLOWED_STOP_VAR = /^var\(\s*--color-(light-core|light-edge|halation)\s*\)$/i

/** Whether a gradient color stop is the project's light, or clear. */
function stopOk(color) {
  const c = color.trim()
  const lower = c.toLowerCase()
  if (lower === "transparent") return true
  if (ALLOWED_STOP_VAR.test(c)) return true
  const v = colorVector(c)
  if (v && v[3] < 0.005) return true
  const mix = /^color-mix\(\s*in\s+[\w-]+(?:\s+[\w-]+\s+hue)?\s*,(.*)\)$/is.exec(c)
  if (mix) {
    return splitTop(mix[1]).every((part) => {
      const [col, ...rest] = splitTop(part, " ")
      return rest.every((r) => /^[\d.]+%$/.test(r)) && (col.toLowerCase() === "transparent" || ALLOWED_STOP_VAR.test(col) || colorVector(col)?.[3] < 0.005)
    })
  }
  return false
}

const LENGTHISH = /^(?:[+-]?(?:\d+\.?\d*|\.\d+)(?:[a-z%]+)?|calc\(.*\)|min\(.*\)|max\(.*\)|clamp\(.*\))$/is
const GRADIENT_CONFIG = /^(to|at|from|in|circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner)$/i

/** The gradients in a value that paint with something other than the project's light. */
function badGradients(value) {
  const s = blankRaw(value)
  const bad = []
  for (const m of s.matchAll(/(?<![\w-])(-webkit-gradient|(?:-(?:webkit|moz|o)-)?(?:repeating-)?(?:linear|radial|conic)-gradient)\(/gi)) {
    const open = m.index + m[0].length - 1
    const end = closeParen(s, open)
    const text = value.slice(m.index, end)
    if (/^-webkit-gradient/i.test(m[1])) {
      bad.push(text)
      continue
    }
    const args = splitTop(value.slice(open + 1, end - 1))
    const ok = args.every((arg, i) => {
      const tokens = splitTop(arg, " ")
      if (i === 0 && (tokens.some((t) => GRADIENT_CONFIG.test(t)) || tokens.every((t) => LENGTHISH.test(t) || /^(?:top|bottom|left|right|center)$/i.test(t)))) return true
      const color = tokens.filter((t) => !LENGTHISH.test(t))
      if (!color.length) return true
      return color.length === 1 && stopOk(color[0])
    })
    if (!ok) bad.push(text)
  }
  return bad
}

const SPACING = /^(padding|margin)(-(top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?$|^(gap|row-gap|column-gap|grid-gap|grid-row-gap|grid-column-gap)$/
const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/
const MASK = /^(-webkit-)?mask(-|$)/

/**
 * The rules one declaration breaks, as [{ rule, found }]. `d` is a parsed
 * declaration: { prop, value, keyframes, descriptors, properties }.
 */
export function checkDeclaration(d, defs = null) {
  const outer = aliases
  aliases = defs ?? aliases
  try {
    return checkOne(d)
  } finally {
    aliases = outer
  }
}

function checkOne(d) {
  const out = []
  const flag = (rule) => out.push(rule)
  const prop = d.prop
  const value = d.value
  if (d.descriptors) return out

  if (prop.startsWith("--")) {
    const name = prop.toLowerCase()
    if (name.startsWith("--lightningcss-")) return out
    const colors = () => literalColors(value).filter((c) => !c.clear)
    if (name.startsWith("--color-") && colors().length) flag("R17")
    // Tailwind carries arbitrary colors (ring-[#f00], from-[#f00], shadow-[...]) in its own variables.
    if (name.startsWith("--tw-") && !d.properties) {
      if (colors().length) flag("R17")
      if (name === "--tw-tracking" && !trackingOk(value)) flag("R6")
    }
    // Tailwind's theme echoes each text token as var() of itself; any other value is a new size.
    if (name.startsWith("--text-") && !/^--text-[\w-]+$/.test(loneVar(value) ?? "")) flag("R7")
    // A project sets its lens by defining the font tokens; a lens can't lead with a default-look face.
    if ((/^--font-[\w-]+$/.test(name) && !/^--font-(weight|size|feature|variation)|--letter-spacing$/.test(name)) || name === "--default-font-family" || name === "--default-mono-font-family") {
      if (!lensFaceOk(value)) flag("R18")
    }
    if (name === "--font-serif--letter-spacing" && !trackingOk(value)) flag("R6")
    // The radius scale is Halation's; only Tailwind's echo of a token as var() of itself passes.
    if (name.startsWith("--radius-") && loneVar(value) !== name) flag("R25")
    if (name === "--spacing") {
      try {
        if (!isKeyword(value) && Math.abs(evaluate(value, { percent: () => Number.NaN, variable: () => Number.NaN }) - 4) > 1e-6) flag("R24")
      } catch {
        flag("R24")
      }
    }
    if (name.startsWith("--space-") && !spacingOk(value)) flag("R24")
    return out
  }

  const base = unprefixed(prop)
  // Gradients and literal colors, everywhere but masks, where black and white only mean opaque and clear.
  if (!MASK.test(prop)) {
    if (badGradients(value).length) flag("R3")
    if (literalColors(value, { names: TAKES_COLOR.test(base) }).some((c) => !c.clear)) flag("R17")
    // A literal color given a name of its own: --brand: #8b5cf6, then color: var(--brand).
    else if (TAKES_COLOR.test(base) && colorThroughAlias(value)) flag("R17")
  }
  if (base === "text-shadow" && !(isKeyword(value) || /^none$/i.test(value.trim()))) flag("R22")
  if (d.keyframes) return out

  if (base === "font-size" && !fontSizeOk(value)) flag("R7")
  if (base === "font") {
    const parts = fontParts(value)
    if (parts) {
      if (parts.size && !fontSizeOk(parts.size)) flag("R7")
      if (parts.family && !familyOk(parts.family)) flag("R18")
      if (parts.caps) flag("R5")
    }
  }
  if (base === "letter-spacing" && !trackingOk(value)) flag("R6")
  if (base === "text-transform" && /(?<![\w-])uppercase(?![\w-])/i.test(value)) flag("R5")
  if ((base === "font-variant-caps" || base === "font-variant") && /small-caps/i.test(value)) flag("R5")
  if (base === "font-family" && !familyOk(value)) flag("R18")
  if (SPACING.test(base) && !spacingOk(value, { margin: base.startsWith("margin") })) flag("R24")
  if (RADIUS.test(base) && !radiusOk(value)) flag("R25")
  return [...new Set(out)]
}

// ---------------------------------------------------------------------------
// Running it

function lineCol(text, offset) {
  let line = 1
  let last = -1
  for (let i = text.indexOf("\n"); i !== -1 && i < offset; i = text.indexOf("\n", i + 1)) {
    line++
    last = i
  }
  return { line, column: offset - last }
}

/**
 * Checks one style sheet's text. `own` is the index of Halation's own
 * declarations; a declaration that matches one exactly isn't checked. `defs`
 * are the custom properties defined alongside (by default, the sheet's own).
 * Returns findings sorted by position.
 */
export function gateCss(text, { file = "styles.css", own = null, rules = loadRules(), decls = null, where = null, defs = null, counterexamples = false, exempted = { counterexamples: 0 }, inCounterexample = false } = {}) {
  const byId = new Map(rules.map((r) => [r.id, r]))
  const findings = []
  decls ??= parseCss(text)
  defs ??= definitions(decls, own)
  for (const d of decls) {
    const broken = checkDeclaration(d, defs)
    if (!broken.length) continue
    if (!where && own?.has(d.selector, d.prop, d.value)) continue
    if (counterexamples && (inCounterexample || (!where && isCounterexample(d.selector)))) {
      exempted.counterexamples++
      continue
    }
    const { line, column } = lineCol(text, d.offset)
    for (const rule of broken) {
      findings.push({
        file,
        line,
        column,
        rule,
        says: byId.get(rule)?.says ?? "",
        selector: where ?? d.selector,
        property: d.prop,
        value: d.value,
        found: clip(`${d.prop}: ${d.value}${d.important ? " !important" : ""}`),
      })
    }
  }
  return findings
}

/** Whether every selector in a list is inside, or on, a [data-counterexample] element. */
export const isCounterexample = (selector) => !!selector && splitTop(selector).every((s) => /\[\s*data-counterexample\b/i.test(s))

/** An HTML document's styles, parsed: its style blocks' declarations, and each style attribute's. */
function parseHtml(text) {
  const { sheets, attrs } = extractHtml(text)
  return {
    sheets: sheets.flatMap((s) => parseCss(s.text, { base: s.offset })),
    attrs: attrs.map((a) => ({ tag: a.tag, counterexample: a.counterexample, decls: parseCss(a.text, { base: a.offset, selector: "" }).map((d) => ({ ...d, offset: a.offset })) })),
  }
}

/** Checks one HTML document's <style> blocks and style attributes. */
export function gateHtml(text, { file = "index.html", own = null, rules = loadRules(), parsed = parseHtml(text), defs = null, counterexamples = false, exempted = { counterexamples: 0 } } = {}) {
  defs ??= definitions([...parsed.sheets, ...parsed.attrs.flatMap((a) => a.decls)], own)
  const findings = gateCss(text, { file, own, rules, decls: parsed.sheets, defs, counterexamples, exempted })
  for (const a of parsed.attrs) {
    findings.push(...gateCss(text, { file, rules, decls: a.decls, defs, where: `a style attribute on <${a.tag}>`, counterexamples, exempted, inCounterexample: a.counterexample }))
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column)
}

/** The build output folders to read: the ones given, or the first usual one that exists. */
export function gateDirs(dirs, cwd = process.cwd()) {
  if (dirs.length) {
    for (const d of dirs) if (!existsSync(path.resolve(cwd, d))) throw new UsageError(`There's no file or folder at ${d}. Build the project first, or check the path.`)
    return dirs
  }
  const found = BUILD_OUTPUT.find((d) => existsSync(path.join(cwd, d)))
  if (!found) throw new UsageError(`There's no build output to read: none of ${BUILD_OUTPUT.slice(0, -1).join(", ")} or ${BUILD_OUTPUT.at(-1)} is here. Build the project first, or name the folder, as in halation gate dist.`)
  return [found]
}

/** Every .css and .html file under `paths`. */
function builtFiles(paths, cwd) {
  const out = []
  const walk = (abs) => {
    let stat
    try {
      stat = statSync(abs)
    } catch {
      return
    }
    if (stat.isFile()) {
      if (/\.(css|html?)$/i.test(abs)) out.push(abs)
      return
    }
    if (!stat.isDirectory()) return
    for (const e of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === ".git" || e.name === "node_modules") continue
      const child = path.join(abs, e.name)
      if (e.isDirectory()) walk(child)
      else if (e.isFile() || e.isSymbolicLink()) walk(child)
    }
  }
  for (const p of paths) walk(path.resolve(cwd, p))
  return [...new Set(out)]
}

/**
 * Reads a build's output and checks every declaration in it. Returns
 * { dirs, files, findings }.
 */
export function gate(dirs = [], { cwd = process.cwd(), own, counterexamples = false } = {}) {
  const chosen = gateDirs(dirs, cwd)
  const files = builtFiles(chosen, cwd)
  own ??= loadOwnStyles([cwd])
  const rules = loadRules()
  // Parse everything first: a var() in one file may be defined in another.
  const read = files.map((abs) => {
    const text = readFileSync(abs, "utf8")
    const css = /\.css$/i.test(abs)
    return { abs, text, css, parsed: css ? parseCss(text) : parseHtml(text) }
  })
  const defs = definitions(read.flatMap((r) => (r.css ? r.parsed : [...r.parsed.sheets, ...r.parsed.attrs.flatMap((a) => a.decls)])), own)
  const findings = []
  const exempted = { counterexamples: 0 }
  for (const { abs, text, css, parsed } of read) {
    const file = displayPath(abs, cwd)
    const options = { file, own, rules, defs, counterexamples, exempted }
    findings.push(...(css ? gateCss(text, { ...options, decls: parsed }) : gateHtml(text, { ...options, parsed })))
  }
  return { dirs: chosen.map(slash), files: files.length, findings, exempted }
}

/** The readable report: each file, then each finding under it; then each broken rule's reason. */
export function formatGate({ dirs, files, findings, exempted = {} }, rules = loadRules()) {
  const where = dirs.join(", ")
  if (!files) return `There were no .css or .html files in ${where} to read. Build the project first, or name the folder that holds the build output.\n`
  const counted = exempted.counterexamples
    ? `\nExempted, and counted\n  ${plural(exempted.counterexamples, "declaration")} in counterexamples ${exempted.counterexamples === 1 ? "breaks" : "break"} a rule, allowed by --allow-counterexamples.\n`
    : ""
  if (!findings.length) return `No problems in ${plural(files, "built file")} in ${where}.\n${counted}`
  const out = []
  let file = null
  for (const f of findings) {
    if (f.file !== file) {
      if (file !== null) out.push("")
      out.push(f.file)
      file = f.file
    }
    out.push(`  ${f.line}:${f.column}  ${f.rule}  ${f.says} Found "${f.found}" in ${clip(f.selector, 100)}.`)
  }
  out.push("")
  const byId = new Map(rules.map((r) => [r.id, r]))
  for (const id of [...new Set(findings.map((f) => f.rule))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
    const r = byId.get(id)
    out.push(`${r.id}: ${r.says}`, `  Why: ${r.why}`, `  Instead: ${r.instead}`, "")
  }
  const touched = new Set(findings.map((f) => f.file)).size
  out.push(`Found ${plural(findings.length, "problem")} in ${plural(touched, "file")}, out of ${plural(files, "built file")} in ${where}.`)
  out.push("Each selector names the class, rule or style attribute that produced the problem. Fix it in the source and build again; Halation's own styles pass as they are.")
  return `${out.join("\n")}\n${counted}`
}
