// Color at runtime: the same OKLCH math the forge uses at build time, small
// enough to ship, so a project can derive an accent's roles in the browser
// and prove their contrast as someone picks a hue.

const DEG = Math.PI / 180

/** OKLCH to linear sRGB, following the CSS Color 4 reference math. */
export function toLinear(L, C, h) {
  const a = C * Math.cos(h * DEG), b = C * Math.sin(h * DEG)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0001 && c <= 1.0001)

/** The most chroma a lightness and hue can carry inside sRGB. */
export function maxChroma(L, h) {
  let lo = 0, hi = 0.4
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(toLinear(L, mid, h))) lo = mid
    else hi = mid
  }
  return lo
}

const gamma = (c) => {
  c = Math.min(1, Math.max(0, c))
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
}

/** An OKLCH triple as a CSS rgb() color. */
export function css([L, C, h]) {
  const [r, g, b] = toLinear(L, C, h).map(gamma)
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`
}

const luminance = ([L, C, h]) => {
  const [r, g, b] = toLinear(L, C, h).map((c) => Math.min(1, Math.max(0, c)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast between two OKLCH colors. */
export function contrast(x, y) {
  const [a, b] = [luminance(x), luminance(y)].sort((p, q) => q - p)
  return (a + 0.05) / (b + 0.05)
}

/** Halation keeps accents out of purple: hues inside this range are closed. */
export const CLOSED_HUES = [258, 345]

/** Whether a hue can be an accent, and the nearest one that can. */
export function openHue(hue, toward = 0) {
  const h = ((hue % 360) + 360) % 360
  if (h <= CLOSED_HUES[0] || h >= CLOSED_HUES[1]) return h
  if (toward > 0) return CLOSED_HUES[1]
  if (toward < 0) return CLOSED_HUES[0]
  return h - CLOSED_HUES[0] < CLOSED_HUES[1] - h ? CLOSED_HUES[0] : CLOSED_HUES[1]
}

const NAMES = [[25, "Red"], [37, "Vermilion"], [55, "Orange"], [75, "Amber"], [95, "Yellow"], [125, "Lime"], [150, "Green"], [165, "Jade"], [185, "Teal"], [210, "Cyan"], [235, "Blue"], [255, "Cobalt"], [352, "Rose"]]
const gap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** A plain name for a hue: the nearest of a few everyday color words. */
export function hueName(hue) {
  return NAMES.reduce((best, n) => (gap(n[0], hue) < gap(best[0], hue) ? n : best))[1]
}

const CANVAS = { light: [0.985, 0, 0], dark: [0.1149, 0, 0] }
const fit = (L, h, want) => [L, Math.min(want, maxChroma(L, h)), h]

/**
 * An accent's roles from one hue, each text color solved for contrast rather
 * than guessed. Returns CSS colors for every role in both modes, and the
 * measured contrast of each pair that carries text.
 */
export function deriveAccent(hue) {
  const h = openHue(hue)
  const accent = fit(0.7052, h, 0.19)
  const onAccent = [0.18, 0.03, h]
  const solve = (mode) => {
    let L = mode === "light" ? 0.6 : 0.72
    for (let i = 0; i < 60; i++) {
      const c = fit(L, h, 0.19)
      if (contrast(c, CANVAS[mode]) >= 4.6) return c
      L += mode === "light" ? -0.01 : 0.01
    }
    return fit(L, h, 0.19)
  }
  const mode = (m, soft) => {
    const fg = solve(m)
    return {
      canvas: css(CANVAS[m]),
      text: css(m === "light" ? [0.18, 0, 0] : [0.985, 0, 0]),
      fg: css(fg),
      soft: css(soft),
      checks: { link: contrast(fg, CANVAS[m]), onAccent: contrast(onAccent, accent) },
    }
  }
  return {
    hue: h,
    name: hueName(h),
    accent: css(accent),
    onAccent: css(onAccent),
    light: mode("light", fit(0.957, h, 0.02)),
    dark: mode("dark", fit(0.1975, h, 0.027)),
  }
}
