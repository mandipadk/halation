// Color math for the token build. OKLCH in, gamut-mapped sRGB/P3 out, with
// WCAG 2 and APCA contrast so every text/background pair is checked at build
// time rather than eyeballed.

export type Oklch = { l: number; c: number; h: number; alpha?: number }
type Vec3 = [number, number, number]

const DEG = Math.PI / 180

export function oklchToOklab({ l, c, h }: Oklch): Vec3 {
  return [l, c * Math.cos(h * DEG), c * Math.sin(h * DEG)]
}

export function oklabToOklch([l, a, b]: Vec3): Oklch {
  const c = Math.hypot(a, b)
  let h = Math.atan2(b, a) / DEG
  if (h < 0) h += 360
  return { l, c, h: c < 1e-7 ? 0 : h }
}

export function oklabToLinearSrgb([L, a, b]: Vec3): Vec3 {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

export function linearSrgbToOklab([r, g, b]: Vec3): Vec3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function linearSrgbToLinearP3([r, g, b]: Vec3): Vec3 {
  return [
    0.8224621209 * r + 0.1775378791 * g,
    0.0331941989 * r + 0.9668058011 * g,
    0.0170826307 * r + 0.0723974407 * g + 0.9105199286 * b,
  ]
}

const encode = (x: number) => (Math.abs(x) <= 0.0031308 ? 12.92 * x : Math.sign(x) * (1.055 * Math.abs(x) ** (1 / 2.4) - 0.055))
const decode = (x: number) => (Math.abs(x) <= 0.04045 ? x / 12.92 : Math.sign(x) * ((Math.abs(x) + 0.055) / 1.055) ** 2.4)

export type Gamut = "srgb" | "p3"

function linearIn(gamut: Gamut, color: Oklch): Vec3 {
  const rgb = oklabToLinearSrgb(oklchToOklab(color))
  return gamut === "p3" ? linearSrgbToLinearP3(rgb) : rgb
}

export function inGamut(color: Oklch, gamut: Gamut = "srgb"): boolean {
  const eps = 1e-6
  return linearIn(gamut, color).every((v) => v >= -eps && v <= 1 + eps)
}

function deltaEOK(a: Oklch, b: Oklch): number {
  const [l1, a1, b1] = oklchToOklab(a)
  const [l2, a2, b2] = oklchToOklab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** Clip in the target space and come back to OKLCH. */
function clip(color: Oklch, gamut: Gamut): Oklch {
  const lin = linearIn(gamut, color).map((v) => Math.min(1, Math.max(0, v))) as Vec3
  // Only sRGB round-trips are needed for the distance check; P3 clips are
  // converted back through sRGB's inverse of the P3 matrix.
  const srgb = gamut === "p3" ? linearP3ToLinearSrgb(lin) : lin
  return { ...oklabToOklch(linearSrgbToOklab(srgb)), alpha: color.alpha }
}

function linearP3ToLinearSrgb([r, g, b]: Vec3): Vec3 {
  return [
    1.2249401763 * r - 0.2249401763 * g,
    -0.0420569547 * r + 1.0420569547 * g,
    -0.0196375546 * r - 0.0786360456 * g + 1.0982736002 * b,
  ]
}

/**
 * CSS Color 4 gamut mapping: keep lightness and hue, reduce chroma until the
 * color is within a just-noticeable difference of the target gamut.
 */
export function toGamut(color: Oklch, gamut: Gamut = "srgb"): Oklch {
  if (color.l >= 1) return { l: 1, c: 0, h: 0, alpha: color.alpha }
  if (color.l <= 0) return { l: 0, c: 0, h: 0, alpha: color.alpha }
  if (inGamut(color, gamut)) return color
  const JND = 0.02
  const EPS = 0.0001
  let clipped = clip(color, gamut)
  if (deltaEOK(clipped, color) < JND) return clipped
  let min = 0
  let max = color.c
  let minInGamut = true
  while (max - min > EPS) {
    const chroma = (min + max) / 2
    const current = { ...color, c: chroma }
    if (minInGamut && inGamut(current, gamut)) {
      min = chroma
      continue
    }
    clipped = clip(current, gamut)
    const e = deltaEOK(clipped, current)
    if (e < JND) {
      if (JND - e < EPS) return clipped
      minInGamut = false
      min = chroma
    } else {
      max = chroma
    }
  }
  return clipped
}

/** sRGB channels 0–1 (gamma-encoded), after gamut mapping. */
export function toSrgb(color: Oklch): Vec3 {
  const mapped = toGamut(color, "srgb")
  return oklabToLinearSrgb(oklchToOklab(mapped)).map((v) => Math.min(1, Math.max(0, encode(v)))) as Vec3
}

export function toHex(color: Oklch): string {
  const hex = toSrgb(color)
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
    .join("")
  const a = color.alpha ?? 1
  return a < 1 ? `#${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}` : `#${hex}`
}

export function fromHex(hex: string): Oklch {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? [...h].map((x) => x + x).join("") : h
  const rgb = [0, 2, 4].map((i) => decode(parseInt(full.slice(i, i + 2), 16) / 255)) as Vec3
  const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : undefined
  return { ...oklabToOklch(linearSrgbToOklab(rgb)), ...(alpha === undefined ? {} : { alpha }) }
}

const round = (x: number, digits: number) => Number(x.toFixed(digits))

/**
 * CSS text. Browsers clip out-of-gamut colors (shifting their hue) rather
 * than mapping them, so values are mapped to the target gamut here.
 */
export function toCss(color: Oklch, gamut: Gamut = "srgb"): string {
  const m = toGamut(color, gamut)
  const a = color.alpha ?? 1
  const body = `${round(m.l * 100, 2)}% ${round(m.c, 4)} ${round(m.h, 2)}`
  return a < 1 ? `oklch(${body} / ${round(a * 100, 1)}%)` : `oklch(${body})`
}

/** Composite a translucent color over an opaque one, in linear sRGB. */
export function over(top: Oklch, bottom: Oklch): Oklch {
  const a = top.alpha ?? 1
  const t = oklabToLinearSrgb(oklchToOklab(toGamut({ ...top, alpha: 1 })))
  const b = oklabToLinearSrgb(oklchToOklab(toGamut(bottom)))
  const mixed = t.map((v, i) => v * a + b[i] * (1 - a)) as Vec3
  return oklabToOklch(linearSrgbToOklab(mixed))
}

/** Mix in OKLab, like CSS color-mix(in oklab, a p, b). */
export function mix(a: Oklch, b: Oklch, p: number): Oklch {
  const x = oklchToOklab(a)
  const y = oklchToOklab(b)
  return oklabToOklch([0, 1, 2].map((i) => x[i] * p + y[i] * (1 - p)) as Vec3)
}

function luminance(color: Oklch): number {
  const [r, g, b] = toSrgb(color).map(decode)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.x contrast ratio (1–21). */
export function wcag(fg: Oklch, bg: Oklch): number {
  const text = (fg.alpha ?? 1) < 1 ? over(fg, bg) : fg
  const [hi, lo] = [luminance(text), luminance(bg)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** APCA 0.0.98G-4g lightness contrast, Lc (signed: negative = light text on dark). */
export function apca(fg: Oklch, bg: Oklch): number {
  const text = (fg.alpha ?? 1) < 1 ? over(fg, bg) : fg
  const y = (color: Oklch) => {
    const [r, g, b] = toSrgb(color)
    const lum = 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.072175 * b ** 2.4
    return lum < 0.022 ? lum + (0.022 - lum) ** 1.414 : lum
  }
  const yt = y(text)
  const yb = y(bg)
  if (Math.abs(yb - yt) < 0.0005) return 0
  if (yb > yt) {
    const sapc = (yb ** 0.56 - yt ** 0.57) * 1.14
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100
  }
  const sapc = (yb ** 0.65 - yt ** 0.62) * 1.14
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100
}
