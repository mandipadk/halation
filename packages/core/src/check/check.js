// The rendered check: the rules measured on a real page, as the browser
// computed it. Lint reads source; this reads the result, so it catches what
// source can't show: a string built at runtime, a class from a library, a
// color set from JavaScript, a pseudo-element, a color that only fails in
// dark mode. The darkroom and `halation check` both run it.
//
// Nothing is exempt by class name or attribute alone. The few places that
// may break a rule (a phenomenon's drawing layer, the lit edge, color
// samples, deliberate counterexamples on a design system's own docs) are
// verified by what they are, and every exemption is counted in the result.

const SEPARATOR = /(^|\s)[·•∙⋅](\s|$)/
const LONE_SEPARATOR = /^\s*[·•∙⋅|]\s*$/
const LIGHT_ONLY = new Set(["box-shadow", "filter"])
// Hues Halation keeps accents out of: purple.
const CLOSED_HUES = [258, 345]
const MOTION = { interface: 300, light: 1000, sheet: 600, opening: 2000, delay: 300 }

/** Parses any CSS color the browser returns into [r, g, b, a] (0 to 1). */
function parseColor(css) {
  const g = (parseColor.ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true }))
  if (!g) return [0, 0, 0, 0]
  g.clearRect(0, 0, 1, 1)
  g.fillStyle = "#000"
  g.fillStyle = css
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data
  return [r / 255, gr / 255, b / 255, a / 255]
}

/**
 * A color token as the element sees it. Custom properties come back as
 * written (a light-dark() pair, a var() chain), so the browser resolves them
 * on a probe that shares the element's color scheme.
 */
function tokenColor(el, name) {
  const cs = getComputedStyle(el)
  const raw = cs.getPropertyValue(`--color-${name}`).trim()
  if (!raw) return [0, 0, 0, 0]
  const key = `${raw}|${cs.colorScheme}`
  const cache = (tokenColor.cache ??= new Map())
  if (!cache.has(key)) {
    const probe = (tokenColor.probe ??= document.createElement("i"))
    if (!probe.isConnected) document.documentElement.append(probe)
    probe.style.cssText = `display: none; color-scheme: ${cs.colorScheme}; color: ${raw}`
    const resolved = probe.style.color ? getComputedStyle(probe).color : "transparent"
    cache.set(key, parseColor(resolved))
  }
  return cache.get(key)
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** sRGB to OKLCH chroma and hue, enough to tell a color family apart. */
function lch([r, g, b]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, C: Math.hypot(A, Bb), H: ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360 }
}
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const closedHue = (h) => h > CLOSED_HUES[0] && h < CLOSED_HUES[1]
const blend = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1)

/** The color actually behind an element: the nearest opaque background. */
function backgroundOf(el) {
  let node = el
  while (node && node !== document.documentElement) {
    if (node.nodeType !== 1) {
      node = node.host ?? null
      continue
    }
    const cs = getComputedStyle(node)
    const bg = parseColor(cs.backgroundColor)
    if (bg[3] > 0.95) return bg
    if (cs.backgroundImage !== "none" || node.tagName === "CANVAS") return null
    node = node.parentElement ?? node.parentNode
  }
  return parseColor(getComputedStyle(document.body).backgroundColor)
}

/**
 * How opaque an element is at rest, through every ancestor's opacity. A fade
 * that's part of a running animation (an entrance, a scroll-linked arrival) is
 * on its way somewhere, so it doesn't count against the resting contrast.
 */
function opacityOf(el) {
  let o = 1
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    if (typeof n.getAnimations === "function" && n.getAnimations().length) continue
    o *= Number(getComputedStyle(n).opacity)
  }
  return o
}

function selector(el, pseudo = "") {
  const id = el.id ? `#${el.id}` : ""
  const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("")
  return `${el.tagName.toLowerCase()}${id}${cls}${pseudo}`
}

const visible = (el) => {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05
}

/** Every element under root, including inside open shadow roots. */
function everything(root) {
  const out = []
  const stack = [root]
  while (stack.length) {
    const scope = stack.pop()
    for (const el of scope.querySelectorAll("*")) {
      out.push(el)
      if (el.shadowRoot) stack.push(el.shadowRoot)
    }
  }
  return out
}

