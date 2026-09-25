// The theme recipe. A project gives one accent (and optionally a neutral
// tint); every color role in both modes is computed from it, and each
// text/background pair is solved to its contrast target instead of typed.

import { apca, fromHex, mix, toGamut, wcag, type Oklch } from "./color.ts"

export type Mode = "light" | "dark"

export type Seed = {
  /** Identifier used for presets: `[data-accent="<id>"]`. */
  id: string
  name: string
  /** The one color. Hex or {l, c, h}. */
  accent: string | Oklch
  /** A faint hue in the greys; chroma 0 keeps them neutral. */
  neutral?: { hue: number; chroma: number }
}

export type Role = {
  name: string
  light: Oklch
  dark: Oklch
  usage: string
  /** Contrast checks this role must pass: [background role, minimum WCAG ratio]. */
  checks?: [string, Target][]
}

const parse = (value: string | Oklch): Oklch => (typeof value === "string" ? fromHex(value) : value)

/** Lightness steps for the greys, per mode. Dark values are the Parallex site's. */
const GREYS = {
  dark: {
    canvas: 0.1149,
    surface: 0.155,
    raised: 0.185,
    fill: 0.22,
    "fill-hover": 0.245,
    "fill-active": 0.275,
    fg: 0.985,
    "fg-muted": 0.708,
    "fg-subtle": 0.56,
    ink: 0.96,
    "ink-hover": 0.88,
    "on-ink": 0.16,
  },
  light: {
    canvas: 0.985,
    surface: 1,
    raised: 1,
    fill: 0.955,
    "fill-hover": 0.93,
    "fill-active": 0.905,
    fg: 0.18,
    "fg-muted": 0.46,
    "fg-subtle": 0.58,
    ink: 0.2,
    "ink-hover": 0.32,
    "on-ink": 0.985,
  },
} as const

/**
 * Moves a color's lightness (keeping hue, mapping chroma to the gamut) until
 * it reaches `ratio` against every background. Returns the smallest change
 * that passes, so the accent stays as close to the brand as contrast allows.
 */
export function solve(color: Oklch, backgrounds: Oklch[], target: Target, direction: "lighter" | "darker"): Oklch {
  const passes = (l: number) => backgrounds.every((bg) => meets(toGamut({ ...color, l }), bg, target))
  if (passes(color.l)) return toGamut(color)
  let lo = color.l
  let hi = direction === "lighter" ? 1 : 0
  if (!passes(hi)) return toGamut({ ...color, l: hi })
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (passes(mid)) hi = mid
    else lo = mid
  }
  return toGamut({ ...color, l: hi })
}

const alpha = (base: Oklch, a: number): Oklch => ({ ...base, alpha: a })

/**
 * A contrast target in both standards: WCAG 2 (the legal baseline) and
 * APCA (closer to how people actually read, especially on dark grounds).
 */
export type Target = { wcag: number; lc: number }
export const TARGETS = {
  text: { wcag: 7, lc: 90 },
  muted: { wcag: 4.5, lc: 60 },
  subtle: { wcag: 3, lc: 30 },
  mark: { wcag: 3, lc: 45 },
} satisfies Record<string, Target>

/** Labels on filled controls: short, medium weight. */
export const ON_FILL: Target = { wcag: 4.5, lc: 45 }

/** The lightness closest to `from`, moving toward `to`, where `ok` holds; undefined when none does. */
function nearest(from: number, to: number, ok: (l: number) => boolean): number | undefined {
  if (ok(from)) return from
  if (!ok(to)) return undefined
  let lo = from
  let hi = to
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (ok(mid)) hi = mid
    else lo = mid
  }
  return hi
}

export function meets(fg: Oklch, bg: Oklch, target: Target): boolean {
  return wcag(fg, bg) >= target.wcag - 1e-9 && Math.abs(apca(fg, bg)) >= target.lc - 1e-9
}

