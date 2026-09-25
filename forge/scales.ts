// Type, space, radius, elevation and motion. These don't depend on the
// accent; a project may retune a few (radius base, fonts) through its seed.

export const fonts = {
  sans: '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif',
  serif: '"Instrument Serif", ui-serif, Georgia, serif',
  mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
}

export type TextStyle = {
  name: string
  size: string
  leading: string
  tracking: string
  weight: number
  usage: string
}

/** A size that grows linearly from `min` px at a 360 px viewport to `max` px at 1440 px. */
function fluid(min: number, max: number): string {
  const slope = (max - min) / (1440 - 360)
  const base = min - slope * 360
  const rem = (px: number) => `${Number((px / 16).toFixed(4))}rem`
  return `clamp(${rem(min)}, ${rem(base)} + ${Number((slope * 100).toFixed(4))}vw, ${rem(max)})`
}

/**
 * Semantic text styles. Display sizes are fluid between a 360 px and a
 * 1440 px viewport; tracking tightens as size grows (Geist opens up at
 * display sizes, so big type needs it more).
 */
export const text: TextStyle[] = [
  { name: "display-xl", size: fluid(52, 116), leading: "0.92", tracking: "-0.045em", weight: 600, usage: "The one hero line on a page." },
  { name: "display", size: fluid(36, 60), leading: "1", tracking: "-0.04em", weight: 600, usage: "Section headlines on marketing pages." },
  { name: "title-1", size: fluid(28, 36), leading: "1.1", tracking: "-0.03em", weight: 600, usage: "Page titles in products; dialog heroes." },
  { name: "title-2", size: "1.5rem", leading: "1.2", tracking: "-0.022em", weight: 600, usage: "Section titles inside a page." },
  { name: "title-3", size: "1.25rem", leading: "1.3", tracking: "-0.016em", weight: 600, usage: "Card and group titles." },
  { name: "body-lg", size: "1.125rem", leading: "1.6", tracking: "-0.011em", weight: 400, usage: "Lead paragraphs under a headline." },
  { name: "body", size: "1rem", leading: "1.6", tracking: "-0.006em", weight: 400, usage: "Reading text." },
  { name: "body-sm", size: "0.875rem", leading: "1.5", tracking: "-0.003em", weight: 400, usage: "Interface text: controls, lists, tables." },
  { name: "caption", size: "0.8125rem", leading: "1.45", tracking: "0em", weight: 400, usage: "Metadata, helper text, footnotes." },
  { name: "micro", size: "0.75rem", leading: "1.35", tracking: "0.005em", weight: 500, usage: "Badges, keyboard keys, counters. Never sentences." },
]

/** Radius steps; `lg` is the base a project may retune. */
export const radius = [
  { name: "xs", value: "0.25rem", usage: "Keyboard keys, tiny tags." },
  { name: "sm", value: "0.375rem", usage: "Checkboxes, small chips." },
  { name: "md", value: "0.5rem", usage: "Inputs and buttons inside dense UI." },
  { name: "lg", value: "0.625rem", usage: "Buttons, inputs, menu items. The base." },
  { name: "xl", value: "0.875rem", usage: "Menus, popovers, small cards." },
  { name: "2xl", value: "1.125rem", usage: "Cards and panels." },
  { name: "3xl", value: "1.5rem", usage: "Dialogs, large media, product shots." },
  { name: "full", value: "9999px", usage: "Pills: the hero call to action, chips, avatars." },
]

/**
 * Layered shadows: a top highlight (light catching the edge), a ring, a
 * contact shadow and an ambient one. Both modes share the geometry and
 * differ only in color, so one `light-dark()` declaration covers them.
 */
type Layer = { inset?: boolean; y: number; blur: number; spread?: number; light: string; dark: string }