// A drawing layer: the canvas a phenomenon paints, or media. Its pixels aren't text or interface.
const drawingLayer = (el) => !!el.closest(".hl-phenomenon, canvas, video, img, picture, svg")
// The lit edge is verified by what it is: a fixed hairline of light along the top of the page, placed by Halation.
const litEdge = (el, cs) => el.matches(".hl-lit-edge, .hl-lit-edge-glow") && el.parentElement === document.body && cs.position === "fixed" && parseFloat(cs.height) <= 10 && parseFloat(cs.top) === 0
const TEXT_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/

/**
 * Light, not paint: a gradient is light when every color in it is one of the
 * system's light colors (the light's core and edge, halation) or clear, on a
 * layer that holds no text and takes no clicks. Anything else is paint.
 */
function isLight(el, s, image, face) {
  if (face || s.pointerEvents !== "none" && !el.matches(".hl-lit-edge, .hl-lit-edge-glow")) return false
  const stops = [...image.matchAll(/rgba?\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b|transparent/gi)].map((m) => parseColor(m[0]))
  if (!stops.length) return false
  const lights = ["light-core", "light-edge", "halation"].map((n) => tokenColor(el, n)).filter((c) => c[3] > 0)
  return stops.every((c) => c[3] < 0.02 || lights.some((l) => Math.abs(c[0] - l[0]) + Math.abs(c[1] - l[1]) + Math.abs(c[2] - l[2]) < 0.09))
}

/** The share of a view covered by any of the areas, overlaps counted once, on an 8 px grid. */
function covered(areas, top, bottom) {
  const cols = Math.ceil(innerWidth / 8), rows = Math.ceil((bottom - top) / 8)
  const cells = new Uint8Array(cols * rows)
  for (const [a, b, l, r] of areas) {
    if (b <= top || a >= bottom || r <= l) continue
    for (let y = Math.max(0, Math.round((a - top) / 8)); y < Math.min(rows, Math.round((b - top) / 8)); y++)
      for (let x = Math.round(l / 8); x < Math.min(cols, Math.round(r / 8)); x++) cells[y * cols + x] = 1
  }
  return cells.reduce((n, c) => n + c, 0) / cells.length
}

/** Seconds or milliseconds from a CSS time list, in ms. */
const times = (list) => list.split(",").map((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000))

/**
 * The halation phenomenon's own filter, verified by what it is: its id, its
 * primitives in order, its two blurs, and floods in the system's halation color.
 */
const HALATION_STEPS = "feColorMatrix feGaussianBlur feGaussianBlur feFlood feComposite feFlood feComposite feMerge"
function isHalation(f) {
  if (f.id !== "hl-halation" || [...f.children].map((c) => c.tagName).join(" ") !== HALATION_STEPS) return false
  const blurs = [...f.querySelectorAll("feGaussianBlur")].map((b) => b.getAttribute("stdDeviation"))
  if (blurs.join(" ") !== "2.4 18") return false
  const glow = tokenColor(document.documentElement, "halation")
  return [...f.querySelectorAll("feFlood")].every((fl) => {
    const c = parseColor(getComputedStyle(fl).floodColor)
    return Math.abs(c[0] - glow[0]) + Math.abs(c[1] - glow[1]) + Math.abs(c[2] - glow[2]) < 0.09
  })
}

/**
 * Glow reaching text from an SVG filter or a drop-shadow, on the element or
 * any ancestor. Returns "glow", the element carrying the halation filter, or null.
 */
function filterGlow(el) {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement ?? n.getRootNode()?.host) {
    const f = getComputedStyle(n).filter
    if (!f || f === "none") continue
    if (n !== el && litShadow(f)) return "glow"
    for (const m of f.matchAll(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/g)) {
      const def = document.getElementById(m[1])
      if (!def) continue
      if (isHalation(def)) return n
      if (def.querySelector("feGaussianBlur, feMorphology, feDropShadow")) return "glow"
    }
  }
  return null
}

/** A blurred drop-shadow that's light or colored: a glow, where a dark one is only a shadow. */
function litShadow(filter) {
  for (const m of filter.matchAll(/drop-shadow\((.*?\))?[^)]*\)/g)) {
    const color = m[0].match(/(?:rgba?|oklch|oklab|lab|lch|color|hsla?)\([^)]*\)|#[0-9a-f]{3,8}\b/i)
    const blur = [...m[0].replace(color?.[0] ?? "", "").matchAll(/(-?[\d.]+)px/g)].map((x) => parseFloat(x[1]))[2] ?? 0
    if (!color || blur <= 0) continue
    const c = parseColor(color[0])
    if (c[3] > 0.1 && (luminance(c) > 0.2 || lch(c).C > 0.08)) return true
  }
  return false
}

