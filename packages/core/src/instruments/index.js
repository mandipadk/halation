// Instruments: the drawing behind Halation's measuring controls. The sundial
// paints a real sky for any minute of the day from the daylight model, so a
// time picker shows what that hour actually looks like.

import { sun } from "../phenomena/daylight.js"

const DEG = Math.PI / 180
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t
// Mixes OKLCH colors through Lab, so blue to amber passes through grey, not green.
const mix = ([L1, C1, H1], [L2, C2, H2], t) => {
  const a = lerp(C1 * Math.cos(H1 * DEG), C2 * Math.cos(H2 * DEG), t)
  const b = lerp(C1 * Math.sin(H1 * DEG), C2 * Math.sin(H2 * DEG), t)
  return [lerp(L1, L2, t), Math.hypot(a, b), (Math.atan2(b, a) / DEG + 360) % 360]
}
const ok = ([L, C, H], a = 1) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)} / ${a.toFixed(3)})`

/** A clock time for minutes after midnight: ["7:45", "pm"]. */
export function formatClock(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  return [`${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")}`, h < 12 ? "am" : "pm"]
}

const dayOf = (date) => Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000)

/**
 * A day's sky, measured. Sunrise and sunset (minutes after midnight) default to
 * the daylight model's for the date and latitude; when given, the model's arc
 * is stretched to fit them, so the light matches the clock people live by.
 *
 * @param {{ date?: Date, latitude?: number, sunrise?: number, sunset?: number }} [options]
 */
export function sky({ date = new Date(), latitude = 42, sunrise, sunset } = {}) {
  const doy = dayOf(date)
  const elevationAt = (hour) => sun(hour, doy, latitude).elevation / DEG
  let half = 6
  for (let h = 12; h > 0; h -= 0.01) if (elevationAt(h) < 0) { half = 12 - h; break }
  const rise = sunrise ?? Math.round((12 - half) * 60)
  const set = sunset ?? Math.round((12 + half) * 60)
  const noon = (rise + set) / 2
  const k = half / ((set - rise) / 120)
  const elevation = (m) => {
    let d = m - noon
    if (d > 720) d -= 1440
    if (d < -720) d += 1440
    return elevationAt(12 + (d / 60) * k)
  }
  /** Where a minute sits on the dial, set to solar time: the sun is highest at the top. */
  const angle = (m) => ((m - noon + 720) / 1440) * Math.PI * 2
  const minuteAt = (a) => (((a / (Math.PI * 2)) * 1440 + noon - 720) % 1440 + 1440) % 1440
  const hours = (n) => {
    const h = Math.floor(n / 60), mm = Math.round(n % 60)
    return h ? `${h} hour${h > 1 ? "s" : ""}${mm ? ` ${mm} minutes` : ""}` : `${mm} minutes`
  }
  /** The light at a minute in words: a phase, and a sentence about what comes next. */
  const describe = (m) => {
    const e = elevation(m)
    const [st, sa] = formatClock(set), [rt, ra] = formatClock(rise)
    if (e > 6 && m < noon) return { phase: "Morning", line: "The sun is still climbing." }
    if (e > 6 && set - m > 90) return { phase: "Daylight", line: `${hours(set - m)} of sun left.` }
    if (e > -1 && m > noon) return { phase: "Golden hour", line: `The sun sets at ${st} ${sa}.` }
    if (e > -1) return { phase: "Golden hour", line: "The sun is just up." }
    if (e > -7) return { phase: "Blue hour", line: m > noon ? `The sun set ${hours((m - set + 1440) % 1440)} ago.` : `Sunrise at ${rt} ${ra}.` }
    return { phase: "Night", line: `The sun rises in ${hours((rise - m + 1440) % 1440)}.` }
  }
  return { sunrise: rise, sunset: set, noon, elevation, angle, minuteAt, describe }
}

/**
 * Paints the sundial's face into a square 2D canvas: the sky from zenith to
 * horizon, stars as it darkens, the sun's light and the warm band it lays on
 * the horizon, the sun itself (clipped, so it truly sets), the ground, and at
 * night a crescent moon where the sun would be. Returns the sun's position as
 * fractions of the canvas, for placing a handle over it.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} minutes
 * @param {ReturnType<typeof sky>} day
 * @param {{ track?: number }} [options]
 */
