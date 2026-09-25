// Halation's phenomena: one way to put any of them behind content.
//
//   const light = mountPhenomenon(element, "caustics", { mode: "dark", daylight: true })
//   light.update({ intensity: 0.8 })
//   light.destroy()
//
// Every phenomenon takes its colors from the page's tokens unless given
// them, dims behind the element marked [data-quiet], answers the pointer,
// follows the time of day when daylight is on, holds a still frame for
// reduced motion, and pauses when off screen.

import { mountAtmosphere } from "./runtime.js"
import { rays, caustics, blinds } from "./light.js"
import { mountSim } from "./gpu.js"
import { ink } from "./ink.js"
import { silk } from "./silk.js"
import { foil } from "./foil.js"
import { ripple } from "./ripple.js"
import { growth } from "./growth.js"
import { stir } from "./stir.js"
import { daylight, lightAt, lightingFor, tint } from "./daylight.js"
import { halate } from "./halation.js"

export { daylight, lightAt, lightingFor, tint, halate }

/** Every phenomenon, with what it is and how it's drawn. */
export const catalog = [
  { name: "rays", group: "Light", gloss: "Crepuscular rays from above the frame", kind: "light" },
  { name: "blinds", group: "Light", gloss: "Late sun through a window with blinds", kind: "light" },
  { name: "caustics", group: "Light", gloss: "Light on a pool floor", kind: "light" },
  { name: "halation", group: "Light", gloss: "The glow film gives bright things", kind: "filter" },
  { name: "stir", group: "Air", gloss: "A shaft of light, and the air in it", kind: "sim" },
  { name: "ink", group: "Air", gloss: "A fluid you stir", kind: "sim" },
  { name: "ripple", group: "Water", gloss: "Still water over a tiled floor", kind: "sim" },
  { name: "silk", group: "Matter", gloss: "A satin drape", kind: "sim" },
  { name: "foil", group: "Matter", gloss: "Letterpress and foil", kind: "sim" },
  { name: "growth", group: "Life", gloss: "Reaction-diffusion", kind: "sim" },
]

const LIGHT = { rays, caustics, blinds }
const SIMS = { ink, silk, foil, ripple, growth, stir }
const RESTING = { rays: { position: 50, strength: 12, reach: 6 }, blinds: { sunAngle: 0.55, shear: 0.38 } }

/** Reads a color token as hex, resolved for a mode, by painting it once. */
export function tokenHex(name, mode, scope = document.documentElement) {
  const probe = document.createElement("span")
  probe.style.color = `var(--color-${name})`
  probe.style.colorScheme = mode
  probe.style.display = "none"
  scope.appendChild(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  const g = document.createElement("canvas").getContext?.("2d", { willReadFrequently: true })
  if (!g) return "#ffffff"
  g.fillStyle = color
  g.fillRect(0, 0, 1, 1)
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data
  return "#" + [r, gr, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}

/** Which scheme an element is actually showing. */
export function resolvedMode(el = document.documentElement) {
  const probe = document.createElement("span")
  probe.style.color = "light-dark(rgb(0, 0, 0), rgb(255, 255, 255))"
  probe.style.display = "none"
  el.appendChild(probe)
  const dark = getComputedStyle(probe).color === "rgb(255, 255, 255)"
  probe.remove()
  return dark ? "dark" : "light"
}

/** The quiet zone: an ellipse around the element marked [data-quiet], in the host's units. */
export function quietZone(host) {
  const target = host.parentElement?.querySelector("[data-quiet]")
  if (!target) return undefined
  const box = target.getBoundingClientRect()
  const s = host.getBoundingClientRect()
  if (!s.width || !s.height) return undefined
  return {
    x: (box.left + box.width / 2 - s.left) / s.width,
    y: (box.top + box.height / 2 - s.top) / s.height,
    rx: box.width / 2 / s.width + 0.05,
    ry: box.height / 2 / s.height + 0.06,
  }
}

/**
 * Foil presses a real heading: the element marked [data-press] beside the
 * host. Its text, fonts, size and place are read from the page, and the
 * heading itself turns transparent so the foil shows through, while its text
 * stays in the page for reading and search.
 */
function pressedType(host) {
  const heading = host.parentElement?.querySelector("[data-press]")
  if (!heading) return {}
  heading.classList.add("hl-pressed")
  const runs = []
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.textContent) continue
        const cs = getComputedStyle(child.parentElement)
        runs.push({ text: child.textContent, font: `${cs.fontStyle} ${cs.fontWeight} {size} ${cs.fontFamily}`, tracking: cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing, scale: parseFloat(cs.fontSize) / parseFloat(getComputedStyle(heading).fontSize) })
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child)
    }
  }
  walk(heading)
  const s = host.getBoundingClientRect()
  const r = heading.getBoundingClientRect()
  const size = parseFloat(getComputedStyle(heading).fontSize)
  return { runs, typeBox: { baseline: (r.top - s.top + r.height * 0.5 + size * 0.34) / s.height, size: size / s.height } }
}