export const shadow: { name: string; layers: Layer[]; usage: string }[] = [
  {
    name: "raised",
    usage: "Cards that sit above the page.",
    layers: [
      { inset: true, y: 1, blur: 0, light: "oklch(100% 0 0 / 0%)", dark: "oklch(100% 0 0 / 6%)" },
      { y: 1, blur: 2, light: "oklch(0% 0 0 / 5%)", dark: "oklch(0% 0 0 / 40%)" },
      { y: 8, blur: 20, spread: -8, light: "oklch(0% 0 0 / 10%)", dark: "oklch(0% 0 0 / 60%)" },
    ],
  },
  {
    name: "overlay",
    usage: "Menus, popovers, tooltips.",
    layers: [
      { inset: true, y: 1, blur: 0, light: "oklch(100% 0 0 / 0%)", dark: "oklch(100% 0 0 / 8%)" },
      { y: 0, blur: 0, spread: 1, light: "oklch(0% 0 0 / 7%)", dark: "oklch(100% 0 0 / 9%)" },
      { y: 2, blur: 4, light: "oklch(0% 0 0 / 5%)", dark: "oklch(0% 0 0 / 30%)" },
      { y: 16, blur: 40, spread: -12, light: "oklch(0% 0 0 / 18%)", dark: "oklch(0% 0 0 / 70%)" },
    ],
  },
  {
    name: "modal",
    usage: "Dialogs and sheets.",
    layers: [
      { inset: true, y: 1, blur: 0, light: "oklch(100% 0 0 / 0%)", dark: "oklch(100% 0 0 / 8%)" },
      { y: 0, blur: 0, spread: 1, light: "oklch(0% 0 0 / 7%)", dark: "oklch(100% 0 0 / 10%)" },
      { y: 4, blur: 8, light: "oklch(0% 0 0 / 5%)", dark: "oklch(0% 0 0 / 35%)" },
      { y: 32, blur: 80, spread: -16, light: "oklch(0% 0 0 / 24%)", dark: "oklch(0% 0 0 / 80%)" },
    ],
  },
]

export function shadowCss(layers: Layer[]): string {
  return layers
    .map((l) => `${l.inset ? "inset " : ""}0 ${l.y}px ${l.blur}px ${l.spread ?? 0}px light-dark(${l.light}, ${l.dark})`)
    .join(", ")
}

/**
 * Easing. `out` is the signature curve: a fast start and a long, soft
 * settle. There is deliberately no ease-in: things leave the way they
 * arrive, only faster.
 */
export const ease = [
  { name: "out", value: "cubic-bezier(0.22, 1, 0.36, 1)", usage: "Anything entering, leaving or responding. The default." },
  { name: "in-out", value: "cubic-bezier(0.77, 0, 0.175, 1)", usage: "Something moving or morphing between two places on screen." },
  { name: "drawer", value: "cubic-bezier(0.32, 0.72, 0, 1)", usage: "Sheets and drawers that follow a drag." },
  {
    name: "spring",
    // Apple's "snappy" spring (response 0.5 s, bounce 0.15): settles with a barely-there
    // overshoot (about 0.6%), sampled for linear().
    value: springCurve(0.15),
    usage: "Things that snap into place: toggles, drag release. Never menus or text.",
  },
]

/** Durations by job. No interface transition runs longer than 300 ms. */
export const duration = [
  { name: "press", value: "120ms", usage: "Press feedback (scale to 0.97)." },
  { name: "hover", value: "150ms", usage: "Hover color and fill changes." },
  { name: "popover", value: "180ms", usage: "Tooltips, menus, popovers; exits of anything." },
  { name: "dialog", value: "240ms", usage: "Dialogs, toasts, panels." },
  { name: "sheet", value: "500ms", usage: "Sheets and drawers (with ease-drawer)." },
  { name: "reveal", value: "600ms", usage: "The one-time blur rise on page entrance and scroll." },
]

/** Time between items in a staggered entrance; stagger at most 6 items. */
export const stagger = "50ms"

/** A damped spring sampled into CSS linear() stops. */
function springCurve(bounce: number, samples = 40): string {
  const zeta = 1 - bounce
  const omega = (2 * Math.PI) / 0.5
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const x = (t: number) => 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  // Settle time: where the envelope drops under 0.1%.
  const end = Math.log(1000) / (zeta * omega)
  const stops: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * end
    stops.push(i === samples ? "1" : x(t).toFixed(4).replace(/0+$/, "").replace(/\.$/, ""))
  }
  return `linear(${stops.join(", ")})`
}