export function paintSundial(canvas, minutes, day, { track = 0.735 } = {}) {
  const g = canvas.getContext?.("2d")
  if (!g) return { x: 0.5, y: 0.5 }
  const S = canvas.width, C = S / 2, R = C * track
  const at = (m) => [C - R * Math.sin(day.angle(m)), C + R * Math.cos(day.angle(m))]
  const horizon = at(day.sunrise)[1]
  const e = day.elevation(minutes)
  const light = smooth(-6, 8, e), golden = smooth(-4, 3, e) * (1 - smooth(8, 22, e)), night = 1 - smooth(-12, -3, e), dusk = smooth(-8, -1, e) * (1 - smooth(-1, 4, e))
  const [sx, sy] = at(minutes)
  const u = S / 348
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, S, S)

  const zenith = mix(mix([0.14, 0.02, 262], [0.34, 0.05, 255], 1 - night), [0.72, 0.045, 240], light)
  const low = mix(mix([0.2, 0.025, 262], [0.5, 0.06, 30], dusk + golden * 0.4), [0.9, 0.025, 85], light * (1 - golden))
  const skyFill = g.createLinearGradient(0, 0, 0, horizon)
  skyFill.addColorStop(0, ok(zenith))
  skyFill.addColorStop(1, ok(low))
  g.fillStyle = skyFill
  g.fillRect(0, 0, S, horizon)

  if (night > 0.02) {
    let seed = 11
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 90; i++) {
      const x = rand() * S, y = rand() * horizon, r = (0.3 + rand() * 0.9) * u, tw = rand()
      g.fillStyle = ok([0.97, 0.01, 90], night * (0.35 + tw * 0.65))
      g.beginPath(); g.arc(x, y, r * 0.8, 0, Math.PI * 2); g.fill()
    }
  }
  if (e > -8) {
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 150 * u)
    halo.addColorStop(0, ok(mix([0.98, 0.02, 90], [0.85, 0.14, 55], golden), 0.55 * Math.max(light, golden)))
    halo.addColorStop(1, ok([0.9, 0.05, 60], 0))
    g.fillStyle = halo
    g.fillRect(0, 0, S, horizon)
    const band = g.createRadialGradient(sx, horizon, 0, sx, horizon, 230 * u)
    band.addColorStop(0, ok([0.78, 0.13, 48], 0.7 * Math.max(golden, dusk)))
    band.addColorStop(1, ok([0.6, 0.1, 40], 0))
    g.save(); g.translate(sx, horizon); g.scale(1, 0.32); g.translate(-sx, -horizon)
    g.fillStyle = band; g.fillRect(0, horizon - 240 * u, S, 240 * u)
    g.restore()
  }
  if (e > -3) {
    g.save(); g.beginPath(); g.rect(0, 0, S, horizon); g.clip()
    const disc = g.createRadialGradient(sx - 3 * u, sy - 3 * u, 0, sx, sy, 15 * u)
    disc.addColorStop(0, ok([0.995, 0.01, 95]))
    disc.addColorStop(0.7, ok(mix([0.97, 0.03, 90], [0.88, 0.13, 60], golden)))
    disc.addColorStop(1, ok(mix([0.92, 0.05, 85], [0.8, 0.16, 50], golden)))
    g.fillStyle = disc
    g.beginPath(); g.arc(sx, sy, 14 * u, 0, Math.PI * 2); g.fill()
    g.restore()
  }
  const ground = g.createLinearGradient(0, horizon, 0, S)
  ground.addColorStop(0, ok(mix([0.19, 0.01, 60], [0.36, 0.03, 60], light)))
  ground.addColorStop(0.08, ok(mix([0.14, 0.008, 60], [0.26, 0.02, 60], light)))
  ground.addColorStop(1, ok([0.1, 0.005, 60]))
  g.fillStyle = ground
  g.fillRect(0, horizon, S, S - horizon)
  g.fillStyle = ok([0.95, 0.04, 70], 0.18 + 0.4 * Math.max(golden, dusk))
  g.fillRect(0, horizon - 0.5 * u, S, u)

  g.strokeStyle = ok([0.95, 0, 0], 0.1)
  g.setLineDash([1.5 * u, 5 * u]); g.lineWidth = u
  g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([])
  if (e <= -3) {
    g.save()
    g.fillStyle = ok([0.93, 0.01, 90], 0.95)
    g.beginPath(); g.arc(sx, sy, 10 * u, 0, Math.PI * 2); g.fill()
    g.globalCompositeOperation = "destination-out"
    g.beginPath(); g.arc(sx + 5 * u, sy - 3.5 * u, 9 * u, 0, Math.PI * 2); g.fill()
    g.restore()
  } else if (sy > horizon - 14 * u) {
    g.strokeStyle = ok([0.95, 0.05, 70], 0.55)
    g.lineWidth = u
    g.beginPath(); g.arc(sx, sy, 15 * u, 0, Math.PI * 2); g.stroke()
  }
  return { x: sx / S, y: sy / S }
}