/**
 * Mounts a phenomenon into `host` (positioned; it fills it).
 * Options: mode ("auto" | "light" | "dark"), daylight (boolean or a Date),
 * intensity, speed, seed, settleAfter, plus each phenomenon's own options.
 */
export function mountPhenomenon(host, name, options = {}) {
  const entry = catalog.find((p) => p.name === name)
  if (!entry) throw new Error(`Unknown phenomenon "${name}". Known: ${catalog.map((p) => p.name).join(", ")}`)
  if (entry.kind === "filter") return halate(host.parentElement ?? host, options)

  const scope = host.parentElement ?? document.documentElement
  const state = { options: { mode: "auto", daylight: false, intensity: 1, ...options }, instance: null }

  const compute = () => {
    const o = state.options
    const mode = o.mode === "auto" ? resolvedMode(scope) : o.mode
    const base = {
      color1: o.color1 ?? tokenHex("light-core", mode, scope),
      color2: o.color2 ?? tokenHex("light-edge", mode, scope),
      accent: o.accent ?? tokenHex("accent", mode, scope),
      mode,
    }
    let lighting = { ...base, ...(RESTING[name] ?? {}) }
    if (o.daylight) {
      const moment = o.daylight instanceof Date ? o.daylight : new Date()
      const day = daylight(moment)
      lighting = { ...lighting, ...lightingFor(entry.kind === "light" ? name : "sim", day, base) }
    }
    const { daylight: _d, mode: _m, ...rest } = o
    const press = name === "foil" && !o.runs && !o.drawMark ? pressedType(host) : {}
    return { ...lighting, ...press, ...rest, mode, intensity: (lighting.intensity ?? 1) * (o.intensity ?? 1), quiet: o.quiet ?? (name === "foil" ? undefined : quietZone(host)) }
  }

  state.instance = entry.kind === "light" ? mountAtmosphere(host, LIGHT[name], compute()) : mountSim(host, SIMS[name], compute())
  // Fonts change the pressed type's shape: press again once they're ready.
  if (name === "foil") document.fonts?.ready.then(() => state.instance.update(compute()))

  // Follow the page's scheme and, with daylight on, the clock.
  const refresh = () => state.instance.update(compute())
  const schemes = matchMedia("(prefers-color-scheme: dark)")
  schemes.addEventListener("change", refresh)
  const observer = new MutationObserver(refresh)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent", "class"] })
  const clock = setInterval(() => state.options.daylight === true && refresh(), 60_000)
  const resize = new ResizeObserver(refresh)
  resize.observe(host)

  return {
    name,
    update(next) {
      Object.assign(state.options, next)
      refresh()
    },
    wake() {
      state.instance.wake()
    },
    destroy() {
      schemes.removeEventListener("change", refresh)
      observer.disconnect()
      resize.disconnect()
      clearInterval(clock)
      state.instance.destroy()
    },
  }
}