export function roles(seed: Seed): Role[] {
  const seedColor = toGamut(parse(seed.accent))
  const tint = seed.neutral ?? { hue: seedColor.h, chroma: 0 }
  const grey = (l: number): Oklch => ({ l, c: l > 0.97 || l < 0.02 ? 0 : tint.chroma, h: tint.hue })
  const out: Role[] = []
  const add = (name: string, light: Oklch, dark: Oklch, usage: string, checks?: [string, Target][]) =>
    out.push({ name, light, dark, usage, checks })
  const g = (mode: Mode, key: keyof (typeof GREYS)["dark"]) => grey(GREYS[mode][key])
  const both = (key: keyof (typeof GREYS)["dark"]) => [g("light", key), g("dark", key)] as const

  // Surfaces
  add("canvas", ...both("canvas"), "The page. Everything sits on it.")
  add("surface", ...both("surface"), "Raised content: cards, panels, the sidebar.")
  add("raised", ...both("raised"), "Floating layers: menus, popovers, dialogs.")
  add("fill", ...both("fill"), "Neutral control fill: secondary buttons, inputs at rest, chips.")
  add("fill-hover", ...both("fill-hover"), "Neutral fill under the pointer.")
  add("fill-active", ...both("fill-active"), "Pressed or selected neutral fill.")

  // Text
  const text = (key: "fg" | "fg-muted" | "fg-subtle", ratio: Target, usage: string) => {
    const [l, d] = both(key)
    const onLight = [g("light", "canvas"), g("light", "surface"), g("light", "fill")]
    const onDark = [g("dark", "canvas"), g("dark", "surface"), g("dark", "raised"), g("dark", "fill")]
    add(key, solve(l, onLight, ratio, "darker"), solve(d, onDark, ratio, "lighter"), usage, [
      ["canvas", ratio],
      ["surface", ratio],
      ["raised", ratio],
      ["fill", ratio],
    ])
  }
  text("fg", TARGETS.text, "Primary text and icons.")
  text("fg-muted", TARGETS.muted, "Secondary text: descriptions, metadata, placeholders people must read.")
  text("fg-subtle", TARGETS.subtle, "Tertiary marks only: disabled text, large decorative numerals, separators' labels. Never body copy.")

  // Ink: the primary action is inverted text color, not the accent.
  add("ink", ...both("ink"), "Primary action fill (the one most important button).")
  add("ink-hover", ...both("ink-hover"), "Primary action under the pointer.")
  add("on-ink", ...both("on-ink"), "Text and icons on ink.", [["ink", TARGETS.text]])

  // Lines: translucent, so they sit right on any surface.
  add("line", alpha(grey(0), 0.08), alpha(grey(1), 0.09), "Hairlines: borders, dividers.")
  add("line-strong", alpha(grey(0), 0.14), alpha(grey(1), 0.15), "Input borders and lines that must be seen.")
  add("scrim", alpha(grey(0.2), 0.32), alpha(grey(0), 0.6), "Behind modal dialogs.")

  // Accent: identity, focus, selection and live state. A signal, not paint.
  const canvasL = g("light", "canvas")
  const canvasD = g("dark", "canvas")
  // The accent fill must carry a label. When neither dark nor white text
  // passes on the seed, the fill moves in lightness (never hue) by the least
  // amount that lets one of them pass. `shift` records how far it moved.
  const ink = (l: number) => toGamut({ l, c: Math.min(seedColor.c, 0.03), h: seedColor.h })
  const labels = [ink(0.18), grey(1)]
  let fill = seedColor
  let onAccent = labels.find((c) => meets(c, seedColor, ON_FILL))
  if (!onAccent) {
    const options = labels.map((label) => {
      const direction = label.l < 0.5 ? 1 : 0
      const l = nearest(seedColor.l, direction, (l) => meets(label, toGamut({ ...seedColor, l }), ON_FILL))
      return { label, l }
    })
    const best = options.filter((o) => o.l !== undefined).sort((a, b) => Math.abs(a.l! - seedColor.l) - Math.abs(b.l! - seedColor.l))[0]
    fill = toGamut({ ...seedColor, l: best.l! })
    onAccent = best.label
  }
  const accent = fill
  const accentHover = (mode: Mode) => toGamut({ ...accent, l: accent.l + (mode === "dark" ? 0.05 : -0.05) })
  add("accent", accent, accent, "The one color: selection, focus, live state, the brand mark.")
  add("accent-hover", accentHover("light"), accentHover("dark"), "Accent fills under the pointer.")
  add("on-accent", onAccent, onAccent, "Text and icons on an accent fill.", [["accent", ON_FILL]])
  const soft = (mode: Mode, p: number) => mix(accent, mode === "dark" ? canvasD : canvasL, p)
  add("accent-soft", soft("light", 0.1), soft("dark", 0.14), "Tinted backgrounds: selected rows, accent chips.")
  add("accent-soft-hover", soft("light", 0.16), soft("dark", 0.2), "Tinted backgrounds under the pointer.")
  add(
    "accent-fg",
    solve(accent, [canvasL, soft("light", 0.16), grey(GREYS.light.surface)], TARGETS.muted, "darker"),
    solve(accent, [canvasD, soft("dark", 0.2), grey(GREYS.dark.raised)], TARGETS.muted, "lighter"),
    "Accent-colored text and icons on neutral or soft grounds.",
    [["canvas", TARGETS.muted], ["accent-soft", TARGETS.muted]],
  )
  add(
    "ring",
    solve(accent, [canvasL, grey(GREYS.light.surface)], TARGETS.mark, "darker"),
    solve(accent, [canvasD, grey(GREYS.dark.raised)], TARGETS.mark, "lighter"),
    "Focus rings and the accent's visible edges.",
    [["canvas", TARGETS.mark]],
  )

  // Status: fixed hues, told apart by lightness and icon, not color alone.
  const status = (name: string, hue: number, chroma: number, usage: string) => {
    const base: Oklch = { l: 0.72, c: chroma, h: hue }
    add(name, toGamut({ ...base, l: 0.58 }), toGamut(base), usage)
    add(`${name}-soft`, mix(base, canvasL, 0.12), mix(base, canvasD, 0.14), `Background for ${name} messages and chips.`)
    add(
      `${name}-fg`,
      solve({ ...base, l: 0.5 }, [canvasL, mix(base, canvasL, 0.12), grey(1)], TARGETS.muted, "darker"),
      solve(base, [canvasD, mix(base, canvasD, 0.14), grey(GREYS.dark.raised)], TARGETS.muted, "lighter"),
      `${name[0].toUpperCase()}${name.slice(1)} text and icons.`,
      [["canvas", TARGETS.muted], [`${name}-soft`, TARGETS.muted]],
    )
  }
  status("positive", 152, 0.13, "Success: saved, running, verified.")
  status("warning", 80, 0.13, "Needs attention, nothing lost yet.")
  status("critical", 25, 0.17, "Errors and destructive actions.")

  // Atmosphere: light on dark grounds (a near-white core and a tinted edge);
  // on light grounds the same roles are the shade the light casts, a warm
  // grey multiplied onto the page.
  add("light-core", toGamut({ l: 0.9, c: 0.012, h: seedColor.h }), toGamut({ l: 0.975, c: 0.012, h: seedColor.h }), "Atmospheres: the core of the light (in light mode, the soft shade).")
  add("light-edge", toGamut({ l: 0.83, c: 0.028, h: seedColor.h }), toGamut({ l: 0.84, c: 0.085, h: seedColor.h }), "Atmospheres: the light's tinted edge (in light mode, the deeper shade).")
  // Film halation is red-orange; here it takes the accent's hue, so a page
  // still has one color.
  add("halation", toGamut({ l: 0.62, c: 0.16, h: seedColor.h }), toGamut({ l: 0.66, c: Math.max(0.12, seedColor.c), h: seedColor.h }), "The glow film gives bright things, in the accent's hue.")
  return out
}

export type Failure = { role: string; mode: Mode; against: string; ratio: number; needed: Target }

/** Every declared check, in both modes. The build refuses a theme that fails one. */
export function audit(list: Role[]): { rows: (Failure & { pass: boolean; lc: number })[]; failures: Failure[] } {
  const byName = new Map(list.map((r) => [r.name, r]))
  const rows: (Failure & { pass: boolean; lc: number })[] = []
  for (const role of list) {
    for (const [against, needed] of role.checks ?? []) {
      const bg = byName.get(against)
      if (!bg) throw new Error(`${role.name} is checked against unknown role ${against}`)
      for (const mode of ["light", "dark"] as const) {
        const ratio = wcag(role[mode], bg[mode])
        rows.push({ role: role.name, mode, against, ratio, needed, pass: meets(role[mode], bg[mode], needed), lc: apca(role[mode], bg[mode]) })
      }
    }
  }
  return { rows, failures: rows.filter((r) => !r.pass) }
}