/** The largest blur radius in a text-shadow or a drop-shadow filter. */
function glowOf(cs) {
  const blur = (s) => [...s.matchAll(/(-?[\d.]+)px/g)].map((m) => parseFloat(m[1]))
  let max = 0
  if (cs.textShadow && cs.textShadow !== "none") for (const part of cs.textShadow.split(/,(?![^(]*\))/)) max = Math.max(max, blur(part)[2] ?? 0)
  for (const m of cs.filter.matchAll(/drop-shadow\(([^)]*\))[^)]*\)/g)) max = Math.max(max, blur(m[0])[2] ?? 0)
  return max
}

/**
 * Checks `root` against the rules the browser can see. Options:
 *   counterexamples: true lets elements inside [data-counterexample] break the
 *     rules, for a design system's own docs showing what not to do. Off by default.
 * Returns { rules, budgets, exempted, elements }.
 */
export function check(root = document.body, { counterexamples = false } = {}) {
  const found = new Map()
  const note = (id, el, pseudo = "") => {
    const list = found.get(id) ?? []
    list.push(selector(el, pseudo))
    found.set(id, list)
  }
  const exempted = { counterexamples: 0, samples: 0, decorative: 0 }
  const semantic = ["positive", "warning", "critical"].map((k) => lch(tokenColor(document.documentElement, k)).H)
  const rootAccent = lch(tokenColor(document.documentElement, "accent"))
  const layer = root.querySelector(".hl-dialog[data-open], .hl-sheet[data-open], .hl-lens[data-open]")
  const ink = []
  const accentAreas = []
  const halated = new Set()
  let elements = 0

  for (const el of everything(root)) {
    if (TEXT_TAGS.test(el.tagName)) continue
    if (el.closest(".hl-darkroom-overlay, .hl-darkroom-panel")) continue
    if (el.closest("[data-counterexample]")) {
      if (counterexamples) {
        exempted.counterexamples++
        continue
      }
    }
    if (!visible(el)) continue
    elements++
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("")
    const hasText = !!text.trim()
    const drawing = drawingLayer(el)
    // Samples show colors as content: a color picker's preview, a swatch, another project's look.
    // They're declared, counted, and may break only the one-accent rule.
    const sample = !!el.closest(".hl-forge, [data-content='color'], [data-content='sample']")
    const elAccent = sample ? null : lch(tokenColor(el, "accent"))

    // Each element and its two pseudo-elements are measured alike.
    const faces = [[cs, "", hasText, r.width, r.height]]
    for (const p of ["::before", "::after"]) {
      const ps = getComputedStyle(el, p)
      if (ps.content === "none" || ps.content === "normal" || ps.display === "none") continue
      const w = parseFloat(ps.width) || 0, h = parseFloat(ps.height) || 0
      const said = ps.content.replace(/^["']|["']$/g, "")
      faces.push([ps, p, !!said.trim() && !/^(counter|attr|url)\(/.test(said), w, h, said])
    }

    for (const [s, p, face, w, h, said] of faces) {
      // R9: facts joined with separators, or a separator standing alone between them.
      const words = p ? said ?? "" : text
      if (words && (SEPARATOR.test(words) || (LONE_SEPARATOR.test(words) && (p || (el.parentElement?.textContent.trim().length ?? 0) > words.trim().length)))) note("R9", el, p)
      // R5 and R6: capitals, and letter-spacing added beyond the text styles.
      if (face && (s.textTransform === "uppercase" || /small-caps/.test(s.fontVariantCaps ?? s.fontVariant))) note("R5", el, p)
      if (face && parseFloat(s.letterSpacing) > parseFloat(s.fontSize) * 0.02) note("R6", el, p)
      // R22: glowing text.
      if (face && glowOf(s) > 0) note("R22", el, p)
      // R3: gradients as decoration, in a background or a border.
      const painted = /gradient\(/i.test(s.backgroundImage) && !isLight(el, s, s.backgroundImage, face)
      if (!drawing && !litEdge(el, s) && !el.matches(".hl-slider, input[type=range]") && (painted || /gradient\(/i.test(s.borderImageSource ?? ""))) note("R3", el, p)
      // R10: a small colored circle standing in for a state.
      const dw = p ? w : r.width, dh = p ? h : r.height
      if (!face && !(p ? false : el.textContent.trim()) && dw >= 4 && dw <= 16 && Math.abs(dw - dh) < 1.5 && parseFloat(s.borderTopLeftRadius) >= dw / 2 - 0.5 && !drawing) {
        const fill = parseColor(s.backgroundColor), edge = parseColor(s.borderTopColor)
        if ((fill[3] > 0.5 && lch(fill).C > 0.06) || (edge[3] > 0.5 && parseFloat(s.borderTopWidth) > 0 && lch(edge).C > 0.06)) note("R10", el, p)
      }
    }

    // R10, the other form: a tinted pill whose text is the same hue as its fill.
    if (hasText && r.height <= 32 && parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 1) {
      const tint = parseColor(cs.backgroundColor), words = parseColor(cs.color)
      const f = lch(tint), t = lch(words)
      if (tint[3] > 0.1 && f.C > 0.02 && t.C > 0.07 && hueGap(f.H, t.H) < 25) note("R10", el)
    }

    // R22, through filters: an SVG glow or a drop-shadow reaching the text. The halation
    // phenomenon's bloom is the one allowed, on a dark ground, once per page.
    if (hasText && !drawing) {
      const glow = filterGlow(el)
      if (glow === "glow") note("R22", el)
      else if (glow) {
        const ground = backgroundOf(el)
        if (ground && luminance(ground) > 0.2) note("R22", el)
        else halated.add(glow)
      }
    }

    // R11: monospace loose on the page rather than inside a surface.
    if (hasText && /mono|menlo|courier|consolas/i.test(cs.fontFamily) && !el.closest("kbd, code, pre, .hl-kbd, .hl-cap, .hl-code, .hl-surface")) note("R11", el)
    // R8: one serif phrase per headline, and only at title sizes and up.
    if (/^H[1-6]$/.test(el.tagName) && el.querySelectorAll(".hl-serif").length > 1) note("R8", el)
    if (el.matches(".hl-serif") && hasText && parseFloat(cs.fontSize) < 20) note("R8", el)

    // R14: motion. Interface transitions stay under 300 ms (light may fade for a second), nothing
    // waits long to start, and nothing loops unless it's a phenomenon's own drawing.
    if (!drawing) {
      const props = cs.transitionProperty.split(",").map((x) => x.trim())
      const sheet = !!el.closest(".hl-sheet")
      const slow = times(cs.transitionDuration).some((d, i) => d > (LIGHT_ONLY.has(props[i % props.length]) ? MOTION.light : sheet ? MOTION.sheet : MOTION.interface))
      const late = times(cs.transitionDelay).some((d) => d > MOTION.delay)
      const loops = cs.animationName !== "none" && cs.animationIterationCount.split(",").some((c) => c.trim() === "infinite")
      const long = cs.animationName !== "none" && times(cs.animationDuration).some((d) => d > MOTION.opening)
      if (slow || late || loops || long) note("R14", el)
    }

    // R4: text contrast against what's actually behind it, after its own transparency and every ancestor's opacity.
    // A sample hidden from assistive technology is a picture of an interface, like a screenshot:
    // counted, not measured. Hidden text anywhere else is still read by eyes, so it's measured.
    const decorative = hasText && sample && !!el.closest("[aria-hidden='true'], [inert]")
    if (decorative) exempted.decorative++
    if (hasText && !drawing && !decorative) {
      const bg = backgroundOf(el)
      const raw = parseColor(cs.color)
      if (bg && raw[3] > 0) {
        const fg = blend([...raw.slice(0, 3), raw[3] * opacityOf(el)], bg)
        const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)
        const disabled = el.closest("[disabled], [aria-disabled='true'], [data-disabled]")
        if (!disabled && ratio(fg, bg) < (large ? 3 : 4.5)) note("R4", el)
      }
    }

    // R1: one accent. Every saturated color is the accent's hue, or a state's; purple never is.
    if (!drawing) {
      if (sample) exempted.samples++
      else {
        const colors = []
        if (hasText) colors.push(parseColor(cs.color))
        const fill = parseColor(cs.backgroundColor)
        if (fill[3] > 0.5) colors.push(fill)
        if (parseFloat(cs.borderTopWidth) > 0) colors.push(parseColor(cs.borderTopColor))
        for (const c of colors) {
          const k = lch(c)
          if (c[3] < 0.3 || k.C < 0.08) continue
          if (closedHue(k.H)) {
            note("R1", el)
            break
          }
          const accentHue = elAccent && elAccent.C > 0.05 ? elAccent.H : rootAccent.H
          if (hueGap(k.H, accentHue) > 30 && semantic.every((sh) => hueGap(k.H, sh) > 30)) {
            note("R1", el)
            break
          }
        }
        // A second accent set on part of the page.
        if (elAccent && elAccent.C > 0.05 && rootAccent.C > 0.05 && hueGap(elAccent.H, rootAccent.H) > 12 && el.matches("[data-accent], [style*='--color-accent']")) note("R1", el)
      }
    }

    // Budgets, measured on the whole page by what things look like, not by class name.
    const top = r.top + scrollY
    const inkColor = tokenColor(el, "ink")
    const surface = parseColor(cs.backgroundColor)
    const control = el.matches("button, a, [role='button'], input[type='submit'], input[type='button']")
    const looksInk = surface[3] > 0.9 && inkColor[3] > 0 && Math.abs(surface[0] - inkColor[0]) + Math.abs(surface[1] - inkColor[1]) + Math.abs(surface[2] - inkColor[2]) < 0.06
    if (!sample && ((control && looksInk) || el.matches(".hl-button[data-variant='ink']"))) {
      if (!layer || layer.contains(el)) ink.push(top)
    }
    const accent = tokenColor(el, "accent")
    if (!sample && accent[3] > 0 && surface[3] > 0.9 && Math.abs(surface[0] - accent[0]) + Math.abs(surface[1] - accent[1]) + Math.abs(surface[2] - accent[2]) < 0.06) {
      accentAreas.push([top, top + r.height, Math.max(0, r.left), Math.min(r.right, innerWidth)])
    }
  }

  if (halated.size > 1) for (const el of halated) note("R22", el)

  // R23: the page fits the width it's shown at.
  if (document.documentElement.scrollWidth > innerWidth + 1) {
    const wide = everything(root).filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && visible(el))
    const leaves = wide.filter((el) => !wide.some((o) => o !== el && el.contains(o))).slice(0, 5)
    for (const el of leaves) note("R23", el)
    if (!leaves.length) note("R23", document.body)
  }

  // A budget is "per view": the worst screenful anywhere on the page.
  const pageHeight = Math.max(document.documentElement.scrollHeight, innerHeight)
  let inkMax = 0, shareMax = 0
  for (let y = 0; y < pageHeight; y += innerHeight / 4) {
    const bottom = y + innerHeight
    inkMax = Math.max(inkMax, ink.filter((t) => t >= y && t < bottom).length)
    shareMax = Math.max(shareMax, covered(accentAreas, y, bottom))
  }
  tokenColor.probe?.remove()

  const RULES = [
    ["R1", "One accent, used as a signal"],
    ["R3", "No gradients as decoration"],
    ["R4", "Text passes contrast against what's behind it"],
    ["R5", "Sentence case, no uppercase labels"],
    ["R6", "No added letter-spacing"],
    ["R8", "One serif phrase in a headline, at title sizes"],
    ["R9", "No dots joining facts"],
    ["R10", "No status dots"],
    ["R11", "Monospace only inside a surface"],
    ["R14", "Interface motion is quick, and nothing loops"],
    ["R22", "No glow on text"],
    ["R23", "Pages fit a phone: nothing scrolls sideways"],
  ]
  return {
    rules: RULES.map(([id, says]) => {
      const examples = [...new Set(found.get(id) ?? [])]
      return { id, says, pass: examples.length === 0, count: examples.length, examples: examples.slice(0, 5) }
    }),
    budgets: [
      { name: "Ink buttons in any one view", value: inkMax, limit: 1, pass: inkMax <= 1 },
      { name: "Share of any one view in the accent", value: Math.round(shareMax * 1000) / 10, limit: 8, pass: shareMax <= 0.08 },
    ],
    exempted,
    elements,
  }
}
