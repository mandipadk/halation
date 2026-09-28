// The rendered check: the rules measured on a real page, as the browser
// computed it. Lint reads source; this reads the result, so it catches what
// source can't show (a string built at runtime, a class from a library, a
// color that only fails in dark mode). The darkroom and `halation check`
// both run it. Anything inside [data-counterexample] (a deliberate "don't do
// this" in docs or marketing) is left out.

const SEPARATOR = /\s[·•]\s/
const LIGHT_ONLY = new Set(["box-shadow", "filter"])

/** Parses any CSS color the browser returns into [r, g, b, a] (0 to 1). */
function parseColor(css) {
  const g = parseColor.ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  g.clearRect(0, 0, 1, 1)
  g.fillStyle = "#000"
  g.fillStyle = css
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data
  return [r / 255, gr / 255, b / 255, a / 255]
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** The color actually behind an element: the nearest opaque background. */
function backgroundOf(el) {
  let node = el
  while (node && node !== document.documentElement) {
    const cs = getComputedStyle(node)
    const bg = parseColor(cs.backgroundColor)
    if (bg[3] > 0.95) return bg
    if (cs.backgroundImage !== "none" || node.tagName === "CANVAS") return null
    node = node.parentElement
  }
  return parseColor(getComputedStyle(document.body).backgroundColor)
}

function selector(el) {
  const id = el.id ? `#${el.id}` : ""
  const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join("")
  return `${el.tagName.toLowerCase()}${id}${cls}`
}

const visible = (el) => {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05
}

const inPhenomenon = (el) => !!el.closest(".hl-phenomenon, [data-phenomenon], .hl-darkroom-overlay, .hl-darkroom-panel, canvas")

/**
 * Checks `root` against the rules the browser can see. Returns
 * { rules: [{ id, says, pass, count, examples }], budgets: [{ name, value, limit, pass }] }.
 */
export function check(root = document.body) {
  const found = new Map()
  const note = (id, el) => {
    const list = found.get(id) ?? []
    list.push(selector(el))
    found.set(id, list)
  }
  const all = [...root.querySelectorAll("*")].filter((el) => !el.closest(".hl-darkroom-overlay, .hl-darkroom-panel, [data-counterexample]"))
  let ink = 0
  let accentArea = 0
  const accent = parseColor(getComputedStyle(document.documentElement).getPropertyValue("--color-accent") || "transparent")

  for (const el of all) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const text = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join("")

    // R9: facts joined with separators.
    if (text && SEPARATOR.test(text)) note("R9", el)
    // R5 and R6: capitals with added letter-spacing.
    if (text.trim() && cs.textTransform === "uppercase") note("R5", el)
    if (text.trim() && parseFloat(cs.letterSpacing) > parseFloat(cs.fontSize) * 0.02) note("R6", el)
    // R11: monospace loose on the page rather than inside a surface.
    if (text.trim() && /mono|menlo|courier|consolas/i.test(cs.fontFamily)) {
      const surface = el.closest("kbd, code, pre, .hl-kbd, .hl-cap, .hl-code, .hl-surface, [data-surface]")
      if (!surface) note("R11", el)
    }
    // R8: one serif phrase per headline, and only at title sizes and up.
    if (/^H[1-6]$/.test(el.tagName) && el.querySelectorAll(".hl-serif").length > 1) note("R8", el)
    if (el.matches(".hl-serif") && text.trim() && parseFloat(cs.fontSize) < 20) note("R8", el)
    // R10: a small colored circle standing in for a state.
    const r = el.getBoundingClientRect()
    if (r.width <= 10 && r.height <= 10 && r.width >= 4 && Math.abs(r.width - r.height) < 1.5 && parseFloat(cs.borderRadius) >= r.width / 2 - 0.5 && !el.textContent.trim()) {
      const bg = parseColor(cs.backgroundColor)
      const sat = Math.max(...bg.slice(0, 3)) - Math.min(...bg.slice(0, 3))
      if (bg[3] > 0.5 && sat > 0.2) note("R10", el)
    }
    // R3: gradients outside the phenomena.
    if (/gradient\(/.test(cs.backgroundImage) && !inPhenomenon(el) && !el.matches(".hl-slider, input[type=range], .hl-lit-edge, .hl-lit-edge-glow")) note("R3", el)
    // R14: interface transitions over 300 ms. Glow is light, not motion: a bloom may decay slowly.
    const props = cs.transitionProperty.split(",").map((p) => p.trim())
    const durations = cs.transitionDuration.split(",").map((d) => parseFloat(d) * (d.includes("ms") ? 1 : 1000))
    const slow = durations.some((d, i) => d > 300 && !LIGHT_ONLY.has(props[i % props.length]))
    if (slow && !inPhenomenon(el) && !el.closest(".hl-sheet")) note("R14", el)
    // R4: text contrast against what's actually behind it.
    if (text.trim() && !inPhenomenon(el)) {
      const bg = backgroundOf(el)
      const fg = parseColor(cs.color)
      if (bg && fg[3] > 0.5) {
        const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && Number(cs.fontWeight) >= 700)
        const disabled = el.closest("[disabled], [aria-disabled='true'], [data-disabled]")
        if (!disabled && ratio(fg, bg) < (large ? 3 : 4.5)) note("R4", el)
      }
    }
    // Budgets
    // Ink is counted in the top layer only: an open dialog is its own view.
    const layer = root.querySelector(".hl-dialog[data-open], .hl-sheet[data-open]")
    if (el.matches(".hl-button[data-variant='ink']") && r.top < innerHeight && r.bottom > 0 && (!layer || layer.contains(el))) ink++
    const bg = parseColor(cs.backgroundColor)
    if (accent[3] > 0 && bg[3] > 0.9 && Math.abs(bg[0] - accent[0]) + Math.abs(bg[1] - accent[1]) + Math.abs(bg[2] - accent[2]) < 0.04) {
      const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
      const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0))
      accentArea += w * h
    }
  }

  const RULES = [
    ["R3", "No gradients as decoration"],
    ["R4", "Text passes contrast against what's behind it"],
    ["R5", "Sentence case, no uppercase labels"],
    ["R6", "No added letter-spacing"],
    ["R8", "One serif phrase in a headline, at title sizes"],
    ["R9", "No dots joining facts"],
    ["R10", "No status dots"],
    ["R11", "Monospace only inside a surface"],
    ["R14", "Interface motion stays under 300 ms"],
  ]
  const share = accentArea / (innerWidth * innerHeight)
  return {
    rules: RULES.map(([id, says]) => {
      const examples = found.get(id) ?? []
      return { id, says, pass: examples.length === 0, count: examples.length, examples: examples.slice(0, 5) }
    }),
    budgets: [
      { name: "Ink buttons in view", value: ink, limit: 1, pass: ink <= 1 },
      { name: "Share of the screen in the accent", value: Math.round(share * 1000) / 10, limit: 8, pass: share <= 0.08 },
    ],
  }
}
